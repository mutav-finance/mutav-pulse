/**
 * lib/admin-tx.ts — Write helpers for admin-gated protocol actions
 *
 * Same assemble→sign→submit pattern as lib/tx.ts.
 * Policy actions: sign_guarantee, pay_premium, cover_default, settle_guarantee
 * Vault actions:  rebalance, process_redemptions, add_strategy, remove_strategy
 *
 * Amount args are bigint stroops (display × 1e7).
 * id / months / weight_bps are number; volatile is boolean.
 *
 * All helpers require the connected wallet to BE the admin on-chain; the
 * contract will reject if not — the UI gate mirrors this.
 */

import { Client as PolicyClient } from "policy";
import { Client as VaultClient } from "vault";
import { config } from "./config";
import { makeSignTransaction } from "./wallet";

// ─── Client factories (bound to caller + sign fn) ────────────────────────────

function policyWriter(address: string): PolicyClient {
  return new PolicyClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.policy,
    networkPassphrase: config.networkPassphrase,
    publicKey: address,
    signTransaction: makeSignTransaction(address),
  });
}

function vaultWriter(address: string): VaultClient {
  return new VaultClient({
    rpcUrl: config.rpcUrl,
    contractId: config.contracts.vault,
    networkPassphrase: config.networkPassphrase,
    publicKey: address,
    signTransaction: makeSignTransaction(address),
  });
}

// ─── Helpers: extract hash from sent transaction ──────────────────────────────

function extractHash(hash: string | undefined): string {
  if (!hash) throw new Error("transaction did not return a hash");
  return hash;
}

// ─── Policy write helpers ────────────────────────────────────────────────────

/**
 * Underwrite a new rental guarantee.
 *
 * @param caller        - Admin's Stellar public key
 * @param landlord      - Landlord/beneficiary Stellar address
 * @param monthlyAmount - Monthly rental amount in stroops (bigint, i128)
 * @param monthsCovered - Number of months to cover (u32)
 * @param feeBps        - Premium fee in basis points charged PER PERIOD (u32);
 *                        each pay_premium pulls monthly_amount * feeBps/10000.
 *                        e.g. 1200 = 12% of the monthly rent every period.
 * @param periodSecs    - Period length in seconds (u64, as bigint); the premium
 *                        cadence (e.g. 30 days). NOT annual — feeBps is per-period.
 * @returns             - Confirmed transaction hash
 */
export async function signGuarantee(
  caller: string,
  landlord: string,
  monthlyAmount: bigint,
  monthsCovered: number,
  feeBps: number,
  periodSecs: bigint,
): Promise<string> {
  const client = policyWriter(caller);
  const tx = await client.sign_guarantee({
    landlord,
    monthly_amount: monthlyAmount,
    months_covered: monthsCovered,
    fee_bps: feeBps,
    period_secs: periodSecs,
  });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

/**
 * Pay the next premium period for a guarantee.
 *
 * @param caller - Payer's Stellar public key
 * @param id     - Guarantee ID (u32)
 * @returns      - Confirmed transaction hash
 */
export async function payPremium(caller: string, id: number): Promise<string> {
  const client = policyWriter(caller);
  const tx = await client.pay_premium({ payer: caller, id });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

/**
 * Cover a default: disburse the outstanding monthly amount to the landlord
 * and reduce coverage_required accordingly. Admin only.
 *
 * @param caller - Admin's Stellar public key
 * @param id     - Guarantee ID (u32)
 * @returns      - Confirmed transaction hash
 */
export async function coverDefault(caller: string, id: number): Promise<string> {
  const client = policyWriter(caller);
  const tx = await client.cover_default({ id });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

/**
 * Settle / close a guarantee (all months used or early termination). Admin only.
 *
 * @param caller - Admin's Stellar public key
 * @param id     - Guarantee ID (u32)
 * @returns      - Confirmed transaction hash
 */
export async function settleGuarantee(
  caller: string,
  id: number,
): Promise<string> {
  const client = policyWriter(caller);
  const tx = await client.settle_guarantee({ id });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

// ─── Vault write helpers ─────────────────────────────────────────────────────

/**
 * Rebalance vault allocation across strategies. Admin only.
 *
 * @param caller - Admin's Stellar public key
 * @returns      - Confirmed transaction hash
 */
export async function rebalance(caller: string): Promise<string> {
  const client = vaultWriter(caller);
  const tx = await client.rebalance();
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

/**
 * Process the redemption queue (up to max_batch entries). Admin only.
 *
 * @param caller    - Admin's Stellar public key
 * @param maxBatch  - Maximum number of redemptions to process (u32)
 * @returns         - Confirmed transaction hash
 */
export async function processRedemptions(
  caller: string,
  maxBatch: number,
): Promise<string> {
  const client = vaultWriter(caller);
  const tx = await client.process_redemptions({ max_batch: maxBatch });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

/**
 * Add a yield strategy to the vault's allocator. Admin only.
 *
 * @param caller     - Admin's Stellar public key
 * @param address    - Strategy contract address
 * @param weightBps  - Allocation weight in basis points (u32, sum must equal 10000)
 * @param volatile   - Whether this strategy holds volatile assets
 * @returns          - Confirmed transaction hash
 */
export async function addStrategy(
  caller: string,
  address: string,
  weightBps: number,
  volatile: boolean,
): Promise<string> {
  const client = vaultWriter(caller);
  const tx = await client.add_strategy({
    address,
    weight_bps: weightBps,
    volatile,
  });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}

/**
 * Remove a yield strategy from the vault's allocator. Admin only.
 *
 * @param caller  - Admin's Stellar public key
 * @param address - Strategy contract address to remove
 * @returns       - Confirmed transaction hash
 */
export async function removeStrategy(
  caller: string,
  address: string,
): Promise<string> {
  const client = vaultWriter(caller);
  const tx = await client.remove_strategy({ address });
  const sent = await tx.signAndSend();
  return extractHash(sent.sendTransactionResponse?.hash);
}
