/**
 * lib/buy-tesouro.ts — Client-side "Buy TESOURO" for the MBRL reserve.
 *
 * A Soroban contract cannot reach the classic SDEX, so acquiring TESOURO is a
 * CLIENT-SIGNED classic path payment (USDC → TESOURO) on the SDEX, plus a
 * one-time trustline. No KYC — TESOURO is auth_required=false. Mirrors the
 * trustline/balance patterns in lib/faucet.ts and submits via wallet.signAndSubmit
 * (Soroban RPC accepts classic ops). The vault never swaps; users arrive holding
 * TESOURO, then deposit it.
 */

import {
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { signAndSubmit, rpcServer } from "./wallet";
import { parseToStroops, stroopsToInput } from "./format";
import {
  readAssetInfo,
  addTrustlineFor,
  type AssetInfo,
} from "./trustline";

export type { AssetInfo };

/**
 * Build the TESOURO Asset, failing fast with a clear, named error when the issuer
 * is unconfigured. `config.tesouro.issuer` falls back to "" when
 * NEXT_PUBLIC_TESOURO_ISSUER is unset; `new Asset(code, "")` would otherwise
 * throw a cryptic SDK error deep in the trustline/swap flow. Guard at the source
 * so a misconfigured deploy surfaces an actionable message (and the UI can gate
 * the Buy action up front — see `tesouroConfigured` in lib/config).
 */
const tesouroAsset = () => {
  if (!config.tesouro.issuer) {
    throw new Error(
      "TESOURO issuer not configured (set NEXT_PUBLIC_TESOURO_ISSUER).",
    );
  }
  return new Asset(config.tesouro.code, config.tesouro.issuer);
};
const usdcAsset = () => new Asset(config.usdc.code, config.usdc.issuer);

/** Read the connected account's TESOURO trustline + balance from Horizon. */
export function getTesouroInfo(address: string): Promise<AssetInfo> {
  return readAssetInfo(address, config.tesouro.code, config.tesouro.issuer);
}

/** Build + sign a change_trust establishing a TESOURO trustline (permissionless). */
export function addTesouroTrustline(address: string): Promise<string> {
  return addTrustlineFor(address, tesouroAsset());
}

/**
 * Quote a strict-send USDC→TESOURO path from Horizon. Returns the best path's
 * estimated destination amount (7-dec string) + the intermediary Asset[] for
 * pathPaymentStrictSend. Throws if no path exists (no SDEX liquidity).
 */
export async function quoteBuyTesouro(
  sendUsdc: string,
): Promise<{ destEstimate: string; path: Asset[] }> {
  const sa = usdcAsset();
  const params = new URLSearchParams({
    source_asset_type: sa.getAssetType(),
    source_asset_code: sa.getCode(),
    source_asset_issuer: sa.getIssuer(),
    source_amount: sendUsdc,
    destination_assets: `${config.tesouro.code}:${config.tesouro.issuer}`,
  });
  const res = await fetch(`${config.horizonUrl}/paths/strict-send?${params}`);
  if (!res.ok) throw new Error(`Horizon path quote failed (${res.status})`);
  const data = await res.json();
  const records: Array<{
    destination_amount: string;
    path: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
  }> = data?._embedded?.records ?? [];
  if (records.length === 0) {
    throw new Error("No USDC→TESOURO path — insufficient SDEX liquidity");
  }
  const best = records[0];
  const path = (best.path ?? []).map((p) =>
    p.asset_type === "native"
      ? Asset.native()
      : new Asset(p.asset_code!, p.asset_issuer!),
  );
  return { destEstimate: best.destination_amount, path };
}

/**
 * Buy TESOURO with `sendUsdc` (decimal USDC) via a strict-send path payment.
 * `slippageBps` (default 100 = 1%) sets destMin from the Horizon quote so the
 * swap reverts rather than filling far below quote. Returns the tx hash.
 */
export async function buyTesouro(
  address: string,
  sendUsdc: string,
  slippageBps = 100,
): Promise<string> {
  const { destEstimate, path } = await quoteBuyTesouro(sendUsdc);
  // destMin = estimate * (10000 - slippageBps) / 10000, in exact stroops.
  // Parse + format through BigInt only (no lossy parseFloat/Number round-trip),
  // and never let the floor collapse to 0 — a 0 destMin means NO slippage
  // protection and the swap could fill at any rate.
  const estStroops = parseToStroops(destEstimate);
  if (estStroops === null) {
    throw new Error(`Invalid quote from Horizon (destEstimate="${destEstimate}")`);
  }
  let minStroops = (estStroops * BigInt(10_000 - slippageBps)) / 10_000n;
  if (minStroops < 1n) minStroops = 1n;
  const destMin = stroopsToInput(minStroops);

  const account = await rpcServer().getAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: usdcAsset(),
        sendAmount: sendUsdc,
        destination: address,
        destAsset: tesouroAsset(),
        destMin,
        path,
      }),
    )
    .setTimeout(180)
    .build();
  return signAndSubmit(tx.toXDR(), address);
}
