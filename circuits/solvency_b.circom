pragma circom 2.0.0;

// Peça B (Stage 2.1): recompõe a raiz Poseidon-Merkle inteira a partir de TODAS as
// folhas e soma as obrigações. Tem que casar byte-a-byte com o `registry` (depth 5).
//
// Anti-omissão: a raiz recomposta é amarrada (no design final, 2.2+) à guarantees_root
// on-chain. Omitir/alterar uma folha muda a raiz → não bate → prova falha.
//
// Profundidade 5 => 2^5 = 32 folhas (árvore perfeita, sem padding ímpar).
// Folha inativa = 0 (mesmo "empty leaf" do registry). Folha ativa = Poseidon(id, obrigação).

include "circomlib/circuits/poseidon.circom";

template Leaf() {
    signal input id;
    signal input obligation;
    signal input active;       // 0 ou 1
    signal output out;

    active * (active - 1) === 0;   // active é booleano

    component h = Poseidon(2);
    h.inputs[0] <== id;
    h.inputs[1] <== obligation;

    out <== active * h.out;        // ativo ? Poseidon(id,obrigação) : 0
}

template SolvencyB(depth) {
    var N = 1 << depth;            // nº de folhas (32 p/ depth 5)

    signal input id[N];
    signal input obligation[N];
    signal input active[N];

    signal output root;
    signal output obligations;

    // --- folhas ---
    component leaves[N];
    signal node[2 * N - 1];       // [0..N-1] folhas, depois níveis internos, último = raiz
    var i;
    for (i = 0; i < N; i++) {
        leaves[i] = Leaf();
        leaves[i].id <== id[i];
        leaves[i].obligation <== obligation[i];
        leaves[i].active <== active[i];
        node[i] <== leaves[i].out;
    }

    // --- fold perfeito (N-1 hashers) ---
    component hashers[N - 1];
    var idx = 0;                  // início do nível atual
    var nxt = N;                  // início do próximo nível
    var width = N;
    var h = 0;
    while (width > 1) {
        var j;
        for (j = 0; j < width \ 2; j++) {
            hashers[h] = Poseidon(2);
            hashers[h].inputs[0] <== node[idx + 2 * j];
            hashers[h].inputs[1] <== node[idx + 2 * j + 1];
            node[nxt + j] <== hashers[h].out;
            h++;
        }
        idx = nxt;
        nxt = nxt + (width \ 2);
        width = width \ 2;
    }
    root <== node[2 * N - 2];

    // --- soma das obrigações (só ativas contam; active é 0/1) ---
    signal partial[N + 1];
    partial[0] <== 0;
    for (i = 0; i < N; i++) {
        partial[i + 1] <== partial[i] + active[i] * obligation[i];
    }
    obligations <== partial[N];
}

component main = SolvencyB(5);
