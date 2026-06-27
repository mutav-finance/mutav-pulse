#![no_std]
// MuxedAddress is required by the FungibleToken macro even though it is not used directly.
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, panic_with_error, token, Address, BytesN, Env, MuxedAddress, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use stellar_contract_utils::math::{i128_fixed_point::mul_div_with_rounding, Rounding};
use strategy::StrategyClient;
use interfaces::{PolicyClient, Vault as VaultTrait};

pub mod types;
use types::{DataKey, RedeemRequest, StrategyAlloc, BPS_DENOM, MAX_ENTRY_TTL, NAV_SCALE, REQUEST_TTL_LEDGERS, VIRTUAL_OFFSET};

mod test;

/// Vault-side errors surfaced as stable `#[contracterror]` codes. Numbered in the
/// `6xx` band to stay clear of the interfaces `2xx`, policy `3xx`, strategy `4xx`,
/// and adapter `5xx` codes. Mirrors the adapter-defindex `AdapterError` pattern:
/// a money-path revert that carries a diagnosable code instead of an opaque host
/// trap. Code-only (not a storage entry) so it is layout-safe for in-place
/// `upgrade()`.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    /// #34 / code-review H1: a money path (`disburse` / `process_redemptions`)
    /// asked `ensure_liquidity` for more underlying than the strategies could
    /// realize (e.g. a lossy/slippage adapter that reports `balance()` above what
    /// `divest()` actually delivers). Yearn-v3 stance: revert rather than realize
    /// an incorrect loss — the whole tx rolls back atomically.
    InsufficientLiquidity = 600,
}

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
    pub fn __constructor(e: &Env, admin: Address, underlying: Address, name: String, symbol: String) {
        // Share-token metadata is per-reserve: each fiat-pegged vault mints a share
        // symboled for its currency (MUSD / MBRL / MARS), not a generic "mtvR".
        // Set once at construction — changing it requires redeploy.
        Base::set_metadata(e, 7, name, symbol);
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

    /// Admin-gated re-label of the share token (name + symbol). Decimals are
    /// fixed at 7. Lets a deployed reserve adopt its per-currency symbol
    /// (MUSD / MBRL / MARS) via `upgrade()` instead of a destructive redeploy —
    /// balances, NAV, and seeded state are preserved.
    pub fn set_token_metadata(e: &Env, name: String, symbol: String) {
        Self::admin(e).require_auth();
        Base::set_metadata(e, 7, name, symbol);
    }

    /// Fraction of TOTAL assets (in bps) the vault retains as a liquid cash
    /// buffer; `rebalance` deploys the surplus above it and divests back into it.
    /// 0 = deploy everything. Set per reserve. This is a LIQUIDITY optimization
    /// (avoid on-demand divest costs), NOT a solvency reserve — solvency stays
    /// enforced by `free_capital` / `coverage_required`.
    pub fn min_liquid_buffer_bps(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::MinLiquidBufferBps).unwrap_or(0)
    }
    pub fn set_min_liquid_buffer_bps(e: &Env, bps: u32) {
        Self::admin(e).require_auth();
        assert!(bps <= 10_000, "min_liquid_buffer_bps exceeds 100%");
        e.storage().instance().set(&DataKey::MinLiquidBufferBps, &bps);
    }

    /// Target idle cash retained as the liquid buffer: `total_assets × bps`.
    /// The surplus above this is what `rebalance` deploys across strategies.
    pub fn target_idle(e: &Env) -> i128 {
        // Floor keeps the retained buffer from over-reserving (Yearn-v3
        // total-anchored idle). BPS_DENOM (10_000) is a non-zero constant.
        // Value-identical to the prior truncating `/` for non-negative operands;
        // routed through the audited primitive for i128 overflow-safety.
        mul_div_with_rounding(
            e,
            Self::total_assets(e),
            Self::min_liquid_buffer_bps(e) as i128,
            BPS_DENOM,
            Rounding::Floor,
        )
    }

    /// Per-strategy concentration cap, in bps of TOTAL assets. Defaults to 100%
    /// (uncapped) when unset. `rebalance` will not deploy a strategy above this.
    pub fn strategy_max_debt_bps(e: &Env, strategy: Address) -> u32 {
        Self::strategy_max_debt_bps_inner(e, &strategy)
    }
    fn strategy_max_debt_bps_inner(e: &Env, strategy: &Address) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::StrategyMaxDebtBps(strategy.clone()))
            .unwrap_or(BPS_DENOM as u32)
    }
    pub fn set_strategy_max_debt_bps(e: &Env, strategy: Address, bps: u32) {
        Self::admin(e).require_auth();
        assert!(bps <= 10_000, "strategy_max_debt_bps exceeds 100%");
        e.storage().instance().set(&DataKey::StrategyMaxDebtBps(strategy), &bps);
    }

    /// Per-strategy target debt for `rebalance`: weighted share of the deployable
    /// surplus, clamped to the strategy's concentration cap.
    fn target_debt_for(
        e: &Env,
        s: &StrategyAlloc,
        total: i128,
        deployable_total: i128,
        total_weight: i128,
    ) -> i128 {
        // Floor on both the weighted target and the concentration cap guarantees
        // neither is exceeded by rounding (Yearn-v3 target-to-balance / max_debt).
        // Routed through the audited primitive for i128 overflow-safety;
        // value-identical to the prior truncating `/` for non-negative operands.
        let mut target = if total_weight > 0 {
            mul_div_with_rounding(e, deployable_total, s.weight_bps as i128, total_weight, Rounding::Floor)
        } else {
            0
        };
        let cap = mul_div_with_rounding(
            e,
            total,
            Self::strategy_max_debt_bps_inner(e, &s.address) as i128,
            BPS_DENOM,
            Rounding::Floor,
        );
        if target > cap {
            target = cap;
        }
        target
    }

    fn reserved_for_claims(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::ReservedForClaims).unwrap_or(0)
    }

    /// H6: keep the instance entry alive (Strategies / ReservedForClaims /
    /// PremiumIncome / Policy / NextRequestId / PendingRequests live here). Bumped
    /// on hot/lifecycle write paths so it never archives.
    fn bump_instance(e: &Env) {
        e.storage()
            .instance()
            .extend_ttl(MAX_ENTRY_TTL / 2, MAX_ENTRY_TTL);
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

    /// Rebalance strategy allocations toward target — idempotent and bidirectional.
    ///
    /// Keeps `target_idle` (a fraction of TOTAL assets, see `min_liquid_buffer_bps`)
    /// as a liquid cash buffer and spreads the surplus across strategies by weight,
    /// each clamped to its `strategy_max_debt_bps` cap. Each strategy's on-chain
    /// balance is moved toward that target: pulled back when over, deployed when
    /// under. Targets are computed once off a snapshot, so calling at-target is a
    /// no-op — the buffer holds instead of draining across repeated calls.
    ///
    /// LIQUIDITY-only: never reads `coverage_required` (solvency stays enforced by
    /// the `free_capital` redemption gate + disburse ordering). Capped overflow
    /// simply remains idle above `target_idle`. Divest pass runs before invest so
    /// pulled-back funds are available to fund the deploys.
    ///
    /// Under a LOSSY divest (a slippage/fee adapter that delivers less underlying
    /// than its reported balance implies), the invest pass is clamped to the
    /// realized live idle, so full convergence to target may take an ADDITIONAL
    /// rebalance call off the fresh post-loss snapshot — at-target-in-one-call is
    /// not guaranteed under loss (Yearn-v3 bidirectional rebalance-under-loss).
    pub fn rebalance(e: &Env) {
        Self::admin(e).require_auth();
        // Reentrancy guard (M2): divest calls out to adapters; shared with process_redemptions.
        assert!(
            !e.storage().instance().get::<_, bool>(&DataKey::Locked).unwrap_or(false),
            "reentrant call"
        );
        e.storage().instance().set(&DataKey::Locked, &true);

        // Snapshot once → idempotent. total/target_idle exclude reserved_for_claims.
        let total = Self::total_assets(e);
        // Off the single `total` snapshot (NOT Self::target_idle, which re-reads
        // total_assets) to preserve the idempotency contract above. Same Floor /
        // overflow-safe primitive as target_idle.
        let target_idle = mul_div_with_rounding(
            e,
            total,
            Self::min_liquid_buffer_bps(e) as i128,
            BPS_DENOM,
            Rounding::Floor,
        );
        let deployable_total = if total > target_idle { total - target_idle } else { 0 };
        let list = Self::strategies(e);
        let total_weight: i128 = list.iter().map(|s| s.weight_bps as i128).sum();
        let tok = Self::token_client(e);
        let here = e.current_contract_address();

        // Precompute each strategy's target ONCE off the single snapshot above.
        // `target_debt_for` re-reads StrategyMaxDebtBps per call, so computing it
        // once per strategy (instead of once per pass) halves those instance
        // reads. The Strategies Vec has stable insertion order, so index `i` is the
        // same strategy in both the divest and invest passes — and the result is
        // mathematically identical to the prior double-compute (deterministic from
        // the frozen total / deployable_total / total_weight snapshot).
        let mut targets = Vec::<i128>::new(e);
        for s in list.iter() {
            targets.push_back(Self::target_debt_for(e, &s, total, deployable_total, total_weight));
        }

        // Divest pass: pull every over-target strategy back down (raises idle).
        for (i, s) in list.iter().enumerate() {
            let target = targets.get(i as u32).unwrap();
            let client = StrategyClient::new(e, &s.address);
            let cur = client.balance();
            if cur > target {
                client.divest(&(cur - target), &here);
            }
        }
        // Invest pass: top up every under-target strategy, clamped to LIVE idle.
        // Targets are still computed off the pre-divest `total` snapshot (keeps
        // rebalance a policy, not cash-chasing / idempotency), but the deploy is
        // clamped to the spendable idle ON HAND right now — a lossy divest pass
        // delivers less underlying than the snapshot implied, so `target - cur`
        // could exceed the balance and trap the token transfer. Yearn-v3
        // `_freeFunds`: use the balance, not a stale accounted figure. Overflow
        // simply stays idle above target_idle (as the doc-comment promises).
        // `available_held` nets reserved_for_claims, so the clamp never deploys
        // claim escrow. Re-read live each iteration: strategy ORDER (the existing
        // Strategies Vec order) deterministically tie-breaks who is funded first
        // under a shortfall.
        for (i, s) in list.iter().enumerate() {
            let target = targets.get(i as u32).unwrap();
            let client = StrategyClient::new(e, &s.address);
            let cur = client.balance();
            if target > cur {
                let want = target - cur;
                let spendable = Self::available_held(e);
                let amount = if want < spendable { want } else { spendable };
                if amount > 0 {
                    tok.transfer(&here, &s.address, &amount);
                    client.invest(&amount);
                }
            }
        }

        e.storage().instance().set(&DataKey::Locked, &false);
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
    /// Raise at least `needed` underlying into the vault's spendable balance,
    /// divesting strategies as required. Infallible-or-revert (whole-tx-atomic):
    /// the only two callers (`disburse`, `process_redemptions`) are money paths
    /// that must revert-not-short (Yearn-v3: "better to revert if withdraws are
    /// simply illiquid so as not to realize incorrect losses"), so the signature
    /// stays `(&Env, i128)` and a shortfall is a typed revert.
    pub(crate) fn ensure_liquidity(e: &Env, needed: i128) {
        // Hoist `available_held` into a local `held` to collapse the ~4 redundant
        // token-balance reads per logical step (entry guard, loop guard, `short`
        // calc, terminal assert) the prior code performed. `held` MUTATES as each
        // divest transfers underlying back, so it is NOT a frozen snapshot: it is
        // RE-READ once after every divest (not `held += pull`) to stay exact under
        // a real-adapter haircut where received < requested.
        let mut held = Self::available_held(e);
        if held >= needed { return; }
        // Single pass over strategies (each visited at most once → terminating).
        // The post-divest re-read of `held` is the LIVE token balance, so the
        // realized (post-loss) amount of each divest is what counts toward
        // progress — a lossy adapter that returns < requested simply leaves the
        // shortfall, the next strategy (if any) is tried, and the terminal guard
        // catches any residual shortfall. `client.divest` returns the realized
        // amount but we deliberately rely on the live re-read rather than the
        // return value, which is the source of truth for what actually landed.
        for s in Self::strategies(e).iter() {
            if held >= needed { break; }
            let short = needed - held;
            let client = StrategyClient::new(e, &s.address);
            let avail = client.balance();
            let pull = if short < avail { short } else { avail };
            if pull > 0 {
                client.divest(&pull, &e.current_contract_address());
                held = Self::available_held(e);
            }
        }
        if held < needed {
            // Typed revert (code 600) instead of an opaque host trap. Both roll
            // back the whole tx; this gives a stable diagnosable code.
            panic_with_error!(e, VaultError::InsufficientLiquidity);
        }
    }

    pub fn nav_per_share(e: &Env) -> i128 {
        let supply = Base::total_supply(e);
        // Guard is load-bearing: this denominator has NO virtual offset, so a
        // zero `supply` would be a native divide-by-zero host panic in
        // mul_div_with_rounding (not a typed error). Floor matches a per-share
        // price quote and equals the prior truncating `/` for non-negative
        // operands — overflow-safety on the total_assets*NAV_SCALE product is
        // the only change.
        if supply == 0 { return NAV_SCALE; }
        mul_div_with_rounding(e, Self::total_assets(e), NAV_SCALE, supply, Rounding::Floor)
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
        Self::bump_instance(e);
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
        Self::bump_instance(e);
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
        // H6 analog: the lifecycle read behind cancel_redeem / process_redemptions
        // / claim and the public getter. Re-extend on the loaded entry (only on
        // Some — a missing id keeps the prior unwrap panic semantics, never a
        // write) so a request queued many ledgers between request_redeem and
        // process_redemptions does not archive. (Side effect: turns this getter
        // into a read-WRITE in simulation; flagged to the SDK/frontend team.)
        let req: RedeemRequest = e.storage().persistent().get(&DataKey::Request(id)).unwrap();
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Request(id), REQUEST_TTL_LEDGERS, REQUEST_TTL_LEDGERS);
        req
    }

    pub fn pending_requests(e: &Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::PendingRequests).unwrap()
    }

    pub fn request_redeem(e: &Env, owner: Address, shares: i128) -> u32 {
        owner.require_auth();
        Self::bump_instance(e);
        assert!(shares > 0, "shares must be positive");
        // Escrow the shares into the contract (internal move; owner already authed).
        Base::update(e, Some(&owner), Some(&e.current_contract_address()), shares);

        let id: u32 = e.storage().instance().get(&DataKey::NextRequestId).unwrap();
        e.storage().instance().set(
            &DataKey::NextRequestId,
            &id.checked_add(1).expect("request id space exhausted"),
        );
        let req = RedeemRequest {
            id,
            owner,
            shares,
            fulfilled: false,
            claimed: false,
            claimable: 0,
        };
        e.storage().persistent().set(&DataKey::Request(id), &req);
        // H6 analog: size the request obligation to the network max — the queue
        // wait between request_redeem and process_redemptions/claim is unbounded.
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Request(id), REQUEST_TTL_LEDGERS, REQUEST_TTL_LEDGERS);
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
        Self::bump_instance(e);

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

            // H2: settle through the identical audited primitive used by
            // preview_redeem (to_assets Floor) — restoring ERC-4626
            // rounding-favors-the-vault on payout, preview/settlement parity, and
            // i128 overflow-safety (I256 promotion) vs. the prior raw
            // multiply-before-divide that traps. The old `supply == 0` branch is
            // unreachable here: request_redeem escrowed `req.shares` into the
            // contract, so live total_supply >= req.shares > 0; to_assets'
            // denominator `total_supply + VIRTUAL_OFFSET` (>= 2) can never be zero
            // and it already short-circuits shares == 0.
            debug_assert!(Base::total_supply(e) > 0);
            // Hoist total_assets WITHIN this iteration only (NOT across the loop):
            // total_assets legitimately changes between fulfilled requests
            // (ensure_liquidity divests, ReservedForClaims bumped, shares burned),
            // so a per-batch snapshot would misprice later requests. Compute `ta`
            // once here and reuse it for the claimable pricing, replacing the
            // second internal total_assets evaluation `to_assets` performed.
            // Value-identical to `to_assets(req.shares, Floor)`: req.shares > 0 is
            // guaranteed (escrowed at request_redeem) so the to_assets shares==0
            // short-circuit never applied.
            let ta = Self::total_assets(e);
            let claimable = mul_div_with_rounding(
                e,
                req.shares,
                ta + VIRTUAL_OFFSET,
                Base::total_supply(e) + VIRTUAL_OFFSET,
                Rounding::Floor,
            );
            // Gate on stable surplus only (H2). `free_capital` is a SEPARATE fresh
            // read: it derives stable_assets + cross-contract coverage_required and
            // must reflect current state at the gate — do NOT fold it into `ta`.
            if claimable > 0 && Self::free_capital(e) >= claimable {
                Self::ensure_liquidity(e, claimable);
                // Effects before further interactions: burn escrowed shares now.
                Base::update(e, Some(&e.current_contract_address()), None, req.shares);
                let reserved = Self::reserved_for_claims(e) + claimable;
                e.storage().instance().set(&DataKey::ReservedForClaims, &reserved);
                req.fulfilled = true;
                req.claimable = claimable;
                e.storage().persistent().set(&DataKey::Request(id), &req);
                // H6 analog: a fulfilled-but-unclaimed request must survive the
                // gap until claim — re-extend so it does not archive while waiting.
                e.storage()
                    .persistent()
                    .extend_ttl(&DataKey::Request(id), REQUEST_TTL_LEDGERS, REQUEST_TTL_LEDGERS);
            } else {
                still_pending.push_back(id);
            }
        }
        e.storage().instance().set(&DataKey::PendingRequests, &still_pending);
        e.storage().instance().set(&DataKey::Locked, &false);
    }

    pub fn claim(e: &Env, id: u32) {
        // Terminal write on a dying request: do NOT add a second explicit Request
        // extend (Self::request already bumps it once on read — acceptable for an
        // entry about to be consumed). Still bump the instance entry, which this
        // mutates via ReservedForClaims.
        Self::bump_instance(e);
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
        // Reentrancy guard (re-audit H1): disburse is the money-OUT path
        // (ensure_liquidity -> strategy.divest -> token.transfer). A
        // malicious/buggy adapter reached via ensure_liquidity gets control
        // mid-payout; without this it would see Locked == false (unlike
        // rebalance / process_redemptions, which already set it) and could
        // re-enter another vault callout path. Acquire AFTER require_auth and
        // BEFORE the overdraft check so both the assert and ensure_liquidity run
        // inside the lock — uniform mutual exclusion across all adapter-callout
        // paths. `disburse` takes owned `e: Env`, so use `&e` for storage()
        // (matches Vault::stable_assets_inner(&e) below). Additive: reuses the
        // existing DataKey::Locked bool — layout-safe in-place upgrade().
        assert!(
            !e.storage().instance().get::<_, bool>(&DataKey::Locked).unwrap_or(false),
            "reentrant call"
        );
        e.storage().instance().set(&DataKey::Locked, &true);
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
        e.storage().instance().set(&DataKey::Locked, &false);
    }

    fn collect_premium(e: Env, from: Address, amount: i128) {
        // Only callable by the registered policy contract.
        let policy: Address = e.storage().instance().get(&DataKey::Policy).expect("policy not set");
        policy.require_auth();
        assert!(amount > 0, "amount must be positive");
        // Reentrancy guard (re-audit H1, symmetry): collect_premium does ONE
        // callout — token.transfer pulling premium IN from the immutable
        // Underlying SAC — with its only effect (PremiumIncome += amount) AFTER
        // the transfer. The callee is the fixed SAC set at construction, not an
        // attacker-chosen adapter, so reentrancy risk is materially lower than
        // disburse. The guard is added anyway for uniform mutual exclusion across
        // ALL callout paths. Additive (reuses DataKey::Locked); behavior-preserving
        // (no current caller re-enters).
        assert!(
            !e.storage().instance().get::<_, bool>(&DataKey::Locked).unwrap_or(false),
            "reentrant call"
        );
        e.storage().instance().set(&DataKey::Locked, &true);
        Vault::token_client(&e).transfer(&from, e.current_contract_address(), &amount);
        let income = Vault::premium_income(&e) + amount;
        e.storage().instance().set(&DataKey::PremiumIncome, &income);
        e.storage().instance().set(&DataKey::Locked, &false);
    }

    fn stable_assets(e: Env) -> i128 {
        Vault::stable_assets_inner(&e)
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Vault {
    type ContractType = Base;
}
