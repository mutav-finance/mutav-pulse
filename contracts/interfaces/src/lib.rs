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
}

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
