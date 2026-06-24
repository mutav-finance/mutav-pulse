//! Embute a verification_key.json (snarkjs) no contrato em tempo de build, como
//! constantes de bytes — sem storage. Gera `vk.rs` em OUT_DIR; o `lib.rs` o inclui.
//!
//! Layout (igual ao host BN254 do Soroban):
//!   - G1: x || y, cada Fq big-endian 32 bytes (64 bytes).
//!   - G2: x.c1 || x.c0 || y.c1 || y.c0 (ordem Ethereum/Soroban), cada Fq BE 32 bytes (128).
//!
//! VK: por padrão lê `../../circuits/verification_key.json` (nosso circuito único);
//! sobreponível via env `VERIFIER_VK_JSON`.
//!
//! Versão enxuta do mecanismo da Nethermind (build.rs + circuit-keys): aqui só
//! dependemos de serde_json + num-bigint, sem arrastar ark-*.

use std::{env, fmt::Write as _, fs, path::PathBuf};

use num_bigint::BigUint;
use serde_json::Value;

fn main() {
    println!("cargo:rerun-if-env-changed=VERIFIER_VK_JSON");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR not set"));
    let path = env::var("VERIFIER_VK_JSON").unwrap_or_else(|_| {
        let manifest = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set");
        format!("{manifest}/../../circuits/verification_key.json")
    });
    println!("cargo:rerun-if-changed={path}");
    let json = fs::read_to_string(&path).unwrap_or_else(|e| panic!("failed to read VK `{path}`: {e}"));
    fs::write(out_dir.join("vk.rs"), vk_rs_from_json(&json)).expect("failed to write vk.rs");
}

/// decimal string -> 32-byte big-endian.
fn fe32(dec: &str) -> [u8; 32] {
    let n = BigUint::parse_bytes(dec.as_bytes(), 10).expect("invalid decimal field element");
    let be = n.to_bytes_be();
    assert!(be.len() <= 32, "field element exceeds 32 bytes");
    let mut out = [0u8; 32];
    out[32 - be.len()..].copy_from_slice(&be);
    out
}

fn g1_bytes(p: &Value) -> [u8; 64] {
    let a = p.as_array().expect("G1 must be array");
    let x = fe32(a[0].as_str().expect("G1.x string"));
    let y = fe32(a[1].as_str().expect("G1.y string"));
    let mut o = [0u8; 64];
    o[..32].copy_from_slice(&x);
    o[32..].copy_from_slice(&y);
    o
}

fn g2_bytes(p: &Value) -> [u8; 128] {
    let a = p.as_array().expect("G2 must be array");
    let x = a[0].as_array().expect("G2.x array");
    let y = a[1].as_array().expect("G2.y array");
    let xc0 = fe32(x[0].as_str().expect("G2.x.c0"));
    let xc1 = fe32(x[1].as_str().expect("G2.x.c1"));
    let yc0 = fe32(y[0].as_str().expect("G2.y.c0"));
    let yc1 = fe32(y[1].as_str().expect("G2.y.c1"));
    let mut o = [0u8; 128];
    o[..32].copy_from_slice(&xc1);
    o[32..64].copy_from_slice(&xc0);
    o[64..96].copy_from_slice(&yc1);
    o[96..].copy_from_slice(&yc0);
    o
}

fn fmt_bytes(bytes: &[u8]) -> String {
    let mut s = String::from("[");
    for (i, b) in bytes.iter().enumerate() {
        if i > 0 {
            s.push(',');
        }
        write!(s, "0x{b:02x}").expect("write");
    }
    s.push(']');
    s
}

fn vk_rs_from_json(json: &str) -> String {
    let v: Value = serde_json::from_str(json).expect("VK not valid JSON");
    let alpha = g1_bytes(&v["vk_alpha_1"]);
    let beta = g2_bytes(&v["vk_beta_2"]);
    let gamma = g2_bytes(&v["vk_gamma_2"]);
    let delta = g2_bytes(&v["vk_delta_2"]);
    let ic_arr = v["IC"].as_array().expect("IC array");
    let ic_len = ic_arr.len();
    let ic_items: Vec<String> = ic_arr.iter().map(|p| fmt_bytes(&g1_bytes(p))).collect();

    let mut out = String::new();
    writeln!(out, "// Auto-gerado por build.rs — não editar.").unwrap();
    writeln!(out, "const VK_ALPHA_G1: [u8; 64] = {};", fmt_bytes(&alpha)).unwrap();
    writeln!(out, "const VK_BETA_G2: [u8; 128] = {};", fmt_bytes(&beta)).unwrap();
    writeln!(out, "const VK_GAMMA_G2: [u8; 128] = {};", fmt_bytes(&gamma)).unwrap();
    writeln!(out, "const VK_DELTA_G2: [u8; 128] = {};", fmt_bytes(&delta)).unwrap();
    writeln!(out, "const VK_IC: [[u8; 64]; {ic_len}] = [{}];", ic_items.join(",")).unwrap();
    out
}
