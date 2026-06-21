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

/// Ported from monolith `inflation_attack_does_not_zero_out_second_depositor`.
/// An attacker deposits 1 unit, then inflates the vault balance with a direct
/// token mint (donation attack). The virtual offset in the share formula must
/// ensure the victim still receives > 0 shares.
#[test]
fn inflation_attack_does_not_zero_out_second_depositor() {
    let c = setup();
    let attacker = Address::generate(&c.e);
    let victim = Address::generate(&c.e);
    c.token_admin.mint(&attacker, &1);
    c.token_admin.mint(&victim, &10_000);

    // Attacker seeds 1 unit then donates 10_000 straight to the vault id.
    c.vault.deposit(&attacker, &1);
    c.token_admin.mint(&c.vault_id, &10_000); // direct donation inflates assets

    // With the virtual offset, the victim still receives non-zero shares.
    let victim_shares = c.vault.deposit(&victim, &10_000);
    assert!(victim_shares > 0, "victim was inflated out of shares");
}

/// Ported from monolith `cancel_redeem_returns_escrowed_shares`.
/// Verifies that cancelling a redeem request returns the escrowed shares and
/// removes the request from the pending queue.
#[test]
fn cancel_redeem_returns_escrowed_shares() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&alice, &1_000);

    let rid = c.vault.request_redeem(&alice, &400);
    assert_eq!(c.vault.balance(&alice), 600); // 400 escrowed to vault
    assert_eq!(c.vault.pending_requests().len(), 1);

    c.vault.cancel_redeem(&rid);
    assert_eq!(c.vault.balance(&alice), 1_000); // shares returned
    assert_eq!(c.vault.pending_requests().len(), 0);
}
