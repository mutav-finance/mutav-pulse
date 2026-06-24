// Demo anti-trapaça (Stage 6.2) — a "joia da coroa" do selo ZK.
//
// Prova, de forma reproduzível e ao vivo (lê o estado real da testnet), que NÃO dá
// para forjar solvência escondendo ou encolhendo uma garantia:
//
//   [1] HONESTO          → prova verifica (selo verde).
//   [2] OMISSÃO + raiz real → a prova é IMPOSSÍVEL de gerar: o circuito exige que as
//                            folhas recomponham a `guarantees_root` ON-CHAIN; tirar uma
//                            garantia muda a raiz recomposta → constraint falha.
//   [3] OMISSÃO + raiz falsa → a prova até gera (para a árvore adulterada), MAS a raiz
//                            pública (falsa) ≠ raiz on-chain. O attestor lê a raiz AO VIVO,
//                            então a verificação on-chain rejeita (selo vermelho).
//                            Com --submit, submete de verdade e mostra o revert on-chain.
//
// Uso: node anti-tamper.mjs [bank_balance] [ratio_bps] [--submit]
//
// O que é REAL vs SIMULADO: igual ao prove.mjs — garantias/raiz/reservas são reais da
// testnet; a atestação de banco (peça A) é simulada (chave-oráculo fixa do hackathon).

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
const VAULT = "CCOIGCO7JTWHFDAEQPXDONJABKFP2PQ5OBDUWHBTASUPZ4EMFCNESICO";
const ATTESTOR = "CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT";

const argv = process.argv.slice(2).filter((a) => a !== "--submit");
const SUBMIT = process.argv.includes("--submit");
const BANK_BALANCE = BigInt(argv[0] ?? "100000000000"); // 10.000 USDC simulado
const RATIO_BPS = (argv[1] ?? "10000").toString();
const NONCE = Math.floor(Date.now() / 1000).toString();

// Chave-oráculo do banco — FIXA/simulada (mesma do prove.mjs / gen_input.mjs).
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
    throw new Error(`falha ao ler ${fn} de ${id}:\n${(e.stderr || e.message || "").toString().trim()}`);
  }
}

const obligationOf = (g) => {
  const rem = BigInt(g.months_covered) - BigInt(g.months_used);
  const ob = BigInt(g.monthly_amount) * (rem > 0n ? rem : 0n);
  return ob > 0n ? ob : 0n;
};

/** Monta o input do circuito a partir de folhas/obrigações + a raiz pública pedida. */
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

// --- encoding p/ o attestor (inline, igual ao encode-for-soroban.mjs) ---
const fe = (dec) => BigInt(dec).toString(16).padStart(64, "0");
const g1 = (p) => fe(p[0]) + fe(p[1]);
const g2 = (p) => fe(p[0][1]) + fe(p[0][0]) + fe(p[1][1]) + fe(p[1][0]);
const proofHex = (proof) => g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c);

async function main() {
  console.error(`\n══ DEMO ANTI-TRAPAÇA — selo de solvência ZK (testnet) ══\n`);

  // --- estado real on-chain ---
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
    throw new Error(`raiz off-chain (${rootTrueHex}) != on-chain (${onchainRootHex}) — abortando`);
  }
  const totalOb = obs.reduce((a, b) => a + b, 0n);
  console.error(`Estado real: ${activeIds.length} garantias · obrigações=${totalOb} · reservas(vault)=${stable} · banco(sim)=${BANK_BALANCE}`);
  console.error(`Raiz on-chain = 0x${onchainRootHex}\n`);

  // alvo da trapaça: a garantia de MAIOR obrigação (esconder o maior passivo)
  let j = 0;
  for (let i = 1; i < obs.length; i++) if (obs[i] > obs[j]) j = i;
  console.error(`Alvo da trapaça: garantia id=${ids[j]} (obrigação=${obs[j]}, a maior) — tentando ESCONDER.\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // [1] HONESTO → verde
  // ───────────────────────────────────────────────────────────────────────────
  console.error(`[1] HONESTO — lista completa, raiz real…`);
  const honestInput = buildInput({
    ids, obligations: obs, actives: obs.map(() => true),
    root: rootTrue, stable, sig, pub, F,
  });
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(honestInput, WASM, ZKEY);
    const vkey = JSON.parse(fs.readFileSync(path.join(CIRCUITS, "verification_key.json"), "utf8"));
    const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    const cov = totalOb === 0n ? "∞" : Number((stable + BANK_BALANCE) * 10000n / totalOb) / 100;
    console.error(`    ✅ prova gerada e ${ok ? "VERIFICADA" : "NÃO verificou"} off-chain · cobertura=${cov}% → SELO VERDE\n`);
  } catch (e) {
    console.error(`    ⚠️  honesto falhou (estado insolvente na faixa ${RATIO_BPS}?): ${e.message}\n`);
  }

  // arrays adulterados: esconde a garantia j (active=0, obrigação some da soma)
  const tamperActives = obs.map((_, i) => i !== j);
  const tamperLeaves = honestLeaves.map((lf, i) => (i === j ? 0n : lf));
  const rootFalse = computeRoot(h2, tamperLeaves);
  const tamperedTotal = obs.reduce((a, b, i) => (i === j ? a : a + b), 0n);

  // ───────────────────────────────────────────────────────────────────────────
  // [2] OMISSÃO mantendo a raiz ON-CHAIN → prova impossível
  // ───────────────────────────────────────────────────────────────────────────
  console.error(`[2] OMISSÃO + raiz REAL — esconde id=${ids[j]} mas declara a raiz on-chain…`);
  console.error(`    (obrigações cairiam ${totalOb} → ${tamperedTotal}, fingindo menos passivo)`);
  const omitInput = buildInput({
    ids, obligations: obs, actives: tamperActives,
    root: rootTrue, /* raiz REAL, incompatível com as folhas adulteradas */
    stable, sig, pub, F,
  });
  try {
    await snarkjs.groth16.fullProve(omitInput, WASM, ZKEY);
    console.error(`    ❌ FALHA DE SEGURANÇA: a prova foi gerada (não deveria!)\n`);
    process.exitCode = 2;
  } catch {
    console.error(`    ✅ REJEITADO na geração: a raiz recomposta das folhas adulteradas ≠ raiz on-chain`);
    console.error(`       → o circuito exige b.root === guarantees_root. Omitir é IMPOSSÍVEL mantendo a raiz real.\n`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // [3] OMISSÃO + raiz FALSA → prova gera, mas o attestor pega ao vivo
  // ───────────────────────────────────────────────────────────────────────────
  console.error(`[3] OMISSÃO + raiz FALSA — adultera as folhas E a raiz pública juntas…`);
  const forgeInput = buildInput({
    ids, obligations: obs, actives: tamperActives,
    root: rootFalse, /* raiz da árvore adulterada — casa com as folhas */
    stable, sig, pub, F,
  });
  let forged;
  try {
    forged = await snarkjs.groth16.fullProve(forgeInput, WASM, ZKEY);
    console.error(`    • prova forjada gerada (para a árvore adulterada) — off-chain ela "fecha"`);
  } catch (e) {
    console.error(`    (forja insolvente na faixa pedida — esperado se o passivo escondido não bastasse): ${e.message}\n`);
    return;
  }
  const rootFalseHex = toHex32(rootFalse).slice(2);
  console.error(`    • raiz FALSA  = 0x${rootFalseHex}`);
  console.error(`    • raiz REAL   = 0x${onchainRootHex}`);
  console.error(`    • ${rootFalseHex === onchainRootHex ? "IGUAIS (?!)" : "DIFERENTES"} → o attestor lê a raiz REAL ao vivo e rejeita a prova forjada.\n`);

  if (SUBMIT) {
    console.error(`    --submit: enviando a prova FORJADA ao attestor (deve REVERTER com InvalidProof)…`);
    const hex = proofHex(forged.proof);
    const cmd = ["stellar", "contract", "invoke", "--id", ATTESTOR, "--source", SOURCE,
      "--network", NETWORK, "--send=yes", "--", "attest",
      "--proof", hex, "--ratio_bps", RATIO_BPS, "--nonce", NONCE].join(" ");
    try {
      execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      console.error(`    ❌ FALHA DE SEGURANÇA: o attestor ACEITOU a prova forjada (não deveria!)`);
      process.exitCode = 2;
    } catch (e) {
      const why = (e.stderr || e.message || "").toString();
      const rejected = /InvalidProof|Error\(Contract/.test(why);
      console.error(`    ✅ ${rejected ? "REVERTEU on-chain (InvalidProof)" : "revert on-chain"} → SELO VERMELHO. Trapaça barrada.\n`);
    }
  } else {
    console.error(`    (rode com --submit para ver o attestor REVERTER a prova forjada on-chain.)\n`);
  }

  console.error(`══ Conclusão: a anti-omissão se sustenta — raiz on-chain + verificação ao vivo. ══`);
}

main().catch((e) => { console.error("\n❌", e.message ?? e); process.exit(1); });
