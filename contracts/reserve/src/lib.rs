#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, MuxedAddress, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use strategy::StrategyClient;

mod types;
use types::{BPS_DENOM, DataKey, Guarantee, RedeemRequest, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};

mod test;
mod test_narrative;

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

    /// Net assets attributable to outstanding shares (drives NAV).
    pub fn total_assets(e: &Env) -> i128 {
        Self::available_held(e) + Self::strategies_balance(e)
    }

    pub fn add_strategy(e: &Env, address: Address, weight_bps: u32, volatile: bool) {
        Self::admin(e).require_auth();
        let mut list: Vec<StrategyAlloc> =
            e.storage().instance().get(&DataKey::Strategies).unwrap();
        list.push_back(StrategyAlloc { address, weight_bps, volatile });
        e.storage().instance().set(&DataKey::Strategies, &list);
    }

    pub fn strategies(e: &Env) -> Vec<StrategyAlloc> {
        e.storage().instance().get(&DataKey::Strategies).unwrap()
    }

    fn strategies_balance(e: &Env) -> i128 {
        let mut total = 0i128;
        for s in Self::strategies(e).iter() {
            total += StrategyClient::new(e, &s.address).balance();
        }
        total
    }

    /// Solvency-relevant assets: cash + stable (non-volatile) strategies only.
    /// The coverage floor may never depend on volatile venue value (H2).
    pub fn stable_assets(e: &Env) -> i128 {
        let mut total = Self::available_held(e);
        for s in Self::strategies(e).iter() {
            if !s.volatile {
                total += StrategyClient::new(e, &s.address).balance();
            }
        }
        total
    }

    /// Allocate any idle available held into strategies per weights.
    pub fn rebalance(e: &Env) {
        Self::admin(e).require_auth();
        let idle = Self::available_held(e);
        if idle <= 0 {
            return;
        }
        let list = Self::strategies(e);
        let total_weight: i128 = list.iter().map(|s| s.weight_bps as i128).sum();
        if total_weight == 0 {
            return;
        }
        let token = Self::token_client(e);
        for s in list.iter() {
            let portion = idle * (s.weight_bps as i128) / total_weight;
            if portion > 0 {
                token.transfer(&e.current_contract_address(), &s.address, &portion);
                StrategyClient::new(e, &s.address).invest(&portion);
            }
        }
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

    fn coverage_ratio_bps(e: &Env) -> i128 {
        let v: u32 = e.storage().instance().get(&DataKey::CoverageRatioBps).unwrap();
        v as i128
    }

    fn active_guarantee_ids(e: &Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveGuarantees).unwrap()
    }

    pub fn guarantee(e: &Env, id: u32) -> Guarantee {
        e.storage().persistent().get(&DataKey::Guarantee(id)).unwrap()
    }

    pub fn coverage_required(e: &Env) -> i128 {
        let ratio = Self::coverage_ratio_bps(e);
        let mut raw = 0i128;
        for id in Self::active_guarantee_ids(e).iter() {
            let g = Self::guarantee(e, id);
            let remaining_months = (g.months_covered - g.months_used) as i128;
            raw += g.monthly_amount * remaining_months;
        }
        raw * ratio / BPS_DENOM
    }

    pub fn free_capital(e: &Env) -> i128 {
        // Stable-backed surplus (H2): volatile venue value never counts here.
        let fc = Self::stable_assets(e) - Self::coverage_required(e);
        if fc > 0 { fc } else { 0 }
    }

    pub fn sign_guarantee(
        e: &Env,
        landlord: Address,
        monthly_amount: i128,
        months_covered: u32,
    ) -> u32 {
        Self::admin(e).require_auth();
        assert!(monthly_amount > 0 && months_covered > 0, "invalid guarantee");
        let ratio = Self::coverage_ratio_bps(e);
        let new_exposure = monthly_amount * (months_covered as i128) * ratio / BPS_DENOM;
        assert!(
            Self::free_capital(e) >= new_exposure,
            "insufficient free capital to underwrite"
        );

        let id: u32 = e.storage().instance().get(&DataKey::NextGuaranteeId).unwrap();
        e.storage().instance().set(&DataKey::NextGuaranteeId, &(id + 1));
        let g = Guarantee {
            id,
            landlord,
            monthly_amount,
            months_covered,
            months_used: 0,
            active: true,
        };
        e.storage().persistent().set(&DataKey::Guarantee(id), &g);
        let mut active = Self::active_guarantee_ids(e);
        active.push_back(id);
        e.storage().instance().set(&DataKey::ActiveGuarantees, &active);
        id
    }

    pub fn settle_guarantee(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let mut g = Self::guarantee(e, id);
        g.active = false;
        e.storage().persistent().set(&DataKey::Guarantee(id), &g);
        Self::remove_active(e, id);
    }

    fn remove_active(e: &Env, id: u32) {
        let active = Self::active_guarantee_ids(e);
        let mut next = Vec::<u32>::new(e);
        for x in active.iter() {
            if x != id {
                next.push_back(x);
            }
        }
        e.storage().instance().set(&DataKey::ActiveGuarantees, &next);
    }

    /// Divest from strategies (in order) until available held covers `needed`.
    fn ensure_liquidity(e: &Env, needed: i128) {
        if Self::available_held(e) >= needed {
            return;
        }
        for s in Self::strategies(e).iter() {
            if Self::available_held(e) >= needed {
                break;
            }
            let short = needed - Self::available_held(e);
            let client = StrategyClient::new(e, &s.address);
            let avail = client.balance();
            let pull = if short < avail { short } else { avail };
            if pull > 0 {
                client.divest(&pull, &e.current_contract_address());
            }
        }
        assert!(Self::available_held(e) >= needed, "insufficient liquidity");
    }

    pub fn cover_default(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let mut g = Self::guarantee(e, id);
        assert!(g.active, "guarantee inactive");
        assert!(g.months_used < g.months_covered, "coverage exhausted");

        Self::ensure_liquidity(e, g.monthly_amount);
        Self::token_client(e).transfer(
            &e.current_contract_address(),
            &g.landlord,
            &g.monthly_amount,
        );

        g.months_used += 1;
        if g.months_used == g.months_covered {
            g.active = false;
        }
        e.storage().persistent().set(&DataKey::Guarantee(id), &g);
        if !g.active {
            Self::remove_active(e, id);
        }
    }

    pub fn request(e: &Env, id: u32) -> RedeemRequest {
        e.storage().persistent().get(&DataKey::Request(id)).unwrap()
    }

    pub fn pending_requests(e: &Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::PendingRequests).unwrap()
    }

    pub fn request_redeem(e: &Env, owner: Address, shares: i128) -> u32 {
        owner.require_auth();
        assert!(shares > 0, "shares must be positive");
        // Escrow the shares into the contract (internal move; owner already authed).
        Base::update(e, Some(&owner), Some(&e.current_contract_address()), shares);

        let id: u32 = e.storage().instance().get(&DataKey::NextRequestId).unwrap();
        e.storage().instance().set(&DataKey::NextRequestId, &(id + 1));
        let req = RedeemRequest {
            id,
            owner,
            shares,
            fulfilled: false,
            claimed: false,
            claimable: 0,
        };
        e.storage().persistent().set(&DataKey::Request(id), &req);
        let mut pending = Self::pending_requests(e);
        pending.push_back(id);
        e.storage().instance().set(&DataKey::PendingRequests, &pending);
        id
    }

    /// Returns escrowed shares for an unfulfilled request and drops it.
    pub fn cancel_redeem(e: &Env, id: u32) {
        let mut req = Self::request(e, id);
        req.owner.require_auth();
        assert!(!req.fulfilled, "already fulfilled");
        assert!(!req.claimed, "already claimed");
        // Return the escrowed shares from the contract to the owner. Uses the
        // internal `update` (no-auth) since the holder is this contract.
        Base::update(e, Some(&e.current_contract_address()), Some(&req.owner), req.shares);
        req.claimed = true; // consume so it cannot be processed/cancelled twice
        e.storage().persistent().set(&DataKey::Request(id), &req);
        let pending = Self::pending_requests(e);
        let mut next = Vec::<u32>::new(e);
        for x in pending.iter() {
            if x != id {
                next.push_back(x);
            }
        }
        e.storage().instance().set(&DataKey::PendingRequests, &next);
    }

    pub fn process_redemptions(e: &Env, max_batch: u32) {
        Self::admin(e).require_auth();
        // Reentrancy guard (M2): `ensure_liquidity` calls out to adapters.
        assert!(
            !e.storage().instance().get::<_, bool>(&DataKey::Locked).unwrap_or(false),
            "reentrant call"
        );
        e.storage().instance().set(&DataKey::Locked, &true);

        let pending = Self::pending_requests(e);
        let mut still_pending = Vec::<u32>::new(e);
        let mut processed: u32 = 0;
        for id in pending.iter() {
            let mut req = Self::request(e, id);
            if req.fulfilled || req.claimed {
                continue;
            }
            // Bounded processing (M3): once the batch is spent, keep the rest queued.
            if processed >= max_batch {
                still_pending.push_back(id);
                continue;
            }
            processed += 1;

            let supply = Base::total_supply(e);
            let claimable = if supply == 0 {
                0
            } else {
                req.shares * (Self::total_assets(e) + VIRTUAL_OFFSET) / (supply + VIRTUAL_OFFSET)
            };
            // Gate on stable surplus only (H2).
            if claimable > 0 && Self::free_capital(e) >= claimable {
                Self::ensure_liquidity(e, claimable);
                // Effects before further interactions: burn escrowed shares now.
                Base::update(e, Some(&e.current_contract_address()), None, req.shares);
                let reserved = Self::reserved_for_claims(e) + claimable;
                e.storage().instance().set(&DataKey::ReservedForClaims, &reserved);
                req.fulfilled = true;
                req.claimable = claimable;
                e.storage().persistent().set(&DataKey::Request(id), &req);
            } else {
                still_pending.push_back(id);
            }
        }
        e.storage().instance().set(&DataKey::PendingRequests, &still_pending);
        e.storage().instance().set(&DataKey::Locked, &false);
    }

    pub fn claim(e: &Env, id: u32) {
        let mut req = Self::request(e, id);
        req.owner.require_auth();
        assert!(req.fulfilled, "not yet fulfilled");
        assert!(!req.claimed, "already claimed");
        Self::token_client(e).transfer(
            &e.current_contract_address(),
            &req.owner,
            &req.claimable,
        );
        let reserved = Self::reserved_for_claims(e) - req.claimable;
        e.storage().instance().set(&DataKey::ReservedForClaims, &reserved);
        req.claimed = true;
        e.storage().persistent().set(&DataKey::Request(id), &req);
    }

    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn remove_strategy(e: &Env, address: Address) {
        Self::admin(e).require_auth();
        // Pull the whole position back to the vault first.
        let client = StrategyClient::new(e, &address);
        let bal = client.balance();
        if bal > 0 {
            client.divest(&bal, &e.current_contract_address());
        }
        // Drop it from the registry.
        let list = Self::strategies(e);
        let mut next = Vec::<StrategyAlloc>::new(e);
        for s in list.iter() {
            if s.address != address {
                next.push_back(s);
            }
        }
        e.storage().instance().set(&DataKey::Strategies, &next);
    }

    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Reserve {
    type ContractType = Base;
}
