#![no_std]
// MuxedAddress is required by the FungibleToken macro even though it is not used directly.
use soroban_sdk::{contract, contractevent, contractimpl, token, Address, BytesN, Env, MuxedAddress, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use stellar_contract_utils::math::{i128_fixed_point::mul_div_with_rounding, Rounding};
use strategy::StrategyClient;
use interfaces::{PolicyClient, Vault as VaultTrait};

mod types;
use types::{DataKey, RedeemRequest, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};

mod test;

/// SEP-0056 `Deposit` event — topics `["deposit", operator, from, receiver]`,
/// data `[assets, shares]`. Emitted by `deposit` and `mint`. (The SEP `Withdraw`
/// event has no emitter: synchronous `withdraw`/`redeem` are disabled — see D2.)
#[contractevent]
pub struct Deposit {
    #[topic]
    pub operator: Address,
    #[topic]
    pub from: Address,
    #[topic]
    pub receiver: Address,
    pub assets: i128,
    pub shares: i128,
}

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
    /// SEP-0056: address of the underlying asset the vault manages.
    pub fn query_asset(e: &Env) -> Address { e.storage().instance().get(&DataKey::Underlying).unwrap() }
    pub fn policy(e: &Env) -> Address { e.storage().instance().get(&DataKey::Policy).expect("policy not set") }
    pub fn premium_income(e: &Env) -> i128 { e.storage().instance().get(&DataKey::PremiumIncome).unwrap_or(0) }

    pub fn set_policy(e: &Env, policy: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Policy, &policy);
    }

    fn reserved_for_claims(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::ReservedForClaims).unwrap_or(0)
    }
    fn token_client(e: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(e, &Self::query_asset(e))
    }
    pub fn available_held(e: &Env) -> i128 {
        Self::token_client(e).balance(&e.current_contract_address()) - Self::reserved_for_claims(e)
    }
    pub fn total_assets(e: &Env) -> i128 { Self::available_held(e) + Self::strategies_balance(e) }

    pub fn add_strategy(e: &Env, address: Address, weight_bps: u32, volatile: bool) {
        Self::admin(e).require_auth();
        let mut list: Vec<StrategyAlloc> = e.storage().instance().get(&DataKey::Strategies).unwrap();
        assert!(list.iter().all(|s| s.address != address), "strategy already added");
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

    // ───────────────────────── SEP-0056 (Tokenized Vault Standard) ─────────────────────────
    //
    // Hand-rolled on OZ `Base` (the share token), reusing OZ's audited
    // fixed-point arithmetic. OZ's `FungibleVault` extension (stellar-tokens
    // 0.7.2) anchors its share-price math to the vault's *idle* token balance
    // with no override hook, which is incompatible with our strategy allocator
    // (assets are deployed off-contract). So we keep `Base` for the shares and
    // compute NAV here off `total_assets()` (cash + strategy positions). The
    // arithmetic itself is the audited `mul_div_with_rounding` from
    // stellar-contract-utils — identical to what OZ's `Vault` uses, with a
    // virtual offset of 1 (`VIRTUAL_OFFSET`, i.e. OZ decimals_offset = 0). The
    // only divergence from the audited vault is the `total_assets` source.
    // See docs/sep0056-conformance-decisions.md.
    //
    // Redemptions are queue-only (D2, attack-surface reduction): synchronous
    // `withdraw`/`redeem` are disabled (revert) and `max_withdraw`/`max_redeem`
    // return 0 — the conformant signal for "withdrawals currently disabled".
    // Investors redeem via `request_redeem` → `process_redemptions` → `claim`.

    /// assets → shares at current NAV, via the audited primitive (virtual offset).
    fn to_shares(e: &Env, assets: i128, rounding: Rounding) -> i128 {
        assert!(assets >= 0, "negative assets");
        if assets == 0 { return 0; }
        mul_div_with_rounding(e, assets, Base::total_supply(e) + VIRTUAL_OFFSET, Self::total_assets(e) + VIRTUAL_OFFSET, rounding)
    }
    /// shares → assets at current NAV, via the audited primitive (virtual offset).
    fn to_assets(e: &Env, shares: i128, rounding: Rounding) -> i128 {
        assert!(shares >= 0, "negative shares");
        if shares == 0 { return 0; }
        mul_div_with_rounding(e, shares, Self::total_assets(e) + VIRTUAL_OFFSET, Base::total_supply(e) + VIRTUAL_OFFSET, rounding)
    }

    pub fn convert_to_shares(e: &Env, assets: i128) -> i128 { Self::to_shares(e, assets, Rounding::Floor) }
    pub fn convert_to_assets(e: &Env, shares: i128) -> i128 { Self::to_assets(e, shares, Rounding::Floor) }
    pub fn preview_deposit(e: &Env, assets: i128) -> i128 { Self::to_shares(e, assets, Rounding::Floor) }
    pub fn preview_mint(e: &Env, shares: i128) -> i128 { Self::to_assets(e, shares, Rounding::Ceil) }
    pub fn preview_withdraw(e: &Env, assets: i128) -> i128 { Self::to_shares(e, assets, Rounding::Ceil) }
    pub fn preview_redeem(e: &Env, shares: i128) -> i128 { Self::to_assets(e, shares, Rounding::Floor) }
    pub fn max_deposit(_e: &Env, _receiver: Address) -> i128 { i128::MAX }
    pub fn max_mint(_e: &Env, _receiver: Address) -> i128 { i128::MAX }
    /// 0 — synchronous withdrawals are disabled; redeem via the queue (D2).
    pub fn max_withdraw(_e: &Env, _owner: Address) -> i128 { 0 }
    /// 0 — synchronous withdrawals are disabled; redeem via the queue (D2).
    pub fn max_redeem(_e: &Env, _owner: Address) -> i128 { 0 }

    /// Pull `assets` of underlying from `from` into the vault, honoring operator
    /// delegation: self-transfer when `operator == from`, else allowance-based.
    fn pull(e: &Env, from: &Address, operator: &Address, assets: i128) {
        let t = Self::token_client(e);
        if operator == from {
            t.transfer(from, e.current_contract_address(), &assets);
        } else {
            t.transfer_from(operator, from, &e.current_contract_address(), &assets);
        }
    }
    fn emit_deposit(e: &Env, operator: &Address, from: &Address, receiver: &Address, assets: i128, shares: i128) {
        Deposit { operator: operator.clone(), from: from.clone(), receiver: receiver.clone(), assets, shares }
            .publish(e);
    }

    /// SEP-0056 deposit: `from` provides `assets`, `receiver` gets the minted
    /// shares, `operator` authorizes (allowance-delegated when `operator != from`).
    pub fn deposit(e: &Env, assets: i128, receiver: Address, from: Address, operator: Address) -> i128 {
        operator.require_auth();
        assert!(assets > 0, "amount must be positive");
        assert!(assets <= Self::max_deposit(e, receiver.clone()), "exceeds max deposit");
        // Shares priced off pre-transfer NAV (ERC-4626 semantics).
        let shares = Self::preview_deposit(e, assets);
        assert!(shares > 0, "zero shares minted");
        Self::pull(e, &from, &operator, assets);
        Base::mint(e, &receiver, shares);
        Self::emit_deposit(e, &operator, &from, &receiver, assets, shares);
        shares
    }

    /// SEP-0056 mint: mint exactly `shares` to `receiver`, pulling the required
    /// (ceil-rounded) assets from `from`. Returns assets consumed.
    pub fn mint(e: &Env, shares: i128, receiver: Address, from: Address, operator: Address) -> i128 {
        operator.require_auth();
        assert!(shares > 0, "shares must be positive");
        assert!(shares <= Self::max_mint(e, receiver.clone()), "exceeds max mint");
        let assets = Self::preview_mint(e, shares);
        assert!(assets > 0, "zero assets");
        Self::pull(e, &from, &operator, assets);
        Base::mint(e, &receiver, shares);
        Self::emit_deposit(e, &operator, &from, &receiver, assets, shares);
        assets
    }

    /// SEP-0056 withdraw — DISABLED (D2). Redeem via `request_redeem`.
    pub fn withdraw(_e: &Env, _assets: i128, _receiver: Address, _owner: Address, _operator: Address) -> i128 {
        panic!("synchronous withdrawals disabled; use request_redeem")
    }
    /// SEP-0056 redeem — DISABLED (D2). Redeem via `request_redeem`.
    pub fn redeem(_e: &Env, _shares: i128, _receiver: Address, _owner: Address, _operator: Address) -> i128 {
        panic!("synchronous withdrawals disabled; use request_redeem")
    }
    // ─────────────────────────────────────────────────────────────────────────────────────

    pub fn free_capital(e: &Env) -> i128 {
        let coverage = PolicyClient::new(e, &Self::policy(e)).coverage_required();
        let fc = Self::stable_assets_inner(e) - coverage;
        if fc > 0 { fc } else { 0 }
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
        let policy: Address = e.storage().instance().get(&DataKey::Policy).expect("policy not set");
        policy.require_auth();
        // Pre-transfer snapshot: `stable_pre >= amount` prevents the vault from
        // overdrawing its own stable balance (vault overdraft guard).  This does NOT
        // prove `stable_assets >= coverage_required` post-payout — that solvency
        // invariant is enforced by the policy lowering coverage_required (via
        // months_used / active flag) BEFORE calling disburse, so the ordering is:
        //   1. policy decrements coverage  2. vault disburses
        // TODO(solvency-oracle): guard prevents vault overdraft, not coverage breach; coverage enforcement relies on policy ordering
        let stable_pre = Vault::stable_assets_inner(&e);
        assert!(stable_pre >= amount, "disburse breaches solvency");
        Vault::ensure_liquidity(&e, amount);
        Vault::token_client(&e).transfer(&e.current_contract_address(), &to, &amount);
    }

    fn collect_premium(e: Env, from: Address, amount: i128) {
        // Only callable by the registered policy contract.
        let policy: Address = e.storage().instance().get(&DataKey::Policy).expect("policy not set");
        policy.require_auth();
        assert!(amount > 0, "amount must be positive");
        Vault::token_client(&e).transfer(&from, e.current_contract_address(), &amount);
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
