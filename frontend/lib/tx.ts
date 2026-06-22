/**
 * lib/tx.ts — Write helpers for the vault contract
 *
 * Each helper builds a vault binding client with the caller's public key and
 * a signTransaction function from lib/wallet, assembles the transaction, and
 * calls signAndSend(). Returns the confirmed transaction hash.
 *
 * Amounts are in i128 stroops (1 USDC = 10_000_000n stroops).
 *
 * Usage:
 *   import { deposit, requestRedeem, claim, cancelRedeem } from "@/lib/tx";
 *   const hash = await deposit(address, 100_000_000n); // deposit 10 USDC
 */

import { Client as VaultClient } from "vault";
import { config } from "./config";
import { makeSignTransaction } from "./wallet";

/**
 * Build a vault client bound to the caller's address and sign function.
 * The signTransaction returned by makeSignTransaction() is compatible with
 * the binding client's ContractClientOptions.
 */
function vaultWriter(address: string): VaultClient {
  return new VaultClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.vault,
    networkPassphrase: config.networkPassphrase,
    publicKey: address,
    signTransaction: makeSignTransaction(address),
  });
}

/**
 * Deposit USDC into the vault and receive mtvR shares.
 *
 * @param from    - Depositor's Stellar public key (must be connected)
 * @param amount  - Amount in stroops (bigint). e.g. 100 USDC = 1_000_000_000n
 * @returns       - Confirmed transaction hash
 */
export async function deposit(from: string, amount: bigint): Promise<string> {
  const client = vaultWriter(from);
  const tx = await client.deposit({ from, amount });
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("transaction did not return a hash");
  return hash;
}

/**
 * Request a redemption — escrows `shares` and queues a redemption request.
 *
 * @param owner   - Share owner's Stellar public key
 * @param shares  - Shares to redeem in stroops (bigint)
 * @returns       - Confirmed transaction hash
 */
export async function requestRedeem(
  owner: string,
  shares: bigint,
): Promise<string> {
  const client = vaultWriter(owner);
  const tx = await client.request_redeem({ owner, shares });
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("transaction did not return a hash");
  return hash;
}

/**
 * Claim a fulfilled redemption request — releases USDC to the owner.
 *
 * @param caller  - Caller's Stellar public key (must be owner or admin)
 * @param id      - Redemption request ID (u32, as bigint for convenience)
 * @returns       - Confirmed transaction hash
 */
export async function claim(caller: string, id: bigint): Promise<string> {
  const client = vaultWriter(caller);
  const tx = await client.claim({ id: Number(id) });
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("transaction did not return a hash");
  return hash;
}

/**
 * Cancel an unfulfilled redemption request — returns escrowed shares.
 *
 * @param caller  - Caller's Stellar public key (must be owner)
 * @param id      - Redemption request ID (u32, as bigint for convenience)
 * @returns       - Confirmed transaction hash
 */
export async function cancelRedeem(caller: string, id: bigint): Promise<string> {
  const client = vaultWriter(caller);
  const tx = await client.cancel_redeem({ id: Number(id) });
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("transaction did not return a hash");
  return hash;
}
