#![cfg(test)]
//! Stage 4 "amendment": the real snarkjs proof (circuits/proof.json, fixed and
//! committed) verifies INSIDE the contract, against the VK embedded by build.rs.
//! Closes the item Stage 0 left open (real proof verified in-contract).

use soroban_sdk::crypto::bn254::Bn254Fr;
use soroban_sdk::{Bytes, BytesN, Env, Vec, U256};
use crate::test_fixture::{PROOF_HEX, PUBLIC_HEX};
use crate::{groth16_verify, Groth16Error, Groth16Proof};

fn unhex<const N: usize>(s: &str) -> [u8; N] {
    let b = s.as_bytes();
    assert_eq!(b.len(), N * 2, "hex length");
    let mut out = [0u8; N];
    let mut i = 0;
    while i < N {
        let pair = core::str::from_utf8(&b[i * 2..i * 2 + 2]).unwrap();
        out[i] = u8::from_str_radix(pair, 16).unwrap();
        i += 1;
    }
    out
}

fn fe(env: &Env, hex: &str) -> Bn254Fr {
    Bn254Fr::from_bytes(BytesN::from_array(env, &unhex::<32>(hex)))
}

fn load(env: &Env) -> (Groth16Proof, Vec<Bn254Fr>) {
    let proof = Groth16Proof::try_from(Bytes::from_array(env, &unhex::<256>(PROOF_HEX)))
        .expect("proof parse");
    let mut pubs: Vec<Bn254Fr> = Vec::new(env);
    for h in PUBLIC_HEX.iter() {
        pubs.push_back(fe(env, h));
    }
    (proof, pubs)
}

#[test]
fn verifies_real_snarkjs_proof() {
    let env = Env::default();
    let (proof, pubs) = load(&env);
    assert_eq!(
        groth16_verify(&env, proof, pubs),
        Ok(true),
        "the real snarkjs proof must verify in-contract (amendment)"
    );
}

#[test]
fn rejects_tampered_public_input() {
    let env = Env::default();
    let (proof, _) = load(&env);
    // tampers with the 1st public input (guarantees_root) -> pairing fails.
    let mut pubs: Vec<Bn254Fr> = Vec::new(&env);
    pubs.push_back(Bn254Fr::from_u256(U256::from_u32(&env, 12345)));
    for h in PUBLIC_HEX.iter().skip(1) {
        pubs.push_back(fe(&env, h));
    }
    assert!(matches!(
        groth16_verify(&env, proof, pubs),
        Err(Groth16Error::InvalidProof)
    ));
}

#[test]
fn rejects_wrong_public_input_count() {
    let env = Env::default();
    let (proof, _) = load(&env);
    let mut pubs: Vec<Bn254Fr> = Vec::new(&env);
    pubs.push_back(fe(&env, PUBLIC_HEX[0])); // only 1 of 6
    assert!(matches!(
        groth16_verify(&env, proof, pubs),
        Err(Groth16Error::MalformedPublicInputs)
    ));
}

// --- attest() end-to-end with registry/vault mocks ---
// The fixture (circuits/proof.json) has: root=PUBLIC_HEX[0], stable=0, ratio=10000,
// nonce=1, oracle=(PUBLIC_HEX[4], PUBLIC_HEX[5]).

use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{contract, contractimpl, Address};
use crate::{SolvencyAttestor, SolvencyAttestorClient, AttestError};

#[contract]
struct MockReg;
#[contractimpl]
impl MockReg {
    pub fn guarantees_root(e: Env) -> BytesN<32> {
        BytesN::from_array(&e, &unhex::<32>(PUBLIC_HEX[0]))
    }
}

#[contract]
struct MockVault;
#[contractimpl]
impl MockVault {
    pub fn stable_assets(_e: Env) -> i128 {
        0 // == public[1] of the fixture
    }
}

fn proof_bytes(e: &Env) -> Bytes {
    Bytes::from_array(e, &unhex::<256>(PROOF_HEX))
}

fn setup(e: &Env) -> SolvencyAttestorClient<'_> {
    e.mock_all_auths();
    let admin = Address::generate(e);
    let reg = e.register(MockReg, ());
    let vault = e.register(MockVault, ());
    let id = e.register(SolvencyAttestor, (admin,));
    let c = SolvencyAttestorClient::new(e, &id);
    c.set_registry(&reg);
    c.set_vault(&vault);
    c.set_oracle(
        &BytesN::from_array(e, &unhex::<32>(PUBLIC_HEX[4])),
        &BytesN::from_array(e, &unhex::<32>(PUBLIC_HEX[5])),
    );
    c
}

#[test]
fn attest_happy_path_records_attestation() {
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = 100); // now=100, nonce=1 -> fresh
    let c = setup(&env);

    assert!(c.last_attestation().is_none());
    c.attest(&proof_bytes(&env), &10_000u32, &1u64);

    let att = c.last_attestation().unwrap();
    assert!(att.solvent);
    assert_eq!(att.ratio_bps, 10_000);
    assert_eq!(att.ts, 100);
}

#[test]
fn attest_rejects_stale_proof() {
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = 1 + 3600 + 1); // outside the window
    let c = setup(&env);
    let r = c.try_attest(&proof_bytes(&env), &10_000u32, &1u64);
    assert_eq!(r, Err(Ok(AttestError::StaleProof)));
}

#[test]
fn attest_rejects_future_proof() {
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = 0); // now < nonce
    let c = setup(&env);
    let r = c.try_attest(&proof_bytes(&env), &10_000u32, &1u64);
    assert_eq!(r, Err(Ok(AttestError::ProofFromFuture)));
}

#[test]
fn attest_rejects_wrong_ratio() {
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = 100);
    let c = setup(&env);
    // ratio 12000 != public[2] (10000) of the fixture -> proof does not verify.
    let r = c.try_attest(&proof_bytes(&env), &12_000u32, &1u64);
    assert_eq!(r, Err(Ok(AttestError::InvalidProof)));
}

#[test]
fn attest_rejects_ratio_below_floor() {
    // Band < 100% (10_000 bps) is rejected BEFORE verifying the proof — the floor
    // ensures `solvent:true` is only recorded for coverage >= 100%.
    let env = Env::default();
    env.ledger().with_mut(|l| l.timestamp = 100);
    let c = setup(&env);
    let r = c.try_attest(&proof_bytes(&env), &5_000u32, &1u64);
    assert_eq!(r, Err(Ok(AttestError::RatioTooLow)));
    assert!(c.last_attestation().is_none(), "nothing must be recorded");
}
