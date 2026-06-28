// Off-chain reconstruction of the guarantees' Poseidon-Merkle tree (piece B).
//
// It must match the on-chain `registry` BYTE-FOR-BYTE:
//  - leaf = Poseidon(id, obligation), obligation = monthly_amount * (months_covered - months_used)
//  - fixed-depth binary tree TREE_DEPTH, leaves to the left, missing sibling = 0
//  - parent node = Poseidon(left, right)
//  - leaf order = order of `registry.active_ids()`
//
// circomlibjs's Poseidon is the same as circomlib's and the soroban-poseidon crate's (BN254, t=3).
//
// CIRCUIT ARCHITECTURE (piece B) — IMPORTANT:
// The circuit (Stage 2) RECOMPUTES THE ENTIRE ROOT from ALL leaves and requires
// `recomputed_root == guarantees_root` (the on-chain root, from the full list) + sums ALL
// obligations. That is what prevents omission: leaving a guarantee out changes the root, which
// then no longer matches the on-chain one. That is why the prover supplies the FULL LIST OF LEAVES
// (ordered like `active_ids()`) — and NOT per-leaf inclusion proofs (Merkle paths), which would not
// prevent omission. Hence this module exposes `computeRoot` + the leaf list, without `merklePath`.

import { buildPoseidon } from "circomlibjs";

// MUST match `TREE_DEPTH` in the registry contract and `Solvency(depth)` in
// solvency.circom. Depth 7 (128 leaves) holds the full active set (cap 90).
export const TREE_DEPTH = 7;

/** Builds the Poseidon hasher (t=3 / 2 inputs). Returns h2(a,b) -> bigint. */
export async function makeHasher() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const h2 = (a, b) => F.toObject(poseidon([a, b]));
  return { h2, F };
}

/** Leaf of a guarantee. */
export function leaf(h2, id, obligation) {
  return h2(BigInt(id), BigInt(obligation));
}

/** Root of the fixed-depth tree (leaves to the left, rest = zero). */
export function computeRoot(h2, leaves, depth = TREE_DEPTH) {
  let level = leaves.slice();
  let zero = 0n;
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let j = 0; j < level.length; j += 2) {
      const left = level[j];
      const right = j + 1 < level.length ? level[j + 1] : zero;
      next.push(h2(left, right));
    }
    if (next.length === 0) next.push(h2(zero, zero));
    level = next;
    zero = h2(zero, zero);
  }
  return level[0];
}

/** bigint -> "0x" + 64 hex chars big-endian (registry's BytesN<32> format). */
export function toHex32(x) {
  return "0x" + x.toString(16).padStart(64, "0");
}
