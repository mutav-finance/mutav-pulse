#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use crate::{MockStrategy, MockStrategyClient};

fn setup(e: &Env) -> (Address, token::TokenClient, token::StellarAssetClient) {
    let issuer = Address::generate(e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    (
        sac.address(),
        token::TokenClient::new(e, &sac.address()),
        token::StellarAssetClient::new(e, &sac.address()),
    )
}

#[test]
fn invest_then_balance_then_divest() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let (underlying, token, token_admin) = setup(&e);

    let id = e.register(MockStrategy, (underlying.clone(),));
    let strat = MockStrategyClient::new(&e, &id);
    // Wire the controller so the auth gate passes under mock_all_auths. (audit H1/H4)
    let controller = Address::generate(&e);
    strat.set_controller(&controller);
    assert_eq!(strat.underlying(), underlying);

    // Reserve would transfer underlying in, then call invest.
    token_admin.mint(&id, &1_000);
    strat.invest(&1_000);
    assert_eq!(strat.balance(), 1_000);

    // Simulate yield.
    strat.accrue(&100);
    assert_eq!(strat.balance(), 1_100);

    // Divest half back to a recipient.
    let to = Address::generate(&e);
    let returned = strat.divest(&500, &to);
    assert_eq!(returned, 500);
    assert_eq!(token.balance(&to), 500);
    assert_eq!(strat.balance(), 600);
}

/// H1: the mock now exercises the auth gate — divest traps for a non-controller.
#[test]
fn divest_traps_for_non_controller_caller() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let (underlying, _token, token_admin) = setup(&e);
    let id = e.register(MockStrategy, (underlying.clone(),));
    let strat = MockStrategyClient::new(&e, &id);
    let controller = Address::generate(&e);
    strat.set_controller(&controller);
    token_admin.mint(&id, &1_000);
    strat.invest(&1_000); // controller-authorized
    e.set_auths(&[]);
    let to = Address::generate(&e);
    assert!(strat.try_divest(&500, &to).is_err());
}

/// H4: symmetric negative test for invest on the mock.
#[test]
fn invest_traps_for_non_controller_caller() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let (underlying, _token, token_admin) = setup(&e);
    let id = e.register(MockStrategy, (underlying.clone(),));
    let strat = MockStrategyClient::new(&e, &id);
    let controller = Address::generate(&e);
    strat.set_controller(&controller);
    token_admin.mint(&id, &1_000);
    e.set_auths(&[]);
    assert!(strat.try_invest(&1_000).is_err());
}
