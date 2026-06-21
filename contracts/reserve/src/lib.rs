#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, Env, MuxedAddress, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};

mod types;
use types::{DataKey, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};

mod test;

#[contract]
pub struct Reserve;

#[contractimpl]
impl Reserve {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address, coverage_ratio_bps: u32) {
        Base::set_metadata(
            e,
            7,
            String::from_str(e, "Mutav Pulse Reserve Share"),
            String::from_str(e, "mtvR"),
        );
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::CoverageRatioBps, &coverage_ratio_bps);
        e.storage().instance().set(&DataKey::ReservedForClaims, &0i128);
        e.storage().instance().set(&DataKey::Strategies, &Vec::<StrategyAlloc>::new(e));
        e.storage().instance().set(&DataKey::NextGuaranteeId, &0u32);
        e.storage().instance().set(&DataKey::ActiveGuarantees, &Vec::<u32>::new(e));
        e.storage().instance().set(&DataKey::NextRequestId, &0u32);
        e.storage().instance().set(&DataKey::PendingRequests, &Vec::<u32>::new(e));
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn underlying(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }

    fn reserved_for_claims(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::ReservedForClaims).unwrap_or(0)
    }

    fn token_client(e: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(e, &Self::underlying(e))
    }

    /// Underlying physically held by the vault, minus what's already earmarked
    /// for fulfilled-but-unclaimed redemptions.
    pub fn available_held(e: &Env) -> i128 {
        Self::token_client(e).balance(&e.current_contract_address()) - Self::reserved_for_claims(e)
    }

    /// Net assets attributable to outstanding shares.
    pub fn total_assets(e: &Env) -> i128 {
        // Strategies are summed in Task 5; here it is just available held.
        Self::available_held(e)
    }

    pub fn nav_per_share(e: &Env) -> i128 {
        let supply = Base::total_supply(e);
        if supply == 0 {
            return NAV_SCALE;
        }
        Self::total_assets(e) * NAV_SCALE / supply
    }

    pub fn deposit(e: &Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let supply = Base::total_supply(e);
        let assets_before = Self::total_assets(e);

        // Pull underlying in.
        Self::token_client(e).transfer(&from, &e.current_contract_address(), &amount);

        // Virtual offset (H1): defeats the first-depositor inflation attack and
        // keeps 1:1 on the first deposit (amount * (0+1) / (0+1) == amount).
        let shares = amount * (supply + VIRTUAL_OFFSET) / (assets_before + VIRTUAL_OFFSET);
        assert!(shares > 0, "zero shares minted");
        Base::mint(e, &from, shares);
        shares
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Reserve {
    type ContractType = Base;
}
