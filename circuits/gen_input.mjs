// Gera o input do circuito solvency.circom (peça A + B) com uma assinatura
// EdDSA-Poseidon real do oráculo-banco (chave simulada/fixa para o hackathon).
//
// Uso: node gen_input.mjs <vault_stable_assets> <ratio_bps> <bank_balance> [tamper]
//   tamper => adultera o bank_balance DEPOIS de assinar (deve fazer a prova falhar).
//
// Garantias fixas: 2 ativas (id 0 e 1, obrigação 600 cada) => obrigações = 1200.

import { buildPoseidon, buildEddsa } from "circomlibjs";
import fs from "fs";

const [vault = "0", ratio = "10000", bank = "0", mode = ""] = process.argv.slice(2);
const NONCE = "1";
const TREE_DEPTH = 5;

const poseidon = await buildPoseidon();
const eddsa = await buildEddsa();
const F = poseidon.F;
const h2 = (a, b) => F.toObject(poseidon([a, b])); // -> bigint, igual ao prover/registry

// --- garantias (2 ativas) ---
const N = 32;
const id = Array(N).fill("0");
const ob = Array(N).fill("0");
const ac = Array(N).fill("0");
id[1] = "1"; ob[0] = "600"; ob[1] = "600"; ac[0] = "1"; ac[1] = "1";

// raiz off-chain depth-5 (mesma do registry/prover)
const leaf = (gid, gob) => h2(BigInt(gid), BigInt(gob));
let level = [leaf(0, 600), leaf(1, 600)];
let zero = 0n;
for (let d = 0; d < TREE_DEPTH; d++) {
  const next = [];
  for (let j = 0; j < level.length; j += 2) {
    next.push(h2(level[j], j + 1 < level.length ? level[j + 1] : zero));
  }
  if (next.length === 0) next.push(h2(zero, zero));
  level = next;
  zero = h2(zero, zero);
}
const root = level[0].toString();

// --- atestação do banco (EdDSA-Poseidon) ---
const prv = Buffer.from("0001020304050607080900010203040506070809000102030405060708090001", "hex");
const pub = eddsa.prv2pub(prv);
const Mf = poseidon([BigInt(bank), BigInt(NONCE)]); // M = Poseidon(saldo, nonce), elemento de campo
const sig = eddsa.signPoseidon(prv, Mf);

const bankInput = mode === "tamper" ? (BigInt(bank) + 1n).toString() : bank;

const input = {
  id, obligation: ob, active: ac,
  bank_balance: bankInput,
  bank_R8x: F.toObject(sig.R8[0]).toString(),
  bank_R8y: F.toObject(sig.R8[1]).toString(),
  bank_S: sig.S.toString(),
  guarantees_root: root,
  vault_stable_assets: vault,
  ratio_bps: ratio,
  nonce: NONCE,
  oracle_Ax: F.toObject(pub[0]).toString(),
  oracle_Ay: F.toObject(pub[1]).toString(),
};
fs.writeFileSync("sv_input.json", JSON.stringify(input));
console.error(`gerado: vault=${vault} bank=${bankInput}${mode === "tamper" ? " (adulterado)" : ""} ratio=${ratio} obrig=1200 root=0x${BigInt(root).toString(16)}`);
