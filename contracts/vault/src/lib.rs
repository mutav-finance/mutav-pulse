#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, MuxedAddress, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use strategy::StrategyClient;
use interfaces::{PolicyClient, Vault as VaultTrait};

mod types;
use types::{DataKey, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};

mod test;

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        Base::set_metadata(
            e, 7,
            String::from_str(e, "Mutav Pulse Reserve Share"),
            String::from_str(e, "mtvR"),
        );
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::ReservedForClaims, &0i128);
        e.storage().instance().set(&DataKey::PremiumIncome, &0i128);
        e.storage().instance().set(&DataKey::Strategies, &Vec::<StrategyAlloc>::new(e));
        e.storage().instance().set(&DataKey::NextRequestId, &0u32);
        e.storage().instance().set(&DataKey::PendingRequests, &Vec::<u32>::new(e));
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    pub fn underlying(e: &Env) -> Address { e.storage().instance().get(&DataKey::Underlying).unwrap() }
    pub fn policy(e: &Env) -> Address { e.storage().instance().get(&DataKey::Policy).unwrap() }
    pub fn premium_income(e: &Env) -> i128 { e.storage().instance().get(&DataKey::PremiumIncome).unwrap_or(0) }

    pub fn set_policy(e: &Env, policy: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Policy, &policy);
    }

    fn reserved_for_claims(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::ReservedForClaims).unwrap_or(0)
    }
    fn token_client(e: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(e, &Self::underlying(e))
    }
    pub fn available_held(e: &Env) -> i128 {
        Self::token_client(e).balance(&e.current_contract_address()) - Self::reserved_for_claims(e)
    }
    pub fn total_assets(e: &Env) -> i128 { Self::available_held(e) + Self::strategies_balance(e) }

    pub fn add_strategy(e: &Env, address: Address, weight_bps: u32, volatile: bool) {
        Self::admin(e).require_auth();
        let mut list: Vec<StrategyAlloc> = e.storage().instance().get(&DataKey::Strategies).unwrap();
        list.push_back(StrategyAlloc { address, weight_bps, volatile });
        e.storage().instance().set(&DataKey::Strategies, &list);
    }
    pub fn strategies(e: &Env) -> Vec<StrategyAlloc> {
        e.storage().instance().get(&DataKey::Strategies).unwrap()
    }
    fn strategies_balance(e: &Env) -> i128 {
        let mut total = 0i128;
        for s in Self::strategies(e).iter() { total += StrategyClient::new(e, &s.address).balance(); }
        total
    }

    pub fn rebalance(e: &Env) {
        Self::admin(e).require_auth();
        let idle = Self::available_held(e);
        if idle <= 0 { return; }
        let list = Self::strategies(e);
        let total_weight: i128 = list.iter().map(|s| s.weight_bps as i128).sum();
        if total_weight == 0 { return; }
        let tok = Self::token_client(e);
        for s in list.iter() {
            let portion = idle * (s.weight_bps as i128) / total_weight;
            if portion > 0 {
                tok.transfer(&e.current_contract_address(), &s.address, &portion);
                StrategyClient::new(e, &s.address).invest(&portion);
            }
        }
    }
    pub fn remove_strategy(e: &Env, address: Address) {
        Self::admin(e).require_auth();
        let client = StrategyClient::new(e, &address);
        let bal = client.balance();
        if bal > 0 { client.divest(&bal, &e.current_contract_address()); }
        let mut next = Vec::<StrategyAlloc>::new(e);
        for s in Self::strategies(e).iter() {
            if s.address != address { next.push_back(s); }
        }
        e.storage().instance().set(&DataKey::Strategies, &next);
    }
    pub(crate) fn ensure_liquidity(e: &Env, needed: i128) {
        if Self::available_held(e) >= needed { return; }
        for s in Self::strategies(e).iter() {
            if Self::available_held(e) >= needed { break; }
            let short = needed - Self::available_held(e);
            let client = StrategyClient::new(e, &s.address);
            let avail = client.balance();
            let pull = if short < avail { short } else { avail };
            if pull > 0 { client.divest(&pull, &e.current_contract_address()); }
        }
        assert!(Self::available_held(e) >= needed, "insufficient liquidity");
    }

    pub fn nav_per_share(e: &Env) -> i128 {
        let supply = Base::total_supply(e);
        if supply == 0 { return NAV_SCALE; }
        Self::total_assets(e) * NAV_SCALE / supply
    }
    pub fn deposit(e: &Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let supply = Base::total_supply(e);
        let assets_before = Self::total_assets(e);
        Self::token_client(e).transfer(&from, &e.current_contract_address(), &amount);
        let shares = amount * (supply + VIRTUAL_OFFSET) / (assets_before + VIRTUAL_OFFSET);
        assert!(shares > 0, "zero shares minted");
        Base::mint(e, &from, shares);
        shares
    }

    pub fn free_capital(e: &Env) -> i128 {
        let coverage = PolicyClient::new(e, &Self::policy(e)).coverage_required();
        let fc = Self::stable_assets_inner(e) - coverage;
        if fc > 0 { fc } else { 0 }
    }

    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Internal: solvency-relevant assets (cash + stable strategies).
    fn stable_assets_inner(e: &Env) -> i128 {
        let mut total = Self::available_held(e);
        for s in Self::strategies(e).iter() {
            if !s.volatile { total += StrategyClient::new(e, &s.address).balance(); }
        }
        total
    }
}

/// Implement the interfaces::Vault trait so mock-policy can call
/// VaultClient::disburse / VaultClient::collect_premium / VaultClient::stable_assets in tests.
#[contractimpl]
impl VaultTrait for Vault {
    fn disburse(e: Env, to: Address, amount: i128) {
        // Only callable by the registered policy contract.
        let policy: Address = e.storage().instance().get(&DataKey::Policy).unwrap();
        policy.require_auth();
        Vault::ensure_liquidity(&e, amount);
        Vault::token_client(&e).transfer(&e.current_contract_address(), &to, &amount);
    }

    fn collect_premium(e: Env, from: Address, amount: i128) {
        // Only callable by the registered policy contract.
        let policy: Address = e.storage().instance().get(&DataKey::Policy).unwrap();
        policy.require_auth();
        Vault::token_client(&e).transfer(&from, &e.current_contract_address(), &amount);
        let income = Vault::premium_income(&e) + amount;
        e.storage().instance().set(&DataKey::PremiumIncome, &income);
    }

    fn stable_assets(e: Env) -> i128 {
        Vault::stable_assets_inner(&e)
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Vault {
    type ContractType = Base;
}
