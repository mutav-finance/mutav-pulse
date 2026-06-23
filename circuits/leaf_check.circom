pragma circom 2.0.0;

// Verificação do elo do Poseidon (Stage 2, passo 0): a folha calculada DENTRO do
// circuito tem que ser idêntica à do `registry` on-chain (soroban-poseidon) e à da
// reconstrução off-chain (circomlibjs). folha = Poseidon(id, obrigação), t=3.
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
