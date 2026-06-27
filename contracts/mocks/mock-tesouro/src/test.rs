#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use crate::{MockTesouro, MockTesouroClient};

fn setup(e: &Env) -> (Address, Address, token::TokenClient, token::StellarAssetClient) {
    let admin = Address::generate(e);
    let issuer = Address::generate(e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    (
        admin,
        sac.address(),
        token::TokenClient::new(e, &sac.address()),
        token::StellarAssetClient::new(e, &sac.address()),
    )
}

#[test]
fn invest_then_accrue_raise_balance() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let (admin, underlying, _token, token_admin) = setup(&e);

    let id = e.register(MockTesouro, (admin.clone(), underlying.clone()));
    let strat = MockTesouroClient::new(&e, &id);
    assert_eq!(strat.underlying(), underlying);
    assert_eq!(strat.balance(), 0);

    // Reserve transfers underlying in, then calls invest: position marks up.
    token_admin.mint(&id, &1_000);
    strat.invest(&1_000);
    assert_eq!(strat.balance(), 1_000);

    // Keeper pre-transfers cBRL then accrues: stand-in for "TESOURO NAV rose".
    token_admin.mint(&id, &100);
    strat.accrue(&100);
    assert_eq!(strat.balance(), 1_100);
}

#[test]
fn divest_applies_exit_haircut_and_returns_net() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let (admin, underlying, token, token_admin) = setup(&e);

    let id = e.register(MockTesouro, (admin.clone(), underlying.clone()));
    let strat = MockTesouroClient::new(&e, &id);

    // Fund the position with 1_000 of cBRL value.
    token_admin.mint(&id, &1_000);
    strat.invest(&1_000);

    // 2% forced-exit spread.
    strat.set_exit_bps(&200);

    // Divest 500: net out = 500 - 500 * 200/10_000 = 500 - 10 = 490.
    let to = Address::generate(&e);
    let returned = strat.divest(&500, &to);
    assert_eq!(returned, 490);
    assert_eq!(token.balance(&to), 490);
    // The full `amt` is debited from the position; the withheld 10 stays stranded.
    assert_eq!(strat.balance(), 500);
    assert_eq!(token.balance(&id), 510); // 1_000 - 490 paid out
}

#[test]
fn set_exit_bps_rejects_above_100pct() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let (admin, underlying, _token, _token_admin) = setup(&e);

    let id = e.register(MockTesouro, (admin.clone(), underlying.clone()));
    let strat = MockTesouroClient::new(&e, &id);

    assert!(strat.try_set_exit_bps(&10_001).is_err());
    assert!(strat.try_set_exit_bps(&10_000).is_ok()); // boundary ok
}
