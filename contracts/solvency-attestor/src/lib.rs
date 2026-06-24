#![no_std]
//! solvency_attestor — verifica a prova Groth16 (BN254) do selo de solvência
//! ZK on-chain e grava a "luz verde". A verification key é embutida em tempo de
//! build (ver `build.rs`); o núcleo de verificação é a versão enxuta do
//! `circom-groth16-verifier` da Nethermind (mesmo `pairing_check` BN254).
//!
//! Stage 4 — passo A (este arquivo): só o verificador + VK embutida + teste da
//! "emenda" (prova real do snarkjs verificada DENTRO do contrato). A lógica de
//! negócio (`attest`/`last_attestation`, cross-checks live, pinning, frescor)
//! entra no passo B.

extern crate alloc;

use soroban_sdk::{
    contracterror, contracttype, vec, Bytes, BytesN, Env, Vec,
    crypto::bn254::{Bn254Fr, Bn254G1Affine as G1Affine, Bn254G2Affine as G2Affine},
};

// Constantes da VK geradas pelo build.rs a partir de verification_key.json.
include!(concat!(env!("OUT_DIR"), "/vk.rs"));

/// Erros de verificação Groth16.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    /// O produto de pareamento não deu identidade (prova inválida).
    InvalidProof = 0,
    /// Quantidade de sinais públicos não bate com a VK.
    MalformedPublicInputs = 1,
    /// Bytes da prova malformados.
    MalformedProof = 2,
}

/// Prova Groth16 = pontos A, B, C. B (G2) em ordem Soroban c1||c0.
#[derive(Clone)]
#[contracttype]
pub struct Groth16Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

const G1_SIZE: u32 = 64;
const G2_SIZE: u32 = 128;
/// A (G1) || B (G2) || C (G1) = 64 + 128 + 64.
const PROOF_SIZE: u32 = G1_SIZE + G2_SIZE + G1_SIZE;

impl TryFrom<Bytes> for Groth16Proof {
    type Error = Groth16Error;
    fn try_from(value: Bytes) -> Result<Self, Self::Error> {
        if value.len() != PROOF_SIZE {
            return Err(Groth16Error::MalformedProof);
        }
        let a = G1Affine::from_bytes(
            value.slice(0..G1_SIZE).try_into().map_err(|_| Groth16Error::MalformedProof)?,
        );
        let b = G2Affine::from_bytes(
            value.slice(G1_SIZE..G1_SIZE + G2_SIZE).try_into().map_err(|_| Groth16Error::MalformedProof)?,
        );
        let c = G1Affine::from_bytes(
            value.slice(G1_SIZE + G2_SIZE..).try_into().map_err(|_| Groth16Error::MalformedProof)?,
        );
        Ok(Self { a, b, c })
    }
}

struct VerificationKey {
    alpha: G1Affine,
    beta: G2Affine,
    gamma: G2Affine,
    delta: G2Affine,
    ic: Vec<G1Affine>,
}

fn embedded_vk(env: &Env) -> VerificationKey {
    let mut ic: Vec<G1Affine> = Vec::new(env);
    for bytes in VK_IC.iter() {
        ic.push_back(G1Affine::from_bytes(BytesN::from_array(env, bytes)));
    }
    VerificationKey {
        alpha: G1Affine::from_bytes(BytesN::from_array(env, &VK_ALPHA_G1)),
        beta: G2Affine::from_bytes(BytesN::from_array(env, &VK_BETA_G2)),
        gamma: G2Affine::from_bytes(BytesN::from_array(env, &VK_GAMMA_G2)),
        delta: G2Affine::from_bytes(BytesN::from_array(env, &VK_DELTA_G2)),
        ic,
    }
}

/// Verifica `proof` contra a VK embutida e os `public_inputs` (na ordem do
/// circuito: guarantees_root, vault_stable_assets, ratio_bps, nonce, oracle_Ax, oracle_Ay).
/// `e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1`.
pub(crate) fn groth16_verify(
    env: &Env,
    proof: Groth16Proof,
    public_inputs: Vec<Bn254Fr>,
) -> Result<bool, Groth16Error> {
    let vk = embedded_vk(env);
    let bn = env.crypto().bn254();

    if public_inputs.len().checked_add(1) != Some(vk.ic.len()) {
        return Err(Groth16Error::MalformedPublicInputs);
    }

    let mut vk_x = vk.ic.get(0).ok_or(Groth16Error::MalformedPublicInputs)?;
    for i in 0..public_inputs.len() {
        let s = public_inputs.get(i).ok_or(Groth16Error::MalformedPublicInputs)?;
        let v = vk.ic.get(i + 1).ok_or(Groth16Error::MalformedPublicInputs)?;
        let prod = bn.g1_mul(&v, &s);
        vk_x = bn.g1_add(&vk_x, &prod);
    }

    #[allow(clippy::arithmetic_side_effects)]
    let neg_a = -proof.a;
    let g1_points = vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c];
    let g2_points = vec![env, proof.b, vk.beta.clone(), vk.gamma.clone(), vk.delta.clone()];

    if bn.pairing_check(g1_points, g2_points) {
        Ok(true)
    } else {
        Err(Groth16Error::InvalidProof)
    }
}

#[cfg(test)]
mod test_fixture;
#[cfg(test)]
mod test;
