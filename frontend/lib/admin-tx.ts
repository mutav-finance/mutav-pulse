/**
 * lib/admin-tx.ts — Write helpers for admin-gated protocol actions
 *
 * Same assemble→sign→submit pattern as lib/tx.ts, reserve-parameterized: each
 * helper takes the target reserve's `contracts` (uses `.policy` / `.vault`).
 * Policy actions: sign_guarantee (two-leg), pay_fee, cover_default, cover_exit,
 *                 settle_guarantee
 * Vault actions:  rebalance, process_redemptions, add_strategy, remove_strategy
 *
 * Amount args are bigint stroops (display × 1e7).
 *
 * Source vs signer: the admin contracts gate on `admin.require_auth()`, where the
 * admin is an on-chain account that may be a multisig the connected wallet only
 * SIGNS for. So each admin-gated write takes the admin account as `adminAccount`
 * and uses it as the tx SOURCE, while signing the envelope with `caller` (the
 * connected wallet). Soroban then satisfies `require_auth` via source-account
 * credentials, and the signer's signature (weight ≥ threshold) validates the tx —
 * no auth-entry juggling, single signature (threshold-1 multisig).
 *
 * `adminAccount` is threaded in by the caller (the cockpit already reads + renders
 * `vault.admin()` / `policy.admin()` as `data.vaultAdmin` / `data.policyAdmin`) so
 * the source is always the same fresh value the UI shows — no second resolution
 * path that could drift. `payFee` is the one non-admin helper (gated on `payer`),
 * so its source stays `caller`.
 */

import { Client as PolicyClient } from "policy";
import { Client as VaultClient } from "vault";
import type { ReserveContracts } from "./contracts";
import { makeWriterOpts, submit } from "./wallet";
import { STANDARD_PRODUCT } from "./economics";

// ─── Client factories (bound to signer + source + reserve contract id) ────────

function policyWriter(signer: string, policyId: string, source: string): PolicyClient {
  return new PolicyClient(makeWriterOpts(signer, policyId, source));
}

function vaultWriter(signer: string, vaultId: string, source: string): VaultClient {
  return new VaultClient(makeWriterOpts(signer, vaultId, source));
}

// ─── Policy write helpers ────────────────────────────────────────────────────

/**
 * Underwrite a new two-leg rental guarantee. `feeBps` is per-period, not annual.
 * `exitMonths` reserves the EXIT (property-recovery/restoration) leg as a multiple
 * of monthly rent (pilot default 6); the DEFAULT (rent-arrears) leg is `monthsCovered`.
 */
export async function signGuarantee(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  landlord: string,
  monthlyAmount: bigint,
  monthsCovered: number,
  feeBps: number,
  periodSecs: bigint,
  exitMonths: number = STANDARD_PRODUCT.exitMonths,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.sign_guarantee({
    landlord,
    monthly_amount: monthlyAmount,
    months_covered: monthsCovered,
    exit_months: exitMonths,
    fee_bps: feeBps,
    period_secs: periodSecs,
  });
  return submit(tx);
}

/** Pay the next fee period for a guarantee (advances `paid_until`). */
export async function payFee(
  contracts: ReserveContracts,
  caller: string,
  id: number,
): Promise<string> {
  // pay_fee gates on `payer` (the caller), not admin — source stays the caller.
  const client = policyWriter(caller, contracts.policy, caller);
  const tx = await client.pay_fee({ payer: caller, id });
  return submit(tx);
}

/**
 * Cover a default (DEFAULT leg): disburse one monthly amount to the landlord and
 * advance `months_used`. Admin only.
 */
export async function coverDefault(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  id: number,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.cover_default({ id });
  return submit(tx);
}

/**
 * Cover an exit cost (EXIT leg): disburse an arbitrary `amount` (stroops) to the
 * landlord up to the cap `monthly_amount * exit_months`, accruing `exit_used`.
 * Admin only.
 */
export async function coverExit(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  id: number,
  amount: bigint,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.cover_exit({ id, amount });
  return submit(tx);
}

/** Settle / close a guarantee. Admin only. */
export async function settleGuarantee(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  id: number,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.settle_guarantee({ id });
  return submit(tx);
}

// ─── Vault write helpers ─────────────────────────────────────────────────────

/** Rebalance vault allocation across strategies. Admin only. */
export async function rebalance(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.rebalance();
  return submit(tx);
}

/** Process the redemption queue (up to max_batch entries). Admin only. */
export async function processRedemptions(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  maxBatch: number,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.process_redemptions({ max_batch: maxBatch });
  return submit(tx);
}

/** Add a yield strategy to the vault's allocator. Admin only. */
export async function addStrategy(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  address: string,
  weightBps: number,
  volatile: boolean,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.add_strategy({
    address,
    weight_bps: weightBps,
    volatile,
  });
  return submit(tx);
}

/** Remove a yield strategy from the vault's allocator. Admin only. */
export async function removeStrategy(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  address: string,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.remove_strategy({ address });
  return submit(tx);
}

/**
 * Set the liquid-cash-buffer target — the fraction of total assets (in bps) the
 * vault retains idle; `rebalance` deploys only the surplus above it. 0 = deploy
 * everything. Admin only.
 */
export async function setMinLiquidBufferBps(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  bps: number,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.set_min_liquid_buffer_bps({ bps });
  return submit(tx);
}

/**
 * Set a strategy's concentration cap — the max fraction of total assets (in bps)
 * `rebalance` will deploy to it. 10000 = uncapped. Admin only.
 */
export async function setStrategyMaxDebtBps(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  strategy: string,
  bps: number,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.set_strategy_max_debt_bps({ strategy, bps });
  return submit(tx);
}

// ─── Governance / management (Manage tab) ─────────────────────────────────────

/**
 * Transfer the vault admin to a new address. Single-admin: this HANDS OVER vault
 * control entirely — irreversible if you don't control `newAdmin`. Admin only.
 */
export async function setVaultAdmin(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  newAdmin: string,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.set_admin({ new_admin: newAdmin });
  return submit(tx);
}

/**
 * Transfer the policy admin to a new address. Single-admin handover — irreversible
 * if you don't control `newAdmin`. Admin only.
 */
export async function setPolicyAdmin(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  newAdmin: string,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.set_admin({ new_admin: newAdmin });
  return submit(tx);
}

/**
 * Point the vault at a different policy contract — swaps the underwriting model
 * without moving funds (the setter-wired connection). Admin only.
 */
export async function setVaultPolicy(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  policy: string,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.set_policy({ policy });
  return submit(tx);
}

/** Re-label the share token (name + symbol). Decimals fixed at 7. Admin only. */
export async function setTokenMetadata(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  name: string,
  symbol: string,
): Promise<string> {
  const client = vaultWriter(caller, contracts.vault, adminAccount);
  const tx = await client.set_token_metadata({ name, symbol });
  return submit(tx);
}

/**
 * Set the coverage ratio `c` (bps) — the solvency multiplier on raw coverage.
 * 10000 = 1.0 (hard-solvent); <10000 leverages, >10000 over-collateralizes.
 * Admin only.
 */
export async function setCoverageRatioBps(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  bps: number,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.set_coverage_ratio_bps({ bps });
  return submit(tx);
}

/** Set the default grace window (seconds) before a missed fee counts as default. Admin only. */
export async function setGraceSecs(
  contracts: ReserveContracts,
  caller: string,
  adminAccount: string,
  secs: bigint,
): Promise<string> {
  const client = policyWriter(caller, contracts.policy, adminAccount);
  const tx = await client.set_grace_secs({ secs });
  return submit(tx);
}
