#![cfg(test)]
//! "Emenda" do Stage 4: a prova real do snarkjs (circuits/proof.json, fixa e
//! commitada) verifica DENTRO do contrato, contra a VK embutida pelo build.rs.
//! Fecha o item que o Stage 0 deixou em aberto (prova real verificada in-contract).

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
        "prova real do snarkjs deve verificar in-contract (emenda)"
    );
}

#[test]
fn rejects_tampered_public_input() {
    let env = Env::default();
    let (proof, _) = load(&env);
    // adultera o 1º público (guarantees_root) -> pareamento falha.
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
    pubs.push_back(fe(&env, PUBLIC_HEX[0])); // só 1 de 6
    assert!(matches!(
        groth16_verify(&env, proof, pubs),
        Err(Groth16Error::MalformedPublicInputs)
    ));
}
