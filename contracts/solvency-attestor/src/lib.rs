#![no_std]
//! solvency_attestor — verifica a prova Groth16 (BN254) do selo de solvência ZK
//! on-chain e grava a "luz verde". A verification key é embutida em tempo de
//! build (ver `build.rs`); o núcleo de verificação é a versão enxuta do
//! `circom-groth16-verifier` da Nethermind (mesmo `pairing_check` BN254).
//!
//! `attest` é PERMISSIONLESS (a prova é a autorização) e:
//!  - lê `guarantees_root` e `stable_assets` AO VIVO e usa como públicos → a
//!    prova só verifica se foi feita para o estado on-chain atual (cross-check 4.2).
//!  - fixa a pubkey do oráculo-banco em storage (admin) → fecha a forja da peça A.
//!  - exige frescor: `nonce` é o timestamp que o oráculo assinou (janela `WINDOW_SECS`).

extern crate alloc;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Bytes, BytesN,
    Env, Vec, U256,
    crypto::bn254::{Bn254Fr, Bn254G1Affine as G1Affine, Bn254G2Affine as G2Affine},
};
use interfaces::{RegistryClient, VaultClient};

// Constantes da VK geradas pelo build.rs a partir de verification_key.json.
// NB: a VK e o `solvency_final.zkey` (Stage 2) são um PAR — regenerar o zkey
// (novo trusted setup) sem recommitar a `verification_key.json` faria o attestor
// rejeitar provas válidas. Mantê-los em sincronia (ver Stage 7/README).
include!(concat!(env!("OUT_DIR"), "/vk.rs"));

/// Janela de frescor: a atestação do banco (nonce=timestamp) não pode ser mais
/// velha que isto. 1 hora.
const WINDOW_SECS: u64 = 3600;

/// Faixa mínima de cobertura aceita. `solvent` só é gravado `true` se a prova for
/// de pelo menos 100% (10_000 bps). Sem este piso, `attest` aceitaria uma prova
/// válida de faixa baixa (ex.: 50%) e gravaria `solvent:true` mesmo assim — o flag
/// passaria a significar só "existe prova p/ ALGUMA faixa", não "coberto". Com o
/// piso, `solvent:true` carrega significado on-chain (≥ 100%).
const MIN_RATIO_BPS: u32 = 10_000;

// TTL do instance storage (~5s/ledger): se faltar menos que ~7 dias, estende p/
// ~31 dias. Sem isto, a atestação + o wiring (registry/vault/oráculo) expirariam
// e o selo "sumiria" (last_attestation -> None; attest -> NotConfigured).
const TTL_THRESHOLD: u32 = 120_960; // ~7 dias
const TTL_EXTEND_TO: u32 = 535_680; // ~31 dias

// ---------------------------------------------------------------------------
// Verificador Groth16 (BN254) — VK embutida.
// ---------------------------------------------------------------------------

/// Erros de verificação Groth16.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    InvalidProof = 0,
    MalformedPublicInputs = 1,
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

// ---------------------------------------------------------------------------
// Contrato: attest / last_attestation + wiring.
// ---------------------------------------------------------------------------

/// Erros do attestor.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AttestError {
    InvalidProof = 0,
    MalformedPublicInputs = 1,
    MalformedProof = 2,
    /// `now - nonce > WINDOW_SECS` — atestação velha demais.
    StaleProof = 3,
    /// `nonce > now` — atestação "do futuro".
    ProofFromFuture = 4,
    /// registry/vault/oráculo ainda não foram setados.
    NotConfigured = 5,
    /// `ratio_bps < MIN_RATIO_BPS` — faixa abaixo do piso de cobertura (100%).
    RatioTooLow = 6,
}

impl From<Groth16Error> for AttestError {
    fn from(e: Groth16Error) -> Self {
        match e {
            Groth16Error::InvalidProof => AttestError::InvalidProof,
            Groth16Error::MalformedPublicInputs => AttestError::MalformedPublicInputs,
            Groth16Error::MalformedProof => AttestError::MalformedProof,
        }
    }
}

/// A "luz verde" gravada on-chain. `solvent` é sempre true quando gravada (uma
/// prova inválida reverte); o front lê o frescor por `ledger`/`ts`.
#[contracttype]
#[derive(Clone)]
pub struct Attestation {
    pub solvent: bool,
    pub ratio_bps: u32,
    pub ledger: u32,
    pub ts: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    Registry,
    Vault,
    OracleAx,
    OracleAy,
    Last,
}

#[contract]
pub struct SolvencyAttestor;

#[contractimpl]
impl SolvencyAttestor {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn require_admin(e: &Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    fn bump_ttl(e: &Env) {
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn set_registry(e: Env, addr: Address) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::Registry, &addr);
        Self::bump_ttl(&e);
    }

    pub fn set_vault(e: Env, addr: Address) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::Vault, &addr);
        Self::bump_ttl(&e);
    }

    /// Fixa a pubkey EdDSA do oráculo-banco (coords Ax/Ay como field elements BE).
    /// Sem isto, a peça A seria forjável (qualquer prover assinaria com a própria chave).
    pub fn set_oracle(e: Env, ax: BytesN<32>, ay: BytesN<32>) {
        Self::require_admin(&e);
        e.storage().instance().set(&DataKey::OracleAx, &ax);
        e.storage().instance().set(&DataKey::OracleAy, &ay);
        Self::bump_ttl(&e);
    }

    pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin(&e);
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Verifica a prova contra o estado on-chain ao vivo e grava a atestação.
    /// Públicos reconstruídos do estado real: prova feita p/ outro estado não verifica.
    /// `nonce` = timestamp assinado pelo oráculo (frescor). PERMISSIONLESS.
    pub fn attest(e: Env, proof: Bytes, ratio_bps: u32, nonce: u64) -> Result<(), AttestError> {
        // Piso de cobertura: só atesta `solvent` p/ faixa >= 100%. Garante que
        // `solvent:true` signifique "coberto" e não "prova de uma faixa qualquer".
        if ratio_bps < MIN_RATIO_BPS {
            return Err(AttestError::RatioTooLow);
        }

        let registry: Address =
            e.storage().instance().get(&DataKey::Registry).ok_or(AttestError::NotConfigured)?;
        let vault: Address =
            e.storage().instance().get(&DataKey::Vault).ok_or(AttestError::NotConfigured)?;
        let oracle_ax: BytesN<32> =
            e.storage().instance().get(&DataKey::OracleAx).ok_or(AttestError::NotConfigured)?;
        let oracle_ay: BytesN<32> =
            e.storage().instance().get(&DataKey::OracleAy).ok_or(AttestError::NotConfigured)?;

        // Frescor: nonce é o timestamp que o oráculo-banco assinou.
        let now = e.ledger().timestamp();
        if nonce > now {
            return Err(AttestError::ProofFromFuture);
        }
        if now - nonce > WINDOW_SECS {
            return Err(AttestError::StaleProof);
        }

        // Valores AO VIVO (cross-check 4.2 implícito).
        let root: BytesN<32> = RegistryClient::new(&e, &registry).guarantees_root();
        let stable: i128 = VaultClient::new(&e, &vault).stable_assets();
        let stable_u: u128 = if stable < 0 { 0 } else { stable as u128 };

        let proof = Groth16Proof::try_from(proof).map_err(AttestError::from)?;

        // Públicos na ordem do circuito.
        let mut pubs: Vec<Bn254Fr> = Vec::new(&e);
        pubs.push_back(Bn254Fr::from_bytes(root));
        pubs.push_back(Bn254Fr::from_u256(U256::from_u128(&e, stable_u)));
        pubs.push_back(Bn254Fr::from_u256(U256::from_u32(&e, ratio_bps)));
        pubs.push_back(Bn254Fr::from_u256(U256::from_u128(&e, nonce as u128)));
        pubs.push_back(Bn254Fr::from_bytes(oracle_ax));
        pubs.push_back(Bn254Fr::from_bytes(oracle_ay));

        groth16_verify(&e, proof, pubs).map_err(AttestError::from)?;

        let att = Attestation {
            solvent: true,
            ratio_bps,
            ledger: e.ledger().sequence(),
            ts: now,
        };
        e.storage().instance().set(&DataKey::Last, &att);
        Self::bump_ttl(&e);
        // Evento p/ o front reagir sem polling.
        e.events().publish((symbol_short!("attested"),), att);
        Ok(())
    }

    /// Última atestação gravada (None se nunca houve). Leitura pública p/ o front.
    pub fn last_attestation(e: Env) -> Option<Attestation> {
        e.storage().instance().get(&DataKey::Last)
    }
}

#[cfg(test)]
mod test_fixture;
#[cfg(test)]
mod test;
