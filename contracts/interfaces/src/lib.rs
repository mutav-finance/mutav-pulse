#![no_std]
use soroban_sdk::{contractclient, contracttype, Address, BytesN, Env, Vec};

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
    fn set_writer(env: Env, policy: Address);
    fn writer(env: Env) -> Address;
    fn set_admin(env: Env, new_admin: Address);
    fn upgrade(env: Env, new_wasm_hash: BytesN<32>);
    fn next_id(env: Env) -> u32;
    fn put(env: Env, g: Guarantee);
    fn get(env: Env, id: u32) -> Guarantee;
    fn active_ids(env: Env) -> Vec<u32>;
}
