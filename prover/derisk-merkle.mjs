// Cross-check of piece B: reconstructs the off-chain root (circomlibjs) for known
// sets and prints the hex, to hardcode into the registry tests (on-chain == off-chain).
//
// Guarantees = same values as the Rust test: monthly_amount=100, months_covered=6,
// months_used=0  =>  obligation = 100 * (6 - 0) = 600, for each id.
// We test n=2 (even) and n=3 (odd, exercises the odd-leaf padding).

import { makeHasher, leaf, computeRoot, toHex32 } from "./merkle.mjs";

const { h2 } = await makeHasher();

for (const ids of [[0, 1], [0, 1, 2]]) {
  const leaves = ids.map((id) => leaf(h2, id, 600));
  const root = computeRoot(h2, leaves);
  console.log(`n=${ids.length} ids=${JSON.stringify(ids)} ROOT = ${toHex32(root)}`);
}
