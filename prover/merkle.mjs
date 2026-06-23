// Reconstrução off-chain da árvore Poseidon-Merkle das garantias (peça B).
//
// Tem que casar BYTE-A-BYTE com o `registry` on-chain:
//  - folha = Poseidon(id, obrigação), obrigação = monthly_amount * (months_covered - months_used)
//  - árvore binária de profundidade fixa TREE_DEPTH, folhas à esquerda, sibling ausente = 0
//  - nó pai = Poseidon(esquerda, direita)
//  - ordem das folhas = ordem de `registry.active_ids()`
//
// O Poseidon do circomlibjs é o mesmo do circomlib e do crate soroban-poseidon (BN254, t=3).
//
// ARQUITETURA DO CIRCUITO (peça B) — IMPORTANTE:
// O circuito (Stage 2) RECOMPÕE A RAIZ INTEIRA a partir de TODAS as folhas e exige
// `raiz_recomposta == guarantees_root` (a raiz on-chain, da lista completa) + soma TODAS as
// obrigações. É isso que impede a omissão: deixar uma garantia de fora muda a raiz, que então
// não bate com a on-chain. Por isso o prover entrega a LISTA COMPLETA DE FOLHAS (ordenada como
// `active_ids()`) — e NÃO provas de inclusão por-folha (caminhos Merkle), que não impediriam
// omissão. Logo, este módulo expõe `computeRoot` + a lista de folhas, sem `merklePath`.

import { buildPoseidon } from "circomlibjs";

export const TREE_DEPTH = 8;

/** Constrói o hasher Poseidon (t=3 / 2 entradas). Retorna h2(a,b) -> bigint. */
export async function makeHasher() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const h2 = (a, b) => F.toObject(poseidon([a, b]));
  return { h2, F };
}

/** Folha de uma garantia. */
export function leaf(h2, id, obligation) {
  return h2(BigInt(id), BigInt(obligation));
}

/** Raiz da árvore de profundidade fixa (folhas à esquerda, resto = zero). */
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

/** bigint -> "0x" + 64 hex chars big-endian (formato de BytesN<32> do registry). */
export function toHex32(x) {
  return "0x" + x.toString(16).padStart(64, "0");
}
