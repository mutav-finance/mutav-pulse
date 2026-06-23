// Prover service (Stage 3) — gera proof.json/public.json a partir de dados REAIS da testnet.
//
// Fluxo:
//   1. lê on-chain: registry.active_ids() + get(id) + guarantees_root(); vault.stable_assets()
//   2. monta o witness: peça B (folhas reais na ordem de active_ids, padding a 2^depth) +
//      peça A (atestação de banco SIMULADA, assinada com EdDSA-Poseidon por uma chave-oráculo fixa)
//   3. snarkjs groth16 fullProve -> proof.json / public.json
//   4. re-verifica off-chain (snarkjs verify) + sanity: raiz recomposta == raiz on-chain,
//      vault_stable_assets == on-chain.
//
// Uso: node prove.mjs [bank_balance] [ratio_bps]
//   bank_balance: saldo do banco SIMULADO em stroops (default 100000000000 = 10.000 USDC). Peça A.
//   ratio_bps:    faixa a provar (default 10000 = 100%).
//
// O que é REAL vs SIMULADO (declarar no README, Stage 7):
//   REAL: garantias + raiz + stable_assets lidos da testnet; a matemática da prova; a verificação.
//   SIMULADO: a atestação do banco (peça A) — chave-oráculo fixa do hackathon (sem Open Finance).

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { buildPoseidon, buildEddsa } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { computeRoot, leaf as leafFn, toHex32, TREE_DEPTH } from "./merkle.mjs";

const NETWORK = "testnet";
const SOURCE = "mutav-test";
// Stage 2.5: registry novo (com guarantees_root) + vault existente reusado (read-only).
const REGISTRY = "CCIIYG572C5HUJKPDVSCYWAJNUUPOEEXKXIURA3DMAPTMETE3HHOU3FC";
const VAULT = "CCOIGCO7JTWHFDAEQPXDONJABKFP2PQ5OBDUWHBTASUPZ4EMFCNESICO";

const BANK_BALANCE = BigInt(process.argv[2] ?? "100000000000"); // 10.000 USDC simulado (peça A)
const RATIO_BPS = (process.argv[3] ?? "10000").toString();
const NONCE = "1";

// Chave-oráculo do banco — FIXA/simulada (mesma do circuits/gen_input.mjs).
const ORACLE_PRV = Buffer.from(
  "0001020304050607080900010203040506070809000102030405060708090001",
  "hex",
);

const here = path.dirname(fileURLToPath(import.meta.url));
const CIRCUITS = path.join(here, "..", "circuits");
const WASM = path.join(CIRCUITS, "solvency_js", "solvency.wasm");
const ZKEY = path.join(CIRCUITS, "solvency_final.zkey");
const VKEY = path.join(CIRCUITS, "verification_key.json");
const OUT = path.join(here, "out");

/** Invoca uma função read-only do contrato e retorna o JSON do resultado (stdout).
 *  Args são constantes do script (contract IDs, nome da fn, id numérico) — sem entrada externa. */
function read(id, fn, ...args) {
  const cmd = ["stellar", "contract", "invoke", "--id", id, "--source", SOURCE,
    "--network", NETWORK, "--", fn, ...args].join(" ");
  const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return JSON.parse(out.trim());
}

async function main() {
  console.error(`[1/4] lendo estado on-chain (testnet)…`);
  const activeIds = read(REGISTRY, "active_ids"); // ex.: [0,1,2,3]
  const onchainRootHex = read(REGISTRY, "guarantees_root"); // "2962a3bb…" (sem 0x)
  const stableAssets = BigInt(read(VAULT, "stable_assets")); // "504200000000"

  const guarantees = activeIds.map((id) => read(REGISTRY, "get", "--id", String(id)));
  const N = 1 << TREE_DEPTH; // 32
  if (activeIds.length > N) throw new Error(`garantias (${activeIds.length}) > capacidade da árvore (${N})`);

  // --- peça B: folhas reais na ordem de active_ids, padding a 32 ---
  const id = Array(N).fill("0");
  const obligation = Array(N).fill("0");
  const active = Array(N).fill("0");
  const obs = [];
  guarantees.forEach((g, i) => {
    const ob = BigInt(g.monthly_amount) * BigInt(g.months_covered - g.months_used);
    id[i] = String(g.id);
    obligation[i] = ob.toString();
    active[i] = g.active ? "1" : "0";
    obs.push(ob);
  });
  const totalObligations = obs.reduce((a, b) => a + b, 0n);

  // --- sanity: raiz recomposta off-chain == raiz on-chain (fail fast antes de provar) ---
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const h2 = (a, b) => F.toObject(poseidon([a, b]));
  const leaves = guarantees.map((g) =>
    leafFn(h2, g.id, BigInt(g.monthly_amount) * BigInt(g.months_covered - g.months_used)),
  );
  const rootField = computeRoot(h2, leaves);
  const rootHex = toHex32(rootField).slice(2);
  if (rootHex !== onchainRootHex) {
    throw new Error(`raiz off-chain (${rootHex}) != on-chain (${onchainRootHex})`);
  }
  console.error(`      active_ids=${JSON.stringify(activeIds)} root=0x${rootHex}`);
  console.error(`      obrigações=${totalObligations} reservas(vault)=${stableAssets} banco(sim)=${BANK_BALANCE}`);

  // --- peça A: atestação de banco simulada, assinada EdDSA-Poseidon sobre M=Poseidon(saldo,nonce) ---
  const eddsa = await buildEddsa();
  const pub = eddsa.prv2pub(ORACLE_PRV);
  const M = poseidon([BANK_BALANCE, BigInt(NONCE)]);
  const sig = eddsa.signPoseidon(ORACLE_PRV, M);

  const input = {
    id,
    obligation,
    active,
    bank_balance: BANK_BALANCE.toString(),
    bank_R8x: F.toObject(sig.R8[0]).toString(),
    bank_R8y: F.toObject(sig.R8[1]).toString(),
    bank_S: sig.S.toString(),
    guarantees_root: rootField.toString(),
    vault_stable_assets: stableAssets.toString(),
    ratio_bps: RATIO_BPS,
    nonce: NONCE,
    oracle_Ax: F.toObject(pub[0]).toString(),
    oracle_Ay: F.toObject(pub[1]).toString(),
  };

  // --- prova ---
  console.error(`[2/4] snarkjs groth16 fullProve…`);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(OUT, "public.json"), JSON.stringify(publicSignals, null, 2));
  fs.writeFileSync(path.join(OUT, "input.json"), JSON.stringify(input, null, 2));

  // --- re-verifica off-chain ---
  console.error(`[3/4] snarkjs groth16 verify…`);
  const vkey = JSON.parse(fs.readFileSync(VKEY, "utf8"));
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!ok) throw new Error("prova NÃO verificou off-chain");

  // --- sanity dos públicos (ordem do circuito: guarantees_root, vault_stable_assets, ratio_bps, nonce, oracle_Ax, oracle_Ay) ---
  console.error(`[4/4] checando sinais públicos…`);
  const [pubRoot, pubStable, pubRatio] = publicSignals;
  if (BigInt(pubRoot) !== rootField) throw new Error(`public root != raiz on-chain`);
  if (BigInt(pubStable) !== stableAssets) throw new Error(`public stable != vault on-chain`);
  if (pubRatio !== RATIO_BPS) throw new Error(`public ratio != pedido`);

  const reserves = stableAssets + BANK_BALANCE;
  const pct = Number((reserves * 10000n) / totalObligations) / 100;
  console.error(`\n✅ prova gerada e verificada (out/proof.json, out/public.json)`);
  console.error(`   reservas=${reserves} obrigações=${totalObligations} cobertura=${pct}% faixa provada=${Number(RATIO_BPS) / 100}%`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\n❌", e.message ?? e);
  process.exit(1);
});
