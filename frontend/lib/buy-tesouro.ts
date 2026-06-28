/**
 * lib/buy-tesouro.ts — "Buy cTSR" for the MTESOURO reserve via Soroswap.
 *
 * cTSR is a Soroban token (a tokenized-treasury test asset). Testers acquire it
 * either from the cTSR faucet (instant) or by swapping cUSD → cTSR on the
 * Soroswap AMM — this module is the swap path. The swap is a CLIENT-SIGNED call
 * to the Soroswap Router (`swap_exact_tokens_for_tokens`) against the seeded
 * cUSD↔cTSR pool; no KYC, no backend, the vault never swaps. A one-time cTSR
 * trustline is required to receive the token (the faucet/balance helpers below
 * are shared with the faucet card).
 *
 * Path tokens are the SACs: cUSD's SAC is already a contract id in env
 * (`config.contracts.usdc`); cTSR's SAC is derived from its classic asset via
 * `Asset.contractId`, so no extra env var is needed.
 */

import { Asset } from "@stellar/stellar-sdk";
import { Client as RouterClient } from "soroswap-router";
import { config } from "./config";
import { makeWriterOpts, submit } from "./wallet";
import { parseToStroops } from "./format";
import {
  readAssetInfo,
  addTrustlineFor,
  type AssetInfo,
} from "./trustline";

export type { AssetInfo };

/**
 * The cTSR classic Asset, failing fast with a clear, named error when the issuer
 * is unconfigured. `config.tesouro.issuer` falls back to "" when
 * NEXT_PUBLIC_TESOURO_ISSUER is unset; `new Asset(code, "")` would otherwise
 * throw a cryptic SDK error. Guard at the source so a misconfigured deploy
 * surfaces an actionable message (and the UI gates the swap on `tesouroSwapEnabled`).
 */
const tesouroAsset = () => {
  if (!config.tesouro.issuer) {
    throw new Error(
      "TESOURO issuer not configured (set NEXT_PUBLIC_TESOURO_ISSUER).",
    );
  }
  return new Asset(config.tesouro.code, config.tesouro.issuer);
};

/** cTSR SAC (Soroban contract) address — the swap path's output token. */
const tesouroSac = () => tesouroAsset().contractId(config.networkPassphrase);
/** [cUSD SAC, cTSR SAC] — the Soroswap swap route (input → output). */
const swapPath = (): string[] => [config.contracts.usdc, tesouroSac()];

/** Read the connected account's cTSR trustline + balance from Horizon. */
export function getTesouroInfo(address: string): Promise<AssetInfo> {
  return readAssetInfo(address, config.tesouro.code, config.tesouro.issuer);
}

/** Build + sign a change_trust establishing a cTSR trustline (permissionless). */
export function addTesouroTrustline(address: string): Promise<string> {
  return addTrustlineFor(address, tesouroAsset());
}

/** Read-only Soroswap Router client (simulation only — no signing). */
const readRouter = () =>
  new RouterClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.soroswapRouter,
    networkPassphrase: config.networkPassphrase,
  });

/**
 * Swap `sendUsdc` (decimal cUSD) for cTSR via the Soroswap Router.
 * `slippageBps` (default 100 = 1%) floors `amount_out_min` off the live quote so
 * the swap reverts rather than filling far below quote. Returns the tx hash.
 */
export async function buyTesouro(
  address: string,
  sendUsdc: string,
  slippageBps = 100,
): Promise<string> {
  const amountIn = parseToStroops(sendUsdc);
  if (amountIn === null || amountIn <= 0n) {
    throw new Error(`Invalid cUSD amount "${sendUsdc}"`);
  }
  // Quote, then floor by slippage. Compute in exact stroops (BigInt only) and
  // never let the floor collapse to 0 — a 0 amount_out_min means NO slippage
  // protection and the swap could fill at any rate.
  const quote = await readRouter().router_get_amounts_out({
    amount_in: amountIn,
    path: swapPath(),
  });
  const estOut = quote.result.unwrap().at(-1) ?? 0n;
  let minOut = (estOut * BigInt(10_000 - slippageBps)) / 10_000n;
  if (minOut < 1n) minOut = 1n;

  // Soroban deadline is unix seconds (u64). Date.now is fine in the browser.
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 180);

  const client = new RouterClient(
    makeWriterOpts(address, config.contracts.soroswapRouter),
  );
  const tx = await client.swap_exact_tokens_for_tokens({
    amount_in: amountIn,
    amount_out_min: minOut,
    path: swapPath(),
    to: address,
    deadline,
  });
  return submit(tx);
}
