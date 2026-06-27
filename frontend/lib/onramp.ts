/**
 * lib/onramp.ts — Testnet on-ramp helpers (trustline + faucet)
 *
 * TESTNET ONLY. These exist because our demo USDC is a mock classic-asset SAC
 * that testers can't otherwise acquire. On mainnet users hold real USDC, so the
 * UI gates these behind `faucetEnabled` (see lib/config.ts) and they never run.
 *
 *   getUsdcInfo(addr)  — read trustline existence + balance from Horizon
 *   addTrustline(addr) — build + sign a change_trust for the demo USDC (user-signed)
 *   dripFaucet(addr)   — call the on-chain faucet to receive demo USDC
 */

import { Asset } from "@stellar/stellar-sdk";
import { Client as FaucetClient } from "faucet";
import { config } from "./config";
import { makeWriterOpts } from "./wallet";
import { readAssetInfo, addTrustlineFor, type AssetInfo } from "./trustline";

/** @deprecated alias kept for existing imports — use AssetInfo from lib/trustline. */
export type UsdcInfo = AssetInfo;

/**
 * Read the connected account's demo-USDC trustline + balance from Horizon.
 * No signing; returns { hasTrustline: false, balance: "0" } for unfunded or
 * trustline-less accounts. Transient (non-404) Horizon errors throw.
 */
export function getUsdcInfo(address: string): Promise<AssetInfo> {
  return readAssetInfo(address, config.usdc.code, config.usdc.issuer);
}

/**
 * Build and sign a `change_trust` establishing a trustline to the demo USDC.
 * Classic operation — signed by the user's wallet, submitted via Soroban RPC.
 */
export function addTrustline(address: string): Promise<string> {
  return addTrustlineFor(address, new Asset(config.usdc.code, config.usdc.issuer));
}

/**
 * Call the on-chain faucet to drip the fixed demo amount to `address`.
 * Requires an existing trustline (reverts otherwise) and the connected wallet
 * authorizing the call.
 */
export async function dripFaucet(address: string): Promise<string> {
  const client = new FaucetClient(makeWriterOpts(address, config.contracts.faucet));
  const tx = await client.drip({ to: address });
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("faucet drip did not return a hash");
  return hash;
}
