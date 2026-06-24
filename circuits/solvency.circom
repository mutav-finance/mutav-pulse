pragma circom 2.0.0;

// Solvency circuit — MVP (part B + on-chain reserves + band comparison).
// PUBLIC signals: guarantees_root, vault_stable_assets, ratio_bps (the attestor cross-checks
// the first two against the live on-chain state). PRIVATE signals: the leaves.
//
// Proven claim: the leaves recompose `guarantees_root` (anti-omission) AND
// reserves * 10000 >= obligations * ratio_bps  (solvency at the requested band).
//
// 2.3 will add bank_balance (part A, EdDSA attestation) alongside the reserves.

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/bitify.circom";

template Leaf() {
    signal input id;
    signal input obligation;
    signal input active;           // 0 or 1
    signal output out;

    active * (active - 1) === 0;   // boolean

    component h = Poseidon(2);
    h.inputs[0] <== id;
    h.inputs[1] <== obligation;
    out <== active * h.out;        // active ? Poseidon(id, obligation) : 0
}

// Recompose the Poseidon-Merkle root (perfect tree of 2^depth leaves) and sum obligations.
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

    // private (the list — never leaves)
    signal input id[N];
    signal input obligation[N];
    signal input active[N];

    // part A — bank attestation (private: balance + oracle signature)
    signal input bank_balance;
    signal input bank_R8x;
    signal input bank_R8y;
    signal input bank_S;

    // public (cross-checked against on-chain by the attestor)
    signal input guarantees_root;
    signal input vault_stable_assets;
    signal input ratio_bps;
    signal input nonce;            // freshness (anti-replay)
    signal input oracle_Ax;        // bank-oracle public key
    signal input oracle_Ay;

    component b = MerkleRootAndSum(depth);
    var i;
    for (i = 0; i < N; i++) {
        b.id[i] <== id[i];
        b.obligation[i] <== obligation[i];
        b.active[i] <== active[i];
    }

    // Anti-omission: the recomposed root must be the on-chain root.
    b.root === guarantees_root;

    // Part A: verify the oracle's EdDSA-Poseidon signature over M = Poseidon(balance, nonce).
    // Valid signature => the bank balance is what the oracle attested (balance never leaves).
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

    // Reserves = on-chain vault + bank balance (attested).
    signal reserves;
    reserves <== vault_stable_assets + bank_balance;

    // Range-check: bind reserves and obligations to 128 bits BEFORE comparing.
    // Without this, GreaterEqThan(200) is only sound if the operands fit in 200 bits —
    // an implicit invariant that hung correctness on the magnitude of what the oracle
    // signs. With the range-check the comparator's soundness is self-contained: 128 bits cover
    // any real value (stroops << 2^128) and prevent field wraparound.
    component reservesBits = Num2Bits(128);
    reservesBits.in <== reserves;
    component oblBits = Num2Bits(128);
    oblBits.in <== b.obligations;

    // Solvency: reserves * 10000 >= obligations * ratio_bps.
    // (reserves < 2^128 => reserves*10000 < 2^142 < 2^200; ratio_bps is u32 on-chain
    //  => obligations*ratio_bps < 2^160 < 2^200 — operands safe for GreaterEqThan(200).)
    component ge = GreaterEqThan(200);
    ge.in[0] <== reserves * 10000;
    ge.in[1] <== b.obligations * ratio_bps;
    ge.out === 1;
}

component main { public [guarantees_root, vault_stable_assets, ratio_bps, nonce, oracle_Ax, oracle_Ay] } = Solvency(5);
