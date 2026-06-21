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
