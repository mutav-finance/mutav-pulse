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

import {
  rpc as StellarRpc,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { Client as FaucetClient } from "faucet";
import { config } from "./config";
import { signAndSubmit, makeSignTransaction } from "./wallet";

export interface UsdcInfo {
  /** True when the account holds a trustline to the demo USDC. */
  hasTrustline: boolean;
  /** Human-readable balance string (e.g. "5000.0000000"); "0" when no trustline. */
  balance: string;
}

/**
 * Read the connected account's demo-USDC trustline + balance from Horizon.
 * No signing; returns { hasTrustline: false, balance: "0" } for unfunded or
 * trustline-less accounts.
 */
export async function getUsdcInfo(address: string): Promise<UsdcInfo> {
  const res = await fetch(`${config.horizonUrl}/accounts/${address}`);
  if (!res.ok) return { hasTrustline: false, balance: "0" };
  const data = await res.json();
  const line = (data.balances ?? []).find(
    (b: { asset_code?: string; asset_issuer?: string }) =>
      b.asset_code === config.usdc.code && b.asset_issuer === config.usdc.issuer,
  );
  if (!line) return { hasTrustline: false, balance: "0" };
  return { hasTrustline: true, balance: line.balance ?? "0" };
}

/**
 * Build and sign a `change_trust` establishing a trustline to the demo USDC.
 * Classic operation — signed by the user's wallet, submitted via Soroban RPC.
 */
export async function addTrustline(address: string): Promise<string> {
  const asset = new Asset(config.usdc.code, config.usdc.issuer);
  const server = new StellarRpc.Server(config.rpcUrl, { allowHttp: false });
  const account = await server.getAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();
  return signAndSubmit(tx.toXDR(), address);
}

/**
 * Call the on-chain faucet to drip the fixed demo amount to `address`.
 * Requires an existing trustline (reverts otherwise) and the connected wallet
 * authorizing the call.
 */
export async function dripFaucet(address: string): Promise<string> {
  const client = new FaucetClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.faucet,
    networkPassphrase: config.networkPassphrase,
    publicKey: address,
    signTransaction: makeSignTransaction(address),
  });
  const tx = await client.drip({ to: address });
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("faucet drip did not return a hash");
  return hash;
}
