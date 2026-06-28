// Prover service (Stage 3) — generates proof.json/public.json from REAL testnet data.
//
// Flow:
//   1. reads on-chain: registry.active_ids() + get(id) + guarantees_root(); vault.stable_assets()
//   2. assembles the witness: piece B (real leaves in active_ids order, padded to 2^depth) +
//      piece A (SIMULATED bank attestation, signed with EdDSA-Poseidon by a fixed oracle key)
//   3. snarkjs groth16 fullProve -> proof.json / public.json
//   4. re-verifies off-chain (snarkjs verify) + sanity: recomputed root == on-chain root,
//      vault_stable_assets == on-chain.
//
// Usage: node prove.mjs [bank_balance] [ratio_bps] [nonce]
//   bank_balance: SIMULATED bank balance in stroops (default 100000000000 = 10,000 USDC). Piece A.
//   ratio_bps:    band to prove (default 10000 = 100%).
//   nonce:        attestation timestamp (default = now, unix secs). The attestor requires
//                 freshness (now - nonce <= window); the bank oracle signs over this nonce.
//
// What is REAL vs SIMULATED (to declare in the README, Stage 7):
//   REAL: guarantees + root + stable_assets read from the testnet; the proof math; the verification.
//   SIMULATED: the bank attestation (piece A) — fixed hackathon oracle key (no Open Finance).

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { buildPoseidon, buildEddsa } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { computeRoot, leaf as leafFn, toHex32, TREE_DEPTH } from "./merkle.mjs";

const NETWORK = "testnet";
const SOURCE = "mutav-test";
// ZK registry (with guarantees_root, mirrors the live core book) + the live core vault (read-only).
const REGISTRY = "CCIIYG572C5HUJKPDVSCYWAJNUUPOEEXKXIURA3DMAPTMETE3HHOU3FC";
const VAULT = "CAJ2L2JBV3B5JZDOQNAKU6SZSIDB354VFCPRAAXHD5FD73WFXSRWPBMR";

const BANK_BALANCE = BigInt(process.argv[2] ?? "100000000000"); // 10,000 USDC simulated (piece A)
const RATIO_BPS = (process.argv[3] ?? "10000").toString();
const NONCE = (process.argv[4] ?? Math.floor(Date.now() / 1000)).toString(); // timestamp for freshness

// Bank oracle key — FIXED/simulated (same as circuits/gen_input.mjs).
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

/** Invokes a read-only contract function and returns the result JSON (stdout).
 *  Args are script constants (contract IDs, fn name, numeric id) — no external input. */
function read(id, fn, ...args) {
  const cmd = ["stellar", "contract", "invoke", "--id", id, "--source", SOURCE,
    "--network", NETWORK, "--", fn, ...args].join(" ");
  let out;
  try {
    // stderr -> pipe so that, on failure, the CLI's real error surfaces in the exception.
    out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const why = (e.stderr || e.stdout || e.message || "").toString().trim();
    throw new Error(`failed to read ${fn} from ${id}:\n${why}`);
  }
  return JSON.parse(out.trim());
}

async function main() {
  console.error(`[1/4] reading on-chain state (testnet)…`);
  const activeIds = read(REGISTRY, "active_ids"); // e.g.: [0,1,2,3]
  const onchainRootHex = read(REGISTRY, "guarantees_root"); // "2962a3bb…" (without 0x)
  const stableAssets = BigInt(read(VAULT, "stable_assets")); // "504200000000"

  const guarantees = activeIds.map((id) => read(REGISTRY, "get", "--id", String(id)));
  const N = 1 << TREE_DEPTH; // 128 (depth 7)
  if (activeIds.length > N) throw new Error(`guarantees (${activeIds.length}) > tree capacity (${N})`);

  // obligation = monthly_amount * (months_covered - months_used), saturated to >=0 —
  // identical to the registry's `leaf()` (saturating_sub + max(0)), so the root matches
  // even on edge-case data.
  const obligationOf = (g) => {
    const rem = BigInt(g.months_covered) - BigInt(g.months_used);
    const ob = BigInt(g.monthly_amount) * (rem > 0n ? rem : 0n);
    return ob > 0n ? ob : 0n;
  };

  // --- piece B: real leaves in active_ids order, padded to N (= 2^TREE_DEPTH) ---
  const id = Array(N).fill("0");
  const obligation = Array(N).fill("0");
  const active = Array(N).fill("0");
  const obs = [];
  guarantees.forEach((g, i) => {
    const ob = obligationOf(g);
    id[i] = String(g.id);
    obligation[i] = ob.toString();
    active[i] = g.active ? "1" : "0";
    obs.push(ob);
  });
  const totalObligations = obs.reduce((a, b) => a + b, 0n);

  // --- sanity: off-chain recomputed root == on-chain root (fail fast before proving) ---
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const h2 = (a, b) => F.toObject(poseidon([a, b]));
  const leaves = guarantees.map((g) => leafFn(h2, g.id, obligationOf(g)));
  const rootField = computeRoot(h2, leaves);
  const rootHex = toHex32(rootField).slice(2);
  if (rootHex !== onchainRootHex) {
    throw new Error(`off-chain root (${rootHex}) != on-chain (${onchainRootHex})`);
  }
  console.error(`      active_ids=${JSON.stringify(activeIds)} root=0x${rootHex}`);
  console.error(`      obligations=${totalObligations} reserves(vault)=${stableAssets} bank(sim)=${BANK_BALANCE}`);

  // --- solvency pre-check: clear error before fullProve (otherwise snarkjs throws
  //     a cryptic "Assert Failed line 133" when the band constraint fails). ---
  const reserves = stableAssets + BANK_BALANCE;
  if (reserves * 10000n < totalObligations * BigInt(RATIO_BPS)) {
    const haveBps = totalObligations === 0n ? "∞" : (reserves * 10000n / totalObligations).toString();
    throw new Error(
      `insolvent at the requested band: reserves=${reserves} cover ${haveBps} bps of ` +
      `obligations=${totalObligations}, but the band requires ${RATIO_BPS} bps. ` +
      `Lower ratio_bps or raise bank_balance.`,
    );
  }

  // --- piece A: simulated bank attestation, EdDSA-Poseidon signed over M=Poseidon(balance,nonce) ---
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

  // --- proof ---
  console.error(`[2/4] snarkjs groth16 fullProve…`);
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(OUT, "public.json"), JSON.stringify(publicSignals, null, 2));
  fs.writeFileSync(path.join(OUT, "input.json"), JSON.stringify(input, null, 2));

  // --- re-verify off-chain ---
  console.error(`[3/4] snarkjs groth16 verify…`);
  const vkey = JSON.parse(fs.readFileSync(VKEY, "utf8"));
  const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!ok) throw new Error("proof did NOT verify off-chain");

  // --- sanity of the public signals (circuit order: guarantees_root, vault_stable_assets, ratio_bps, nonce, oracle_Ax, oracle_Ay) ---
  console.error(`[4/4] checking public signals…`);
  const [pubRoot, pubStable, pubRatio] = publicSignals;
  if (BigInt(pubRoot) !== rootField) throw new Error(`public root != on-chain root`);
  if (BigInt(pubStable) !== stableAssets) throw new Error(`public stable != vault on-chain`);
  if (pubRatio !== RATIO_BPS) throw new Error(`public ratio != requested`);

  const pct = totalObligations === 0n ? "∞" : Number((reserves * 10000n) / totalObligations) / 100;
  console.error(`\n✅ proof generated and verified (out/proof.json, out/public.json)`);
  console.error(`   reserves=${reserves} obligations=${totalObligations} coverage=${pct}% band proved=${Number(RATIO_BPS) / 100}%`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\n❌", e.message ?? e);
  process.exit(1);
});
