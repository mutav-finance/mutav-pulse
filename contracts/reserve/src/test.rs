#![cfg(test)]
use soroban_sdk::testutils::Address as _;
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

fn add_mock(c: &Ctx, weight_bps: u32) -> MockStrategyClient<'static> {
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

#[test]
fn sign_guarantee_gated_by_free_capital() {
    let c = setup(10_000); // 100% coverage ratio
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);

    // Exposure = 100 * 6 * 100% = 600 <= free_capital 1000 -> ok.
    let gid = c.reserve.sign_guarantee(&landlord, &100, &6);
    assert_eq!(c.reserve.coverage_required(), 600);
    assert_eq!(c.reserve.free_capital(), 400);

    // Another 100*6 = 600 exposure but only 400 free -> must panic.
    let r = c.reserve.try_sign_guarantee(&landlord, &100, &6);
    assert!(r.is_err());

    // Settling the first frees the floor again.
    c.reserve.settle_guarantee(&gid);
    assert_eq!(c.reserve.coverage_required(), 0);
    assert_eq!(c.reserve.free_capital(), 1_000);
}

#[test]
fn cover_default_pays_one_month_and_keeps_active() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &2); // 2 months cap

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
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let s1 = add_mock(&c, 10_000);
    c.reserve.rebalance(); // all 1000 now in strategy, idle = 0
    assert_eq!(c.reserve.available_held(), 0);

    let gid = c.reserve.sign_guarantee(&landlord, &100, &1);
    c.reserve.cover_default(&gid); // must divest 100 to pay
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(s1.balance(), 900);
}
