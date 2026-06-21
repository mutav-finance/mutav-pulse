#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use mock_strategy::{MockStrategy, MockStrategyClient};
use mock_policy::{MockPolicy, MockPolicyClient};
use crate::{Vault, VaultClient};

pub struct Ctx {
    pub e: Env,
    pub admin: Address,
    pub underlying: Address,
    pub token: token::TokenClient<'static>,
    pub token_admin: token::StellarAssetClient<'static>,
    pub vault: VaultClient<'static>,
    pub vault_id: Address,
    pub policy: MockPolicyClient<'static>,
}

pub fn setup() -> Ctx {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token = token::TokenClient::new(&e, &underlying);
    let token_admin = token::StellarAssetClient::new(&e, &underlying);
    let vault_id = e.register(Vault, (admin.clone(), underlying.clone()));
    let vault = VaultClient::new(&e, &vault_id);
    let policy_id = e.register(MockPolicy, (vault_id.clone(),));
    vault.set_policy(&policy_id);
    let policy = MockPolicyClient::new(&e, &policy_id);
    Ctx { e, admin, underlying, token, token_admin, vault, vault_id, policy }
}

pub fn add_mock(c: &Ctx, weight_bps: u32) -> MockStrategyClient<'static> {
    let id = c.e.register(MockStrategy, (c.underlying.clone(),));
    c.vault.add_strategy(&id, &weight_bps, &false);
    MockStrategyClient::new(&c.e, &id)
}

#[test]
fn deposit_and_nav_and_free_capital() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    assert_eq!(c.vault.deposit(&alice, &1_000), 1_000);
    assert_eq!(c.vault.nav_per_share(), 10_000_000);

    let s1 = add_mock(&c, 10_000);
    c.vault.rebalance();
    assert_eq!(s1.balance(), 1_000);
    assert_eq!(c.vault.total_assets(), 1_000);

    // free_capital reads the (mock) policy coverage.
    c.policy.set_coverage(&600);
    assert_eq!(c.vault.free_capital(), 400);
}

#[test]
fn redemption_gated_by_free_capital() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&alice, &1_000);

    c.policy.set_coverage(&800); // free capital = 200
    let rid = c.vault.request_redeem(&alice, &1_000);
    c.vault.process_redemptions(&10);
    assert!(!c.vault.request(&rid).fulfilled); // blocked

    c.policy.set_coverage(&0); // floor releases
    c.vault.process_redemptions(&10);
    assert!(c.vault.request(&rid).fulfilled);
    c.vault.claim(&rid);
    assert_eq!(c.token.balance(&alice), 1_000);
}

#[test]
fn disburse_and_collect_are_policy_gated() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&alice, &1_000);

    // collect_premium via the policy: no shares minted, NAV rises.
    let supply_before = c.vault.total_supply();
    c.policy.call_collect(&agency, &50);
    assert_eq!(c.vault.total_supply(), supply_before); // no new shares
    assert_eq!(c.vault.premium_income(), 50);
    assert_eq!(c.vault.total_assets(), 1_050);

    // disburse via the policy pays out.
    c.policy.call_disburse(&landlord, &100);
    assert_eq!(c.token.balance(&landlord), 100);

    // A non-policy caller cannot disburse: disable auth mocking so
    // policy.require_auth() in disburse actually enforces the caller.
    c.e.set_auths(&[]);
    assert!(c.vault.try_disburse(&landlord, &10).is_err());
}
