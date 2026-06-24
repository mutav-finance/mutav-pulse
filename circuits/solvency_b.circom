pragma circom 2.0.0;

// Part B (Stage 2.1): recompose the entire Poseidon-Merkle root from ALL the
// leaves and sum the obligations. Must match the `registry` byte-for-byte (depth 5).
//
// Anti-omission: the recomposed root is bound (in the final design, 2.2+) to the on-chain
// guarantees_root. Omitting/altering a leaf changes the root → mismatch → proof fails.
//
// Depth 5 => 2^5 = 32 leaves (perfect tree, no odd padding).
// Inactive leaf = 0 (same "empty leaf" as the registry). Active leaf = Poseidon(id, obligation).

include "circomlib/circuits/poseidon.circom";

template Leaf() {
    signal input id;
    signal input obligation;
    signal input active;       // 0 or 1
    signal output out;

    active * (active - 1) === 0;   // active is boolean

    component h = Poseidon(2);
    h.inputs[0] <== id;
    h.inputs[1] <== obligation;

    out <== active * h.out;        // active ? Poseidon(id, obligation) : 0
}

template SolvencyB(depth) {
    var N = 1 << depth;            // number of leaves (32 for depth 5)

    signal input id[N];
    signal input obligation[N];
    signal input active[N];

    signal output root;
    signal output obligations;

    // --- leaves ---
    component leaves[N];
    signal node[2 * N - 1];       // [0..N-1] leaves, then internal levels, last = root
    var i;
    for (i = 0; i < N; i++) {
        leaves[i] = Leaf();
        leaves[i].id <== id[i];
        leaves[i].obligation <== obligation[i];
        leaves[i].active <== active[i];
        node[i] <== leaves[i].out;
    }

    // --- perfect fold (N-1 hashers) ---
    component hashers[N - 1];
    var idx = 0;                  // start of the current level
    var nxt = N;                  // start of the next level
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

    // --- sum of obligations (only active ones count; active is 0/1) ---
    signal partial[N + 1];
    partial[0] <== 0;
    for (i = 0; i < N; i++) {
        partial[i + 1] <== partial[i] + active[i] * obligation[i];
    }
    obligations <== partial[N];
}

component main = SolvencyB(5);
