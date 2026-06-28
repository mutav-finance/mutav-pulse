/**
 * lib/tx.ts — Write helpers for the vault contract
 *
 * Each helper builds a vault binding client bound to the caller's public key, a
 * signTransaction fn from lib/wallet, AND the target reserve's vault contract id,
 * assembles the transaction, and calls signAndSend(). Returns the confirmed hash.
 *
 * Reserve-parameterized: pass the active reserve's `contracts` so writes hit the
 * correct vault (mirrors `reserveReads(contracts)` on the read side). Amounts are
 * i128 stroops (1 unit = 10_000_000n stroops).
 *
 * Usage:
 *   import { deposit } from "@/lib/tx";
 *   const hash = await deposit(reserve.contracts, address, 100_000_000n);
 */

import { Client as VaultClient } from "vault";
import type { ReserveContracts } from "./contracts";
import { makeWriterOpts, submit } from "./wallet";

/** Build a vault client bound to the caller's address, sign fn, and vault id. */
function vaultWriter(address: string, vaultId: string): VaultClient {
  return new VaultClient(makeWriterOpts(address, vaultId));
}

/**
 * Deposit the reserve's underlying token and receive its currency shares.
 *
 * @param contracts - The target reserve's contract triple (uses `.vault`)
 * @param from      - Depositor's Stellar public key (must be connected)
 * @param amount    - Amount in stroops (bigint)
 */
export async function deposit(
  contracts: ReserveContracts,
  from: string,
  amount: bigint,
): Promise<string> {
  const client = vaultWriter(from, contracts.vault);
  // SEP-0056 deposit: a self-deposit — the connected wallet is the asset source
  // (`from`), the share recipient (`receiver`), and the authorizing `operator`.
  const tx = await client.deposit({
    assets: amount,
    receiver: from,
    from,
    operator: from,
  });
  return submit(tx);
}

/** Request a redemption — escrows `shares` and queues a redemption request. */
export async function requestRedeem(
  contracts: ReserveContracts,
  owner: string,
  shares: bigint,
): Promise<string> {
  const client = vaultWriter(owner, contracts.vault);
  const tx = await client.request_redeem({ owner, shares });
  return submit(tx);
}

/** Claim a fulfilled redemption request — releases the underlying to the owner. */
export async function claim(
  contracts: ReserveContracts,
  caller: string,
  id: bigint,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault);
  const tx = await client.claim({ id: Number(id) });
  return submit(tx);
}

/** Cancel an unfulfilled redemption request — returns escrowed shares. */
export async function cancelRedeem(
  contracts: ReserveContracts,
  caller: string,
  id: bigint,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault);
  const tx = await client.cancel_redeem({ id: Number(id) });
  return submit(tx);
}
