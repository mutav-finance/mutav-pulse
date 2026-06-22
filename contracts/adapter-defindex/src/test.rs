#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use mock_defindex::{MockDefindex, MockDefindexClient};
use crate::{AdapterDefindex, AdapterDefindexClient};

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    underlying: Address,
    adapter: AdapterDefindexClient<'static>,
    adapter_id: Address,
    dfx: MockDefindexClient<'static>,
}

fn setup() -> Ctx {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let dfx_id = e.register(MockDefindex, (underlying.clone(),));
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);
    adapter.set_vault(&dfx_id);
    Ctx {
        token: token::TokenClient::new(&e, &underlying),
        token_admin: token::StellarAssetClient::new(&e, &underlying),
        underlying, adapter, adapter_id,
        dfx: MockDefindexClient::new(&e, &dfx_id),
        e,
    }
}

#[test]
fn invest_balance_accrue_divest() {
    let c = setup();
    assert_eq!(c.adapter.underlying(), c.underlying);
    assert_eq!(c.adapter.balance(), 0); // nothing invested yet

    // The mutav vault transfers USDC to the adapter, then calls invest.
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    assert_eq!(c.adapter.balance(), 1_000); // value of df-shares

    // Yield in DeFindex lifts the adapter's reported balance.
    c.dfx.accrue(&100);
    assert_eq!(c.adapter.balance(), 1_100);

    // Divest 550 USDC back to a recipient; ceil share math returns >= 550.
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&550, &to);
    assert!(returned >= 550);
    assert_eq!(c.token.balance(&to), returned);
    // Remaining value ~ 1100 - returned.
    assert_eq!(c.adapter.balance(), 1_100 - returned);
}

#[test]
fn divest_full_value_exits_cleanly() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&1_000, &to);
    assert_eq!(returned, 1_000);
    assert_eq!(c.adapter.balance(), 0);
}
