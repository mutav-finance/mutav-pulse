pragma circom 2.0.0;

// Poseidon link check (Stage 2, step 0): the leaf computed INSIDE the
// circuit must be identical to the on-chain `registry`'s (soroban-poseidon) and to the
// off-chain reconstruction's (circomlibjs). leaf = Poseidon(id, obligation), t=3.
include "circomlib/circuits/poseidon.circom";

template LeafCheck() {
    signal input id;
    signal input obligation;
    signal output leaf;

    component h = Poseidon(2);
    h.inputs[0] <== id;
    h.inputs[1] <== obligation;
    leaf <== h.out;
}

component main = LeafCheck();
