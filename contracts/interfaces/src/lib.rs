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
