/**
 * lib/trustline.ts — shared classic-asset primitives.
 *
 * Both the demo-USDC faucet (lib/faucet.ts) and the TESOURO swap
 * (lib/buy-tesouro.ts) need the same two operations against different assets:
 * read a trustline + balance from Horizon, and build/sign a change_trust. Kept
 * here so the careful Horizon error handling (404 → "no trustline"; any other
 * non-OK status → THROW, never silently mislabelled) and the change_trust build
 * live in ONE place instead of being copy-pasted per asset.
 */

import {
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { signAndSubmit, rpcServer } from "./wallet";

export interface AssetInfo {
  /** True when the account holds a trustline to the asset. */
  hasTrustline: boolean;
  /** Human-readable balance string (e.g. "12.3456789"); "0" when no trustline. */
  balance: string;
}

/**
 * Read an account's trustline existence + balance for a classic asset from Horizon.
 *
 * 404 = account not found on Horizon → genuinely no trustline (unfunded or never
 * created). Any other non-OK status is a transient/server error and MUST NOT be
 * silently read as "no trustline" — throw so callers can surface it and retry
 * instead of mislabelling the faucet state.
 */
export async function readAssetInfo(
  address: string,
  code: string,
  issuer: string,
): Promise<AssetInfo> {
  const res = await fetch(`${config.horizonUrl}/accounts/${address}`);
  if (res.status === 404) return { hasTrustline: false, balance: "0" };
  if (!res.ok) {
    throw new Error(
      `Horizon request failed (${res.status} ${res.statusText}) while reading the ${code} trustline.`,
    );
  }
  const data = await res.json();
  const line = (data.balances ?? []).find(
    (b: { asset_code?: string; asset_issuer?: string }) =>
      b.asset_code === code && b.asset_issuer === issuer,
  );
  if (!line) return { hasTrustline: false, balance: "0" };
  return { hasTrustline: true, balance: line.balance ?? "0" };
}

/**
 * Build and sign a `change_trust` establishing a trustline to `asset`.
 * Classic operation — signed by the user's wallet, submitted via Soroban RPC.
 */
export async function addTrustlineFor(
  address: string,
  asset: Asset,
): Promise<string> {
  const account = await rpcServer().getAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();
  return signAndSubmit(tx.toXDR(), address);
}
