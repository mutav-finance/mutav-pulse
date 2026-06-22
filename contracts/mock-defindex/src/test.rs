#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, vec, Address, Env};
use crate::{MockDefindex, MockDefindexClient};

#[test]
fn deposit_accrue_withdraw_share_math() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token = token::TokenClient::new(&e, &underlying);
    let token_admin = token::StellarAssetClient::new(&e, &underlying);

    let user = Address::generate(&e);
    token_admin.mint(&user, &1_000);

    let id = e.register(MockDefindex, (underlying.clone(),));
    let dfx = MockDefindexClient::new(&e, &id);

    // First deposit: 1000 in -> 1000 shares minted to user.
    dfx.deposit(&vec![&e, 1_000], &vec![&e, 0], &user, &true);
    assert_eq!(dfx.balance(&user), 1_000); // df-shares (FungibleToken balance)
    assert_eq!(dfx.get_asset_amounts_per_shares(&1_000).get(0).unwrap(), 1_000);

    // Yield: +100 underlying -> 1000 shares now worth 1100.
    dfx.accrue(&100);
    assert_eq!(dfx.get_asset_amounts_per_shares(&1_000).get(0).unwrap(), 1_100);

    // Withdraw 500 shares -> 550 underlying back to user.
    let out = dfx.withdraw(&500, &vec![&e, 0], &user);
    assert_eq!(out.get(0).unwrap(), 550);
    assert_eq!(token.balance(&user), 550); // got 550 underlying
    assert_eq!(dfx.balance(&user), 500); // 500 shares left
}
