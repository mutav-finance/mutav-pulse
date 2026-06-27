#![no_std]
use soroban_sdk::{contractclient, contracterror, contracttype, Address, Env, Val, Vec};

/// Errors surfaced across the registry boundary. Defined here (not in the
/// `registry` crate) because the `Registry` trait's return type references it,
/// so every consumer of the generated `RegistryClient` sees the same stable
/// `#[contracterror]` codes. Numbered in the `2xx` band to stay clear of the
/// `4xx` strategy codes in `defindex-hodl`.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    /// No guarantee is stored under the requested id (previously a host trap
    /// from `Option::unwrap` on missing storage).
    GuaranteeNotFound = 200,
    /// Caller supplied a guarantee id outside the issued range (>= NextId). The
    /// registry derives ids from its own monotonic counter; a writer must never
    /// fabricate the primary key, nor overwrite a not-yet-issued slot (CWE-840).
    /// ADDITIVE: new discriminant; `GuaranteeNotFound = 200` is unchanged so the
    /// `#[contracterror]` ABI stays stable for in-place `upgrade()`.
    InvalidId = 201,
    /// The Writer role was read before it was set. The constructor now defaults
    /// Writer=admin, so this is defense-in-depth: it converts the host trap that
    /// an older (pre-default) upgraded-in instance would hit into a stable typed
    /// error. ADDITIVE.
    WriterNotSet = 202,
    /// `upgrade` was called against an on-chain schema version this binary does
    /// not expect (stale / layout-incompatible storage). Distinct from `InvalidId`
    /// so a refused stale-layout upgrade is distinguishable from a put id error in
    /// logs. Layout-changing edits must redeploy + re-wire via `bootstrap.sh`, not
    /// `upgrade()`. ADDITIVE.
    VersionMismatch = 203,
    /// `put` would push a brand-new id past the bounded active set cap
    /// (`registry::MAX_ACTIVE_GUARANTEES`). The active set is the unbounded `Vec<u32>`
    /// that `policy.coverage_required` iterates with one cross-contract `get()` per id,
    /// so its size is the H3 cost driver: capping it bounds that loop's worst-case at a
    /// known constant (Yearn-v3 — avoid unbounded per-call iteration over a
    /// growth-unbounded set). ADDITIVE: appended LAST with a new discriminant; codes
    /// 200–203 are byte-identical, so the `#[contracterror]` ABI stays stable for
    /// in-place `upgrade()`. NOTE: this is a hard stop on NEW issuance once the active
    /// set is full — only `sign_guarantee`'s first activating put can hit it, and
    /// `sign_guarantee` is admin-gated (`policy::sign_guarantee` → `admin.require_auth`),
    /// which is the compensating control against an issuance-flood DoS. Re-puts of
    /// already-active ids (pay_premium / cover_default / settle) never trip it.
    ActiveSetFull = 204,
}

/// Basis-points denominator (100% = 10_000). Single-sourced here (the
/// cross-contract boundary crate) so vault/policy/adapter-defindex import it
/// instead of each redeclaring it. Compile-time const, not a DataKey — zero
/// storage / upgrade-layout impact.
pub const BPS_DENOM: i128 = 10_000;

/// Stable core of a guarantee. Model-specific extras live in the policy's own
/// storage, keyed by id — never here.
#[contracttype]
#[derive(Clone)]
pub struct Guarantee {
    pub id: u32,
    pub landlord: Address,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub months_used: u32,
    pub fee_bps: u32,
    pub period_secs: u64,
    pub paid_until: u64,
    pub active: bool,
}

#[contractclient(name = "VaultClient")]
pub trait Vault {
    /// Money-OUT path the solvency model turns on. This doc is a DRIFT-GUARD that
    /// pins an invariant the runtime ALREADY enforces (the `require_auth` and the
    /// policy-first ordering live in `Vault::disburse` / `Policy::cover_default`);
    /// the comment exists so the trait boundary cannot silently diverge from those
    /// impls. Keep it consistent with the impl comment in `Vault::disburse`
    /// (vault crate) — if that comment changes, this one must move with it.
    ///
    /// Authorization (policy-only): implementations MUST `require_auth()` the
    /// registered policy address read from instance storage (the impl loads
    /// `DataKey::Policy` then calls `policy.require_auth()`). It MUST NOT be
    /// authorized by admin or by any arbitrary caller — disburse is purely the
    /// policy's money-path, never a direct admin lever.
    ///
    /// Ordering (caller obligation): the calling `Policy::cover_default` MUST
    /// reduce `coverage_required` BEFORE invoking disburse. It mutates the
    /// guarantee (`months_used += 1`; when `months_used == months_covered` it sets
    /// `active = false`) and persists it via `registry.put(g)` FIRST, and only
    /// THEN calls `vault.disburse`. That Ceil-rounded reduction of the
    /// `coverage_required` sum is what keeps `stable_assets >= coverage_required`
    /// (Nexus-style coverage-anchored solvency) true post-payout. The vault's
    /// pre-transfer guard `assert!(stable_pre >= amount)` (where
    /// `stable_pre = stable_assets_inner`) is ONLY a vault-overdraft guard — it
    /// proves the vault will not overdraw its own stable balance, NOT that the
    /// system stays solvent after the payout. Post-payout solvency is preserved
    /// solely by this caller-side ordering. See the `TODO(solvency-oracle)` note
    /// at the same assert in the vault impl.
    ///
    /// Re-entrancy (why the two rules above exist): the vault MUST NOT read
    /// `policy.coverage_required()` during disburse. Soroban forbids re-entering
    /// the in-progress policy contract frame, so the vault structurally cannot
    /// call back into the mid-disburse policy; coverage is therefore reconciled by
    /// the caller-first ordering above, NOT by an in-method callback. This is the
    /// load-bearing reason the contract is a documented caller-ordering invariant
    /// rather than an in-method check. Note disburse realizes liquidity via
    /// `ensure_liquidity` (which can typed-revert `VaultError::InsufficientLiquidity`
    /// = 600 under a lossy adapter) and does NOT route through the
    /// `mul_div_with_rounding` / `VIRTUAL_OFFSET` share math — that lives only in
    /// `to_shares` / `to_assets`.
    fn disburse(env: Env, to: Address, amount: i128);
    fn collect_premium(env: Env, from: Address, amount: i128);
    fn stable_assets(env: Env) -> i128;
}

#[contractclient(name = "PolicyClient")]
pub trait Policy {
    fn coverage_required(env: Env) -> i128;
}

#[contractclient(name = "RegistryClient")]
pub trait Registry {
    fn next_id(env: Env) -> u32;
    fn put(env: Env, g: Guarantee);
    fn get(env: Env, id: u32) -> Result<Guarantee, RegistryError>;
    fn active_ids(env: Env) -> Vec<u32>;
}

/// Minimal client for a DeFindex vault (single-asset use). The rich `deposit`
/// return is ignored (captured as raw `Val`); the adapter reads its df-share
/// balance from the DeFindex vault's own token instead.
#[contractclient(name = "DefindexVaultClient")]
pub trait DefindexVault {
    fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> Val;
    fn withdraw(env: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128>;
    fn get_asset_amounts_per_shares(env: Env, vault_shares: i128) -> Vec<i128>;
}

#[cfg(test)]
mod test {
    /// Pin the single-sourced BPS denominator against accidental drift — it must
    /// stay value-identical to the three redeclarations it replaced (all 10_000).
    #[test]
    fn bps_denom_is_10000() {
        assert_eq!(super::BPS_DENOM, 10_000);
    }
}
