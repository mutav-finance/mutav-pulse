// Anti-tamper demo (Stage 6.2) — the "crown jewel" of the ZK seal.
//
// Proves, reproducibly and live (reads the real testnet state), that you CANNOT
// forge solvency by hiding or shrinking a guarantee:
//
//   [1] HONEST           → proof verifies (green seal).
//   [2] OMISSION + real root → the proof is IMPOSSIBLE to generate: the circuit requires the
//                            leaves to recompute the ON-CHAIN `guarantees_root`; removing a
//                            guarantee changes the recomputed root → constraint fails.
//   [3] OMISSION + fake root → the proof does generate (for the tampered tree), BUT the public
//                            (fake) root ≠ on-chain root. The attestor reads the root LIVE,
//                            so on-chain verification rejects it (red seal).
//                            With --submit, it really submits and shows the on-chain revert.
//
// Usage: node anti-tamper.mjs [bank_balance] [ratio_bps] [--submit]
//
// What is REAL vs SIMULATED: same as prove.mjs — guarantees/root/reserves are real from the
// testnet; the bank attestation (piece A) is simulated (fixed hackathon oracle key).

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { buildPoseidon, buildEddsa } from "circomlibjs";
import * as snarkjs from "snarkjs";
import { computeRoot, leaf as leafFn, toHex32, TREE_DEPTH } from "./merkle.mjs";

const NETWORK = "testnet";
const SOURCE = "mutav-test";
const REGISTRY = "CCIIYG572C5HUJKPDVSCYWAJNUUPOEEXKXIURA3DMAPTMETE3HHOU3FC";
const VAULT = "CAJ2L2JBV3B5JZDOQNAKU6SZSIDB354VFCPRAAXHD5FD73WFXSRWPBMR";
const ATTESTOR = "CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT";

const argv = process.argv.slice(2).filter((a) => a !== "--submit");
const SUBMIT = process.argv.includes("--submit");
const BANK_BALANCE = BigInt(argv[0] ?? "100000000000"); // 10,000 USDC simulated
const RATIO_BPS = (argv[1] ?? "10000").toString();
const NONCE = Math.floor(Date.now() / 1000).toString();

// Bank oracle key — FIXED/simulated (same as prove.mjs / gen_input.mjs).
const ORACLE_PRV = Buffer.from(
  "0001020304050607080900010203040506070809000102030405060708090001",
  "hex",
);

const here = path.dirname(fileURLToPath(import.meta.url));
const CIRCUITS = path.join(here, "..", "circuits");
const WASM = path.join(CIRCUITS, "solvency_js", "solvency.wasm");
const ZKEY = path.join(CIRCUITS, "solvency_final.zkey");

function read(id, fn, ...args) {
  const cmd = ["stellar", "contract", "invoke", "--id", id, "--source", SOURCE,
    "--network", NETWORK, "--", fn, ...args].join(" ");
  try {
    return JSON.parse(execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
  } catch (e) {
    throw new Error(`failed to read ${fn} from ${id}:\n${(e.stderr || e.message || "").toString().trim()}`);
  }
}

const obligationOf = (g) => {
  const rem = BigInt(g.months_covered) - BigInt(g.months_used);
  const ob = BigInt(g.monthly_amount) * (rem > 0n ? rem : 0n);
  return ob > 0n ? ob : 0n;
};

/** Assembles the circuit input from leaves/obligations + the requested public root. */
function buildInput({ ids, obligations, actives, root, stable, sig, pub, F }) {
  const N = 1 << TREE_DEPTH;
  const id = Array(N).fill("0");
  const obligation = Array(N).fill("0");
  const active = Array(N).fill("0");
  for (let i = 0; i < ids.length; i++) {
    id[i] = String(ids[i]);
    obligation[i] = obligations[i].toString();
    active[i] = actives[i] ? "1" : "0";
  }
  return {
    id, obligation, active,
    bank_balance: BANK_BALANCE.toString(),
    bank_R8x: F.toObject(sig.R8[0]).toString(),
    bank_R8y: F.toObject(sig.R8[1]).toString(),
    bank_S: sig.S.toString(),
    guarantees_root: root.toString(),
    vault_stable_assets: stable.toString(),
    ratio_bps: RATIO_BPS,
    nonce: NONCE,
    oracle_Ax: F.toObject(pub[0]).toString(),
    oracle_Ay: F.toObject(pub[1]).toString(),
  };
}

// --- encoding for the attestor (inline, same as encode-for-soroban.mjs) ---
const fe = (dec) => BigInt(dec).toString(16).padStart(64, "0");
const g1 = (p) => fe(p[0]) + fe(p[1]);
const g2 = (p) => fe(p[0][1]) + fe(p[0][0]) + fe(p[1][1]) + fe(p[1][0]);
const proofHex = (proof) => g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c);

async function main() {
  console.error(`\n══ ANTI-TAMPER DEMO — ZK solvency seal (testnet) ══\n`);

  // --- real on-chain state ---
  const activeIds = read(REGISTRY, "active_ids");
  const onchainRootHex = read(REGISTRY, "guarantees_root");
  const stable = BigInt(read(VAULT, "stable_assets"));
  const guarantees = activeIds.map((gid) => read(REGISTRY, "get", "--id", String(gid)));

  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const h2 = (a, b) => F.toObject(poseidon([a, b]));
  const eddsa = await buildEddsa();
  const pub = eddsa.prv2pub(ORACLE_PRV);
  const sig = eddsa.signPoseidon(ORACLE_PRV, poseidon([BANK_BALANCE, BigInt(NONCE)]));

  const ids = guarantees.map((g) => g.id);
  const obs = guarantees.map((g) => obligationOf(g));
  const honestLeaves = guarantees.map((g) => leafFn(h2, g.id, obligationOf(g)));
  const rootTrue = computeRoot(h2, honestLeaves);
  const rootTrueHex = toHex32(rootTrue).slice(2);

  if (rootTrueHex !== onchainRootHex) {
    throw new Error(`off-chain root (${rootTrueHex}) != on-chain (${onchainRootHex}) — aborting`);
  }
  const totalOb = obs.reduce((a, b) => a + b, 0n);
  console.error(`Real state: ${activeIds.length} guarantees · obligations=${totalOb} · reserves(vault)=${stable} · bank(sim)=${BANK_BALANCE}`);
  console.error(`On-chain root = 0x${onchainRootHex}\n`);

  // cheating target: the guarantee with the LARGEST obligation (hide the biggest liability)
  let j = 0;
  for (let i = 1; i < obs.length; i++) if (obs[i] > obs[j]) j = i;
  console.error(`Cheating target: guarantee id=${ids[j]} (obligation=${obs[j]}, the largest) — trying to HIDE it.\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // [1] HONEST → green
  // ───────────────────────────────────────────────────────────────────────────
  console.error(`[1] HONEST — full list, real root…`);
  const honestInput = buildInput({
    ids, obligations: obs, actives: obs.map(() => true),
    root: rootTrue, stable, sig, pub, F,
  });
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(honestInput, WASM, ZKEY);
    const vkey = JSON.parse(fs.readFileSync(path.join(CIRCUITS, "verification_key.json"), "utf8"));
    const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    const cov = totalOb === 0n ? "∞" : Number((stable + BANK_BALANCE) * 10000n / totalOb) / 100;
    console.error(`    ✅ proof generated and ${ok ? "VERIFIED" : "did NOT verify"} off-chain · coverage=${cov}% → GREEN SEAL\n`);
  } catch (e) {
    console.error(`    ⚠️  honest case failed (insolvent state at band ${RATIO_BPS}?): ${e.message}\n`);
  }

  // tampered arrays: hide guarantee j (active=0, its obligation drops from the sum)
  const tamperActives = obs.map((_, i) => i !== j);
  const tamperLeaves = honestLeaves.map((lf, i) => (i === j ? 0n : lf));
  const rootFalse = computeRoot(h2, tamperLeaves);
  const tamperedTotal = obs.reduce((a, b, i) => (i === j ? a : a + b), 0n);

  // ───────────────────────────────────────────────────────────────────────────
  // [2] OMISSION keeping the ON-CHAIN root → impossible proof
  // ───────────────────────────────────────────────────────────────────────────
  console.error(`[2] OMISSION + REAL root — hides id=${ids[j]} but declares the on-chain root…`);
  console.error(`    (obligations would drop ${totalOb} → ${tamperedTotal}, faking less liability)`);
  const omitInput = buildInput({
    ids, obligations: obs, actives: tamperActives,
    root: rootTrue, /* REAL root, incompatible with the tampered leaves */
    stable, sig, pub, F,
  });
  try {
    await snarkjs.groth16.fullProve(omitInput, WASM, ZKEY);
    console.error(`    ❌ SECURITY FAILURE: the proof was generated (it should not be!)\n`);
    process.exitCode = 2;
  } catch (e) {
    // Only counts as "rejected" if it was the root CONSTRAINT (solvency.circom:110,
    // `b.root === guarantees_root`). Any other error (path/snarkjs/OOM) proves
    // nothing — an anti-tamper demo cannot paint green by mistake.
    const m = (e.message || e).toString();
    if (/line: 110|Solvency|Assert/i.test(m)) {
      console.error(`    ✅ REJECTED at generation: the root recomputed from the tampered leaves ≠ on-chain root`);
      console.error(`       → the circuit requires b.root === guarantees_root. Omitting is IMPOSSIBLE while keeping the real root.\n`);
    } else {
      console.error(`    ⚠️  failed for an UNEXPECTED reason (not the root constraint): ${m}\n`);
      process.exitCode = 2;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [3] OMISSION + FAKE root → proof generates, but the attestor catches it live
  // ───────────────────────────────────────────────────────────────────────────
  console.error(`[3] OMISSION + FAKE root — tampers the leaves AND the public root together…`);
  const forgeInput = buildInput({
    ids, obligations: obs, actives: tamperActives,
    root: rootFalse, /* root of the tampered tree — matches the leaves */
    stable, sig, pub, F,
  });
  let forged;
  try {
    forged = await snarkjs.groth16.fullProve(forgeInput, WASM, ZKEY);
    console.error(`    • forged proof generated (for the tampered tree) — off-chain it "checks out"`);
  } catch (e) {
    console.error(`    (forgery insolvent at the requested band — expected if the hidden liability was not enough): ${e.message}\n`);
    return;
  }
  const rootFalseHex = toHex32(rootFalse).slice(2);
  console.error(`    • FAKE root  = 0x${rootFalseHex}`);
  console.error(`    • REAL root  = 0x${onchainRootHex}`);
  console.error(`    • ${rootFalseHex === onchainRootHex ? "EQUAL (?!)" : "DIFFERENT"} → the attestor reads the REAL root live and rejects the forged proof.\n`);

  if (SUBMIT) {
    console.error(`    --submit: sending the FORGED proof to the attestor (should REVERT with InvalidProof)…`);
    const hex = proofHex(forged.proof);
    const cmd = ["stellar", "contract", "invoke", "--id", ATTESTOR, "--source", SOURCE,
      "--network", NETWORK, "--send=yes", "--", "attest",
      "--proof", hex, "--ratio_bps", RATIO_BPS, "--nonce", NONCE].join(" ");
    try {
      execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      console.error(`    ❌ SECURITY FAILURE: the attestor ACCEPTED the forged proof (it should not!)`);
      process.exitCode = 2;
    } catch (e) {
      // Only "blocked" if the REVERT came from the CONTRACT (InvalidProof). A network/infra
      // failure in the invoke never reached the attestor — it cannot be reported as cheating blocked.
      const why = (e.stderr || e.message || "").toString();
      if (/InvalidProof|Error\(Contract/.test(why)) {
        console.error(`    ✅ REVERTED on-chain (InvalidProof) → RED SEAL. Cheating blocked.\n`);
      } else {
        console.error(`    ⚠️  the invoke failed, but NOT due to a contract error (network/infra?) — inconclusive:`);
        console.error(`        ${why.split("\n").find((l) => l.trim()) ?? why}\n`);
        process.exitCode = 2;
      }
    }
  } else {
    console.error(`    (run with --submit to see the attestor REVERT the forged proof on-chain.)\n`);
  }

  console.error(`══ Conclusion: anti-omission holds — on-chain root + live verification. ══`);
}

main().catch((e) => { console.error("\n❌", e.message ?? e); process.exit(1); });
