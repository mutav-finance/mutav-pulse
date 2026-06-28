/**
 * lib/admin-account.ts — reads + pure helpers for the admin multisig account.
 *
 * The Soroban contracts gate on a single admin Address pointed at a classic
 * Stellar account. To let several people act as admin without sharing a key, we
 * make that account a multisig: each person's wallet pubkey is a weight-1 signer,
 * thresholds stay at 1 (any one signer authorizes). This module reads the signer
 * set from Horizon and exposes the pure membership/validation helpers. The
 * signer-mutating `set_options` ops live in lib/admin-account-tx.ts (they pull in
 * the wallet kit) — same reads-vs-writes split as contracts.ts / admin-tx.ts.
 */

import { StrKey } from "@stellar/stellar-sdk";
import { config } from "./config";

export interface AccountSigner {
  /** The signer's public key (G… for ed25519 account signers). */
  key: string;
  /** Signer weight (0–255). Setting weight 0 via set_options removes the signer. */
  weight: number;
}

export interface AdminAccount {
  /** The account address whose signers gate admin authority. */
  address: string;
  signers: AccountSigner[];
  thresholds: { low: number; med: number; high: number };
}

/**
 * Read the admin account's signer set + thresholds from Horizon.
 *
 * Any non-OK status throws: a 404 means the admin account doesn't exist on-chain
 * (a real misconfiguration, not an empty signer set to silently render), and any
 * other status is transient — throw so the UI surfaces it and retries rather than
 * mislabelling the multisig state. Mirrors lib/trustline.ts `readAssetInfo`.
 */
export async function readAdminAccount(address: string): Promise<AdminAccount> {
  const res = await fetch(`${config.horizonUrl}/accounts/${address}`);
  if (!res.ok) {
    throw new Error(
      `Horizon request failed (${res.status} ${res.statusText}) while reading the admin account ${address}.`,
    );
  }
  const data = await res.json();
  const signers: AccountSigner[] = (data.signers ?? []).map(
    (s: { key: string; weight: number }) => ({ key: s.key, weight: s.weight }),
  );
  const t = data.thresholds ?? {};
  return {
    address,
    signers,
    thresholds: {
      low: t.low_threshold ?? 0,
      med: t.med_threshold ?? 0,
      high: t.high_threshold ?? 0,
    },
  };
}

/** Case-insensitive membership: is `address` a signer of this set? */
export function isSigner(
  signers: AccountSigner[],
  address: string | null | undefined,
): boolean {
  if (!address) return false;
  const a = address.toLowerCase();
  return signers.some((s) => s.key.toLowerCase() === a);
}

/** True when `value` is a valid ed25519 (G…) public key (whitespace tolerated). */
export function isValidPubkey(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value.trim());
}
