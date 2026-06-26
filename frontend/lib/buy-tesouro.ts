/**
 * lib/buy-tesouro.ts — Client-side "Buy TESOURO" for the MBRL reserve.
 *
 * A Soroban contract cannot reach the classic SDEX, so acquiring TESOURO is a
 * CLIENT-SIGNED classic path payment (USDC → TESOURO) on the SDEX, plus a
 * one-time trustline. No KYC — TESOURO is auth_required=false. Mirrors the
 * trustline/balance patterns in lib/onramp.ts and submits via wallet.signAndSubmit
 * (Soroban RPC accepts classic ops). The vault never swaps; users arrive holding
 * TESOURO, then deposit it.
 */

import {
  rpc as StellarRpc,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { signAndSubmit } from "./wallet";

const tesouroAsset = () => new Asset(config.tesouro.code, config.tesouro.issuer);
const usdcAsset = () => new Asset(config.usdc.code, config.usdc.issuer);

export interface AssetInfo {
  hasTrustline: boolean;
  /** Human-readable balance string (e.g. "12.3456789"); "0" when no trustline. */
  balance: string;
}

/** Read the connected account's TESOURO trustline + balance from Horizon. */
export async function getTesouroInfo(address: string): Promise<AssetInfo> {
  const res = await fetch(`${config.horizonUrl}/accounts/${address}`);
  if (res.status === 404) return { hasTrustline: false, balance: "0" };
  if (!res.ok) throw new Error(`Horizon ${res.status} reading TESOURO trustline`);
  const data = await res.json();
  const line = (data.balances ?? []).find(
    (b: { asset_code?: string; asset_issuer?: string }) =>
      b.asset_code === config.tesouro.code &&
      b.asset_issuer === config.tesouro.issuer,
  );
  if (!line) return { hasTrustline: false, balance: "0" };
  return { hasTrustline: true, balance: line.balance ?? "0" };
}

/** Build + sign a change_trust establishing a TESOURO trustline (permissionless). */
export async function addTesouroTrustline(address: string): Promise<string> {
  const server = new StellarRpc.Server(config.rpcUrl, { allowHttp: false });
  const account = await server.getAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: tesouroAsset() }))
    .setTimeout(180)
    .build();
  return signAndSubmit(tx.toXDR(), address);
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
  // destMin = estimate * (10000 - slippageBps) / 10000, as a 7-dec string.
  const estStroops = BigInt(Math.round(parseFloat(destEstimate) * 1e7));
  const minStroops = (estStroops * BigInt(10_000 - slippageBps)) / 10_000n;
  const destMin = (Number(minStroops) / 1e7).toFixed(7);

  const server = new StellarRpc.Server(config.rpcUrl, { allowHttp: false });
  const account = await server.getAccount(address);
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
