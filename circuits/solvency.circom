pragma circom 2.0.0;

// Circuito de solvência — MVP (peça B + reservas on-chain + comparação de faixa).
// Sinais PÚBLICOS: guarantees_root, vault_stable_assets, ratio_bps (o attestor cruza
// os dois primeiros com o estado on-chain ao vivo). Sinais PRIVADOS: as folhas.
//
// Afirmação provada: as folhas recompõem `guarantees_root` (anti-omissão) E
// reservas * 10000 >= obrigações * ratio_bps  (solvência na faixa pedida).
//
// 2.3 somará bank_balance (peça A, atestação EdDSA) ao lado das reservas.

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/bitify.circom";

template Leaf() {
    signal input id;
    signal input obligation;
    signal input active;           // 0 ou 1
    signal output out;

    active * (active - 1) === 0;   // booleano

    component h = Poseidon(2);
    h.inputs[0] <== id;
    h.inputs[1] <== obligation;
    out <== active * h.out;        // ativo ? Poseidon(id,obrigação) : 0
}

// Recompõe a raiz Poseidon-Merkle (árvore perfeita de 2^depth folhas) e soma obrigações.
template MerkleRootAndSum(depth) {
    var N = 1 << depth;
    signal input id[N];
    signal input obligation[N];
    signal input active[N];
    signal output root;
    signal output obligations;

    component leaves[N];
    signal node[2 * N - 1];
    var i;
    for (i = 0; i < N; i++) {
        leaves[i] = Leaf();
        leaves[i].id <== id[i];
        leaves[i].obligation <== obligation[i];
        leaves[i].active <== active[i];
        node[i] <== leaves[i].out;
    }

    component hashers[N - 1];
    var idx = 0;
    var nxt = N;
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

    signal partial[N + 1];
    partial[0] <== 0;
    for (i = 0; i < N; i++) {
        partial[i + 1] <== partial[i] + active[i] * obligation[i];
    }
    obligations <== partial[N];
}

template Solvency(depth) {
    var N = 1 << depth;

    // privados (a lista — nunca sai)
    signal input id[N];
    signal input obligation[N];
    signal input active[N];

    // peça A — atestação do banco (privados: saldo + assinatura do oráculo)
    signal input bank_balance;
    signal input bank_R8x;
    signal input bank_R8y;
    signal input bank_S;

    // públicos (cruzados com on-chain pelo attestor)
    signal input guarantees_root;
    signal input vault_stable_assets;
    signal input ratio_bps;
    signal input nonce;            // frescor (anti-replay)
    signal input oracle_Ax;        // chave pública do oráculo-banco
    signal input oracle_Ay;

    component b = MerkleRootAndSum(depth);
    var i;
    for (i = 0; i < N; i++) {
        b.id[i] <== id[i];
        b.obligation[i] <== obligation[i];
        b.active[i] <== active[i];
    }

    // Anti-omissão: a raiz recomposta tem que ser a raiz on-chain.
    b.root === guarantees_root;

    // Peça A: verifica a assinatura EdDSA-Poseidon do oráculo sobre M = Poseidon(saldo, nonce).
    // Assinatura válida => o saldo do banco é o que o oráculo atestou (saldo nunca sai).
    component mhash = Poseidon(2);
    mhash.inputs[0] <== bank_balance;
    mhash.inputs[1] <== nonce;
    component ev = EdDSAPoseidonVerifier();
    ev.enabled <== 1;
    ev.Ax <== oracle_Ax;
    ev.Ay <== oracle_Ay;
    ev.S <== bank_S;
    ev.R8x <== bank_R8x;
    ev.R8y <== bank_R8y;
    ev.M <== mhash.out;

    // Reservas = vault on-chain + saldo do banco (atestado).
    signal reserves;
    reserves <== vault_stable_assets + bank_balance;

    // Range-check: amarra reservas e obrigações a 128 bits ANTES de comparar.
    // Sem isto, GreaterEqThan(200) só é sólido se os operandos couberem em 200 bits —
    // uma invariante implícita que pendurava a corretude na magnitude do que o oráculo
    // assina. Com o range-check a soundness do comparador é auto-contida: 128 bits cobrem
    // qualquer valor real (stroops << 2^128) e impedem o "dar a volta" no campo.
    component reservesBits = Num2Bits(128);
    reservesBits.in <== reserves;
    component oblBits = Num2Bits(128);
    oblBits.in <== b.obligations;

    // Solvência: reserves * 10000 >= obligations * ratio_bps.
    // (reserves < 2^128 => reserves*10000 < 2^142 < 2^200; ratio_bps é u32 on-chain
    //  => obligations*ratio_bps < 2^160 < 2^200 — operandos seguros p/ GreaterEqThan(200).)
    component ge = GreaterEqThan(200);
    ge.in[0] <== reserves * 10000;
    ge.in[1] <== b.obligations * ratio_bps;
    ge.out === 1;
}

component main { public [guarantees_root, vault_stable_assets, ratio_bps, nonce, oracle_Ax, oracle_Ay] } = Solvency(5);
