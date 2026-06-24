#![no_std]
use soroban_sdk::{contractclient, contracttype, Address, BytesN, Env, Val, Vec};

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
    fn get(env: Env, id: u32) -> Guarantee;
    fn active_ids(env: Env) -> Vec<u32>;
    /// Poseidon-Merkle root of the active guarantees — the "list seal" (piece B of the ZK).
    fn guarantees_root(env: Env) -> BytesN<32>;
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
