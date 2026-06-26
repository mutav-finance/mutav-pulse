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
fn rebalance_retains_liquid_buffer() {
    // 20% buffer: deploy 800, retain 200 idle; total_assets unchanged.
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    let s1 = add_mock(&c, 10_000);
    c.vault.set_min_liquid_buffer_bps(&2_000);
    c.vault.rebalance();
    assert_eq!(s1.balance(), 800);
    assert_eq!(c.vault.available_held(), 200);
    assert_eq!(c.vault.total_assets(), 1_000);

    // Default (0) deploys everything.
    let c2 = setup();
    let bob = Address::generate(&c2.e);
    c2.token_admin.mint(&bob, &1_000);
    c2.vault.deposit(&1_000, &bob, &bob, &bob);
    let s2 = add_mock(&c2, 10_000);
    c2.vault.rebalance();
    assert_eq!(s2.balance(), 1_000);

    // 100% buffer retains everything idle.
    let c3 = setup();
    let carol = Address::generate(&c3.e);
    c3.token_admin.mint(&carol, &1_000);
    c3.vault.deposit(&1_000, &carol, &carol, &carol);
    let s3 = add_mock(&c3, 10_000);
    c3.vault.set_min_liquid_buffer_bps(&10_000);
    c3.vault.rebalance();
    assert_eq!(s3.balance(), 0);
    assert_eq!(c3.vault.available_held(), 1_000);
}

#[test]
fn set_buffer_rejects_above_100pct() {
    let c = setup();
    assert!(c.vault.try_set_min_liquid_buffer_bps(&10_001).is_err());
    assert!(c.vault.try_set_min_liquid_buffer_bps(&10_000).is_ok()); // boundary ok
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

// ───────────────────────────── invariant tests ─────────────────────────────

/// Vault overdraft guard in `disburse`: paying out more stable than the vault
/// holds must revert with "disburse breaches solvency"; paying out exactly the
/// stable balance is the inclusive boundary and must succeed.
#[test]
fn disburse_overdraft_guard_and_boundary() {
    // Over-limit: deposit 1_000, attempt to disburse 1_001 (> stable_assets).
    let c = setup();
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    assert_eq!(c.vault.stable_assets(), 1_000);
    // Proxy through the policy; the guard rejects the overdraw.
    assert!(c.policy.try_call_disburse(&landlord, &1_001).is_err());
    // Nothing moved.
    assert_eq!(c.token.balance(&landlord), 0);
    assert_eq!(c.vault.stable_assets(), 1_000);

    // Boundary: disbursing exactly stable_assets succeeds.
    let c2 = setup();
    let alice2 = Address::generate(&c2.e);
    let landlord2 = Address::generate(&c2.e);
    c2.token_admin.mint(&alice2, &1_000);
    c2.vault.deposit(&1_000, &alice2, &alice2, &alice2);
    c2.policy.call_disburse(&landlord2, &1_000);
    assert_eq!(c2.token.balance(&landlord2), 1_000);
    assert_eq!(c2.vault.stable_assets(), 0);
}

/// `process_redemptions(max_batch)` fulfils at most `max_batch` requests per call
/// and preserves FIFO order: with ample free capital, batch size 1 fulfils the
/// oldest request and leaves the rest queued; a second call fulfils the next.
#[test]
fn process_redemptions_bounds_batch_and_keeps_order() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &3_000);
    c.vault.deposit(&3_000, &alice, &alice, &alice);
    c.policy.set_coverage(&0); // ample free capital for all three

    let r0 = c.vault.request_redeem(&alice, &500);
    let r1 = c.vault.request_redeem(&alice, &500);
    let r2 = c.vault.request_redeem(&alice, &500);
    assert_eq!(c.vault.pending_requests().len(), 3);

    // Batch of 1: exactly the oldest (r0) is fulfilled; two remain queued.
    c.vault.process_redemptions(&1);
    assert!(c.vault.request(&r0).fulfilled);
    assert!(!c.vault.request(&r1).fulfilled);
    assert!(!c.vault.request(&r2).fulfilled);
    assert_eq!(c.vault.pending_requests().len(), 2);

    // Second batch of 1: the next in order (r1) is fulfilled.
    c.vault.process_redemptions(&1);
    assert!(c.vault.request(&r1).fulfilled);
    assert!(!c.vault.request(&r2).fulfilled);
    assert_eq!(c.vault.pending_requests().len(), 1);
}

/// Free-capital gate end-to-end: a redeem larger than `free_capital` stays
/// unfulfilled while coverage is high; once coverage drops, the same request is
/// fulfilled and claimable. (Coverage is driven via the mock policy here; the
/// real sign/pay/settle_guarantee variant belongs with the system tests that
/// wire the real `policy` contract — see note in the charter reply.)
#[test]
fn redeem_gate_releases_when_coverage_drops() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // Coverage high enough that free_capital (=1_000-900=100) < requested redeem.
    c.policy.set_coverage(&900);
    assert_eq!(c.vault.free_capital(), 100);
    let rid = c.vault.request_redeem(&alice, &1_000); // claimable ~1_000 > 100
    c.vault.process_redemptions(&10);
    assert!(!c.vault.request(&rid).fulfilled); // gated out

    // Coverage drops -> free capital releases; same request now fulfils + pays.
    c.policy.set_coverage(&0);
    c.vault.process_redemptions(&10);
    assert!(c.vault.request(&rid).fulfilled);
    c.vault.claim(&rid);
    assert_eq!(c.token.balance(&alice), 1_000);
}

/// `remove_strategy` divests the strategy's full balance (principal + accrued
/// yield) back into vault cash, drops it from `strategies()`, and leaves
/// `total_assets`/NAV unchanged across the removal (funds only move location).
#[test]
fn remove_strategy_divests_including_yield() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let s1 = add_mock(&c, 10_000);
    c.vault.rebalance();
    assert_eq!(s1.balance(), 1_000);

    // Accrue yield into the strategy: total_assets and NAV rise to reflect it.
    s1.accrue(&100);
    assert_eq!(s1.balance(), 1_100);
    let assets_before = c.vault.total_assets();
    let nav_before = c.vault.nav_per_share();
    assert_eq!(assets_before, 1_100);

    // Remove the strategy: its full balance (1_100, incl. yield) divests to cash.
    c.vault.remove_strategy(&s1.address);
    assert_eq!(c.vault.strategies().len(), 0);
    assert_eq!(s1.balance(), 0);
    assert_eq!(c.vault.available_held(), 1_100); // recovered into vault cash
    assert_eq!(c.vault.total_assets(), assets_before); // unchanged across removal
    assert_eq!(c.vault.nav_per_share(), nav_before);   // NAV invariant holds
}

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
