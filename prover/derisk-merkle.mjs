// Cross-check da peça B: reconstrói a raiz off-chain (circomlibjs) para conjuntos
// conhecidos e imprime os hex, pra cravar nos testes do registry (on-chain == off-chain).
//
// Garantias = mesmos valores do teste Rust: monthly_amount=100, months_covered=6,
// months_used=0  =>  obrigação = 100 * (6 - 0) = 600, para cada id.
// Testamos n=2 (par) e n=3 (ímpar, exercita o padding de folha ímpar).

import { makeHasher, leaf, computeRoot, toHex32 } from "./merkle.mjs";

const { h2 } = await makeHasher();

for (const ids of [[0, 1], [0, 1, 2]]) {
  const leaves = ids.map((id) => leaf(h2, id, 600));
  const root = computeRoot(h2, leaves);
  console.log(`n=${ids.length} ids=${JSON.stringify(ids)} ROOT = ${toHex32(root)}`);
}
