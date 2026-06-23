#![cfg(test)]
use soroban_sdk::testutils::{Address as _, Events as _};
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
    assert_eq!(c.vault.deposit(&1_000, &alice, &alice, &alice), 1_000);
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
    c.vault.deposit(&1_000, &alice, &alice, &alice);

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
    c.vault.deposit(&1_000, &alice, &alice, &alice);

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
    c.vault.deposit(&1, &attacker, &attacker, &attacker);
    c.token_admin.mint(&c.vault_id, &10_000); // direct donation inflates assets

    // With the virtual offset, the victim still receives non-zero shares.
    let victim_shares = c.vault.deposit(&10_000, &victim, &victim, &victim);
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
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let rid = c.vault.request_redeem(&alice, &400);
    assert_eq!(c.vault.balance(&alice), 600); // 400 escrowed to vault
    assert_eq!(c.vault.pending_requests().len(), 1);

    c.vault.cancel_redeem(&rid);
    assert_eq!(c.vault.balance(&alice), 1_000); // shares returned
    assert_eq!(c.vault.pending_requests().len(), 0);
}

// ───────────────────────────── SEP-0056 conformance ─────────────────────────────

#[test]
fn sep_query_asset_is_underlying() {
    let c = setup();
    assert_eq!(c.vault.query_asset(), c.underlying);
}

#[test]
fn sep_preview_matches_deposit_and_converts_round_trip() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    // At unit NAV the preview must equal the realized share count.
    let previewed = c.vault.preview_deposit(&1_000);
    assert_eq!(c.vault.deposit(&1_000, &alice, &alice, &alice), previewed);
    // Round-trip never mints value: assets→shares→assets <= original (floor).
    let shares = c.vault.convert_to_shares(&500);
    assert!(c.vault.convert_to_assets(&shares) <= 500);
}

#[test]
fn sep_preview_rounding_directions() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    // Push NAV above 1.0 via a donation so rounding actually bites.
    c.token_admin.mint(&c.vault_id, &500);
    // "in" previews round up, "out"/convert round down — ceil >= floor.
    assert!(c.vault.preview_withdraw(&300) >= c.vault.convert_to_shares(&300));
    assert!(c.vault.preview_mint(&300) >= c.vault.convert_to_assets(&300));
}

#[test]
fn sep_max_views_reflect_queue_only_policy() {
    let c = setup();
    let alice = Address::generate(&c.e);
    assert_eq!(c.vault.max_deposit(&alice), i128::MAX);
    assert_eq!(c.vault.max_mint(&alice), i128::MAX);
    // D2: synchronous withdrawals disabled.
    assert_eq!(c.vault.max_withdraw(&alice), 0);
    assert_eq!(c.vault.max_redeem(&alice), 0);
}

#[test]
fn sep_withdraw_and_redeem_are_disabled() {
    let c = setup();
    let alice = Address::generate(&c.e);
    assert!(c.vault.try_withdraw(&1, &alice, &alice, &alice).is_err());
    assert!(c.vault.try_redeem(&1, &alice, &alice, &alice).is_err());
}

#[test]
fn sep_mint_mints_exact_shares() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    let assets = c.vault.mint(&500, &alice, &alice, &alice);
    assert_eq!(c.vault.balance(&alice), 500); // exact shares minted
    assert_eq!(assets, c.vault.preview_mint(&500)); // returns assets consumed (idempotent at this NAV)
    assert_eq!(c.token.balance(&alice), 1_000 - assets);
}

#[test]
fn sep_deposit_operator_delegation_via_allowance() {
    let c = setup();
    let owner = Address::generate(&c.e);   // provides assets (`from`)
    let operator = Address::generate(&c.e); // delegated caller
    let receiver = Address::generate(&c.e); // gets the shares
    c.token_admin.mint(&owner, &1_000);
    // owner grants the operator an allowance on the underlying.
    c.token.approve(&owner, &operator, &1_000, &1_000);
    let shares = c.vault.deposit(&1_000, &receiver, &owner, &operator);
    assert!(shares > 0);
    assert_eq!(c.vault.balance(&receiver), shares); // receiver holds the shares
    assert_eq!(c.token.balance(&owner), 0);         // assets pulled from owner
}

#[test]
fn sep_deposit_emits_event() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    // The vault emits a Deposit event (only deposit/mint emit from the vault id).
    let vault_events = c.e.events().all().filter_by_contract(&c.vault_id);
    assert!(!vault_events.events().is_empty());
}
