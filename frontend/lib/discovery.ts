/**
 * Discovery seam — the ONLY place reserves are enumerated. Today it reads the
 * static registry (lib/reserves.ts); when the on-chain reserve factory lands,
 * only this file changes (read the factory's registry) — no UI churn.
 */
import { StrKey } from "@stellar/stellar-sdk";
import { RESERVES, type Reserve } from "./reserves";

export function getReserves(): Reserve[] {
  return RESERVES;
}

/** Resolve a reserve by its vault contract address (the canonical ID). */
export function getReserve(vaultAddr: string): Reserve | undefined {
  return RESERVES.find((r) => r.address === vaultAddr);
}

/** A reserve is verified iff its vault address is in the (canonical) registry. */
export function isVerified(vaultAddr: string): boolean {
  return getReserve(vaultAddr) !== undefined;
}

export type AddressResolution = "verified" | "unverified" | "invalid";

/**
 * Classify a route address param:
 *  - "verified"   — a real contract address in the registry
 *  - "unverified" — a syntactically valid contract address we don't recognize
 *  - "invalid"    — not a Stellar contract address at all
 */
export function resolveAddress(addr: string): AddressResolution {
  if (!StrKey.isValidContract(addr)) return "invalid";
  return isVerified(addr) ? "verified" : "unverified";
}
