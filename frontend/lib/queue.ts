/**
 * lib/queue.ts — Redemption queue state classification
 *
 * `classifyRequest` maps the on-chain RedeemRequest fields to a UI-friendly
 * status string. The priority order is:
 *   claimed → check claimed flag first (terminal state)
 *   claimable → fulfilled but not yet claimed
 *   pending → not yet fulfilled (in queue)
 */

export type RequestStatus = "pending" | "claimable" | "claimed";

export function classifyRequest(r: {
  fulfilled: boolean;
  claimed: boolean;
  claimable: bigint;
}): RequestStatus {
  if (r.claimed) return "claimed";
  if (r.fulfilled) return "claimable";
  return "pending";
}
