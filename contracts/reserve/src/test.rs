#![cfg(test)]
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{token, Address, Env};
use crate::{Reserve, ReserveClient};

pub struct Ctx {
    pub e: Env,
    pub admin: Address,
    pub underlying: Address,
    pub token: token::TokenClient<'static>,
    pub token_admin: token::StellarAssetClient<'static>,
    pub reserve: ReserveClient<'static>,
    pub reserve_id: Address,
}

pub fn setup(coverage_ratio_bps: u32) -> Ctx {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token = token::TokenClient::new(&e, &underlying);
    let token_admin = token::StellarAssetClient::new(&e, &underlying);
    let reserve_id = e.register(Reserve, (admin.clone(), underlying.clone(), coverage_ratio_bps));
    let reserve = ReserveClient::new(&e, &reserve_id);
    Ctx { e, admin, underlying, token, token_admin, reserve, reserve_id }
}

#[test]
fn deposit_mints_shares_one_to_one_first_time() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);

    let shares = c.reserve.deposit(&alice, &1_000);
    assert_eq!(shares, 1_000);
    assert_eq!(c.reserve.total_assets(), 1_000);
    assert_eq!(c.reserve.nav_per_share(), 10_000_000); // 1.0 scaled 1e7
    assert_eq!(c.token.balance(&c.reserve_id), 1_000);
}

#[test]
fn second_deposit_uses_nav() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&bob, &1_000);

    c.reserve.deposit(&alice, &1_000); // supply 1000, assets 1000
    // Simulate a gain by minting underlying straight to the reserve.
    c.token_admin.mint(&c.reserve_id, &1_000); // assets 2000, supply 1000 -> NAV 2.0
    assert_eq!(c.reserve.nav_per_share(), 20_000_000);

    let shares = c.reserve.deposit(&bob, &1_000); // 1000*(1000+1)/(2000+1) = 500
    assert_eq!(shares, 500);
}

#[test]
fn inflation_attack_does_not_zero_out_second_depositor() {
    let c = setup(10_000);
    let attacker = Address::generate(&c.e);
    let victim = Address::generate(&c.e);
    c.token_admin.mint(&attacker, &1);
    c.token_admin.mint(&victim, &10_000);

    // Attacker seeds 1 unit then donates 10_000 straight to the vault.
    c.reserve.deposit(&attacker, &1);
    c.token_admin.mint(&c.reserve_id, &10_000); // direct donation inflates assets

    // With the virtual offset, the victim still receives non-zero shares.
    let victim_shares = c.reserve.deposit(&victim, &10_000);
    assert!(victim_shares > 0, "victim was inflated out of shares");
}

use mock_strategy::{MockStrategy, MockStrategyClient};

pub fn add_mock(c: &Ctx, weight_bps: u32) -> MockStrategyClient<'static> {
    let id = c.e.register(MockStrategy, (c.underlying.clone(),));
    c.reserve.add_strategy(&id, &weight_bps, &false); // stable mock
    MockStrategyClient::new(&c.e, &id)
}

#[test]
fn rebalance_allocates_to_strategies_and_total_assets_sums() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);

    let s1 = add_mock(&c, 6_000); // 60%
    let s2 = add_mock(&c, 4_000); // 40%
    c.reserve.rebalance();

    assert_eq!(s1.balance(), 600);
    assert_eq!(s2.balance(), 400);
    assert_eq!(c.reserve.available_held(), 0);
    assert_eq!(c.reserve.total_assets(), 1_000);

    // Yield in a strategy lifts NAV.
    s1.accrue(&100);
    assert_eq!(c.reserve.total_assets(), 1_100);
    assert_eq!(c.reserve.nav_per_share(), 11_000_000);
}

const MONTH: u64 = 2_592_000;

#[test]
fn premium_activates_and_gates_coverage() {
    let c = setup(10_000); // 100% coverage ratio
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000); // premium funds
    c.reserve.deposit(&alice, &1_000);

    // Sign two guarantees (100/mo x 6mo, 12% fee). Nothing locked yet.
    let g0 = c.reserve.sign_guarantee(&landlord, &100, &6, &1_200, &MONTH);
    let g1 = c.reserve.sign_guarantee(&landlord, &100, &6, &1_200, &MONTH);
    assert_eq!(c.reserve.coverage_required(), 0); // unpaid -> uncovered
    assert_eq!(c.reserve.monthly_premium(&g0), 12); // 100 * 12%

    // Pay g0 -> activates 600 coverage; premium 12 flows into the reserve.
    c.reserve.pay_premium(&agency, &g0);
    assert!(c.reserve.is_current(&g0));
    assert_eq!(c.reserve.coverage_required(), 600);
    assert_eq!(c.reserve.total_assets(), 1_012);

    // Activating g1 too would need 1200 backing but only ~1024 is stable ->
    // the capacity gate reverts at pay_premium (and rolls back the transfer).
    let r = c.reserve.try_pay_premium(&agency, &g1);
    assert!(r.is_err());
    assert_eq!(c.reserve.coverage_required(), 600); // unchanged

    // Settling g0 frees the floor.
    c.reserve.settle_guarantee(&g0);
    assert_eq!(c.reserve.coverage_required(), 0);
}

#[test]
fn premium_income_lifts_nav() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000);
    assert_eq!(c.reserve.nav_per_share(), 10_000_000); // 1.00

    let gid = c.reserve.sign_guarantee(&landlord, &100, &6, &1_000, &MONTH); // 10% fee
    c.reserve.pay_premium(&agency, &gid); // +10 revenue, no shares minted
    assert_eq!(c.reserve.total_assets(), 1_010);
    assert_eq!(c.reserve.nav_per_share(), 10_100_000); // 1.01 -> premium accrues to investors
}

#[test]
fn cover_default_pays_one_month_and_keeps_active() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &2, &1_000, &MONTH); // 2 months cap
    c.reserve.pay_premium(&agency, &gid); // activate coverage

    c.reserve.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
    let g = c.reserve.guarantee(&gid);
    assert_eq!(g.months_used, 1);
    assert!(g.active); // still active
    // remaining exposure 100*1 = 100
    assert_eq!(c.reserve.coverage_required(), 100);

    c.reserve.cover_default(&gid); // exhausts the cap
    assert_eq!(c.token.balance(&landlord), 200);
    let g2 = c.reserve.guarantee(&gid);
    assert_eq!(g2.months_used, 2);
    assert!(!g2.active); // auto-settled
    assert_eq!(c.reserve.coverage_required(), 0);
}

#[test]
fn cover_default_divests_when_idle_is_short() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &1, &1_000, &MONTH);
    c.reserve.pay_premium(&agency, &gid); // +10 into the vault
    let s1 = add_mock(&c, 10_000);
    c.reserve.rebalance(); // all 1010 now in strategy, idle = 0
    assert_eq!(c.reserve.available_held(), 0);

    c.reserve.cover_default(&gid); // must divest 100 to pay
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(s1.balance(), 910); // 1010 - 100
}

#[test]
fn redemption_only_from_surplus_then_claim() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    let agency = Address::generate(&c.e);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000); // alice holds 1000 shares

    // Lock 800 into coverage via an active (paid) guarantee.
    c.reserve.sign_guarantee(&landlord, &100, &8, &1_000, &MONTH); // exposure 800
    c.reserve.pay_premium(&agency, &0); // +10, activates coverage
    assert_eq!(c.reserve.free_capital(), 210); // stable 1010 - coverage 800

    // Alice requests to redeem all 1000 shares.
    let rid = c.reserve.request_redeem(&alice, &1_000);
    c.reserve.process_redemptions(&10);

    // Surplus is only ~210, so the full request cannot fulfill.
    let req = c.reserve.request(&rid);
    assert!(!req.fulfilled);

    // Settle the guarantee -> floor releases, request can fulfill.
    c.reserve.settle_guarantee(&0);
    c.reserve.process_redemptions(&10);
    let req2 = c.reserve.request(&rid);
    assert!(req2.fulfilled);
    // alice (sole shareholder) gets her deposit back plus the accrued premium.
    assert!(req2.claimable >= 1_000);

    c.reserve.claim(&rid);
    assert!(c.token.balance(&alice) >= 1_000);
    // shares burned; only rounding dust remains.
    assert!(c.reserve.total_assets() <= 2);
}

#[test]
fn cover_default_has_priority_over_queue() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &4, &1_000, &MONTH); // exposure 400
    c.reserve.pay_premium(&agency, &gid); // activate coverage

    // Alice queues to exit 1000 (more than the surplus).
    let rid = c.reserve.request_redeem(&alice, &1_000);
    c.reserve.process_redemptions(&10);
    assert!(!c.reserve.request(&rid).fulfilled); // blocked by the floor

    // A default is still served from the reserve, ahead of the queue.
    c.reserve.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
}

#[test]
fn cancel_redeem_returns_escrowed_shares() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);

    let rid = c.reserve.request_redeem(&alice, &400);
    assert_eq!(c.reserve.balance(&alice), 600); // escrowed
    assert_eq!(c.reserve.pending_requests().len(), 1);

    c.reserve.cancel_redeem(&rid);
    assert_eq!(c.reserve.balance(&alice), 1_000); // returned
    assert_eq!(c.reserve.pending_requests().len(), 0);
}

#[test]
fn cover_default_halted_until_premiums_current() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &3, &1_000, &MONTH);

    // Unpaid: not current, coverage halted.
    assert!(!c.reserve.is_current(&gid));
    assert!(c.reserve.try_cover_default(&gid).is_err());

    // Pay the premium -> current -> coverage resumes.
    c.reserve.pay_premium(&agency, &gid);
    assert!(c.reserve.is_current(&gid));
    c.reserve.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
}

#[test]
fn coverage_lapses_when_premium_period_passes() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.reserve.deposit(&alice, &1_000);

    // Short 100-second period; pay once -> covered through t=100.
    let gid = c.reserve.sign_guarantee(&landlord, &100, &6, &1_000, &100);
    c.reserve.pay_premium(&agency, &gid);
    assert!(c.reserve.is_current(&gid));
    assert_eq!(c.reserve.coverage_required(), 600);

    // Time advances past the paid period -> coverage lapses, capital is freed.
    c.e.ledger().set_timestamp(150);
    assert!(!c.reserve.is_current(&gid));
    assert_eq!(c.reserve.coverage_required(), 0);
    assert!(c.reserve.try_cover_default(&gid).is_err());

    // Agency catches up -> coverage resumes.
    c.reserve.pay_premium(&agency, &gid);
    assert!(c.reserve.is_current(&gid));
    assert_eq!(c.reserve.coverage_required(), 600);
}

#[test]
fn set_admin_rotates_authority() {
    let c = setup(10_000);
    let new_admin = Address::generate(&c.e);
    c.reserve.set_admin(&new_admin);
    assert_eq!(c.reserve.admin(), new_admin);
}

#[test]
fn remove_strategy_divests_and_drops_it() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let s1 = add_mock(&c, 10_000);
    c.reserve.rebalance();
    assert_eq!(s1.balance(), 1_000);
    assert_eq!(c.reserve.strategies().len(), 1);

    c.reserve.remove_strategy(&s1.address);
    assert_eq!(s1.balance(), 0);                 // fully divested
    assert_eq!(c.reserve.available_held(), 1_000); // back in the vault
    assert_eq!(c.reserve.strategies().len(), 0);   // dropped from registry
    assert_eq!(c.reserve.total_assets(), 1_000);   // value preserved
}
