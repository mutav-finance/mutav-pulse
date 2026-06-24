// Converte um par snarkjs (proof.json + public.json) na representação que o
// contrato solvency_attestor espera:
//   - proof: 256 bytes = A(G1,64) || B(G2,128) || C(G1,64), cada Fq big-endian 32 bytes.
//             G2 em ordem Soroban/Ethereum: x.c1 || x.c0 || y.c1 || y.c0.
//   - public_inputs: cada sinal público como 32 bytes big-endian (field element).
//
// Uso: node encode-for-soroban.mjs <dir>   (dir tem proof.json e public.json)
//   --rust  -> imprime um fixture Rust (consts) para o teste de host do attestor.
//   default -> imprime JSON { proof_hex, public_hex[] } + os args do `stellar contract invoke`.

import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? ".";
const asRust = process.argv.includes("--rust");

const proof = JSON.parse(fs.readFileSync(path.join(dir, "proof.json"), "utf8"));
const pub = JSON.parse(fs.readFileSync(path.join(dir, "public.json"), "utf8"));

/** decimal string -> 32-byte big-endian hex (sem 0x). */
const fe = (dec) => BigInt(dec).toString(16).padStart(64, "0");
/** G1 [x,y,"1"] -> 64 bytes (x||y). */
const g1 = (p) => fe(p[0]) + fe(p[1]);
/** G2 [[x0,x1],[y0,y1],...] -> 128 bytes (x.c1||x.c0||y.c1||y.c0). */
const g2 = (p) => fe(p[0][1]) + fe(p[0][0]) + fe(p[1][1]) + fe(p[1][0]);

const proofHex = g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c);
const publicHex = pub.map(fe);

if ((proofHex.length / 2) !== 256) throw new Error(`proof tem ${proofHex.length / 2} bytes (esperado 256)`);

if (asRust) {
  const pubArr = publicHex.map((h) => `        "${h}",`).join("\n");
  process.stdout.write(`// Fixture gerado por prover/encode-for-soroban.mjs --rust — NÃO editar à mão.
// Prova real do snarkjs (circuits/proof.json) p/ o teste da "emenda" do attestor.
pub const PROOF_HEX: &str = "${proofHex}";
pub const PUBLIC_HEX: [&str; ${publicHex.length}] = [
${pubArr}
];
`);
} else {
  console.log(JSON.stringify({ proof_hex: proofHex, public_hex: publicHex }, null, 2));
}
