#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::testutils::Events as _;
use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{token, Address, Env, String};
use vault::{Vault, VaultClient};
use registry::{Registry, RegistryClient};
use crate::{Policy, PolicyClient};

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    vault: VaultClient<'static>,
    policy: PolicyClient<'static>,
    policy_id: Address,
}

fn setup() -> Ctx {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();

    let registry_id = e.register(Registry, (admin.clone(),));
    let vault_id = e.register(
        Vault,
        (
            admin.clone(),
            underlying.clone(),
            String::from_str(&e, "Mutav Reserve"),
            String::from_str(&e, "mtvR"),
        ),
    );
    let policy_id = e.register(Policy, (admin.clone(),));

    let registry = RegistryClient::new(&e, &registry_id);
    let vault = VaultClient::new(&e, &vault_id);
    let policy = PolicyClient::new(&e, &policy_id);

    registry.set_writer(&policy_id);
    policy.set_vault(&vault_id);
    policy.set_registry(&registry_id);
    policy.set_coverage_ratio_bps(&10_000);
    vault.set_policy(&policy_id);

    Ctx {
        token: token::TokenClient::new(&e, &underlying),
        token_admin: token::StellarAssetClient::new(&e, &underlying),
        e, vault, policy, policy_id,
    }
}

#[test]
fn premium_gated_coverage_and_default() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    assert_eq!(c.policy.coverage_required(), 0); // unpaid -> uncovered
    assert!(c.policy.try_cover_default(&gid).is_err()); // halted

    c.policy.pay_premium(&agency, &gid); // activates + 10 revenue
    assert!(c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 600);
    assert_eq!(c.vault.total_assets(), 1_010);
    assert_eq!(c.vault.premium_income(), 10);

    c.policy.cover_default(&gid); // pays landlord via vault.disburse
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(c.policy.coverage_required(), 500);
}

/// Ported from monolith `coverage_lapses_when_premium_period_passes` +
/// `cover_default_halted_until_premiums_current`.
/// Uses a short 100-second period so ledger.set_timestamp can advance past it.
#[test]
fn cover_default_halted_and_coverage_lapses_over_time() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // Unpaid: cover_default is halted, is_current is false.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &100); // 100-sec period
    assert!(!c.policy.is_current(&gid));
    assert!(c.policy.try_cover_default(&gid).is_err());

    // Pay the premium -> is_current, coverage active.
    c.policy.pay_premium(&agency, &gid);
    assert!(c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 600);

    // Advance past the paid_until timestamp -> coverage lapses.
    c.e.ledger().set_timestamp(150);
    assert!(!c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 0);
    assert!(c.policy.try_cover_default(&gid).is_err());
}

// === Charter invariant tests ===

/// 1a. A single-month guarantee: one cover_default exhausts coverage and
/// auto-deactivates. Landlord receives monthly_amount, coverage drops to 0,
/// and a second cover_default errors because the guarantee is now inactive.
#[test]
fn cover_default_single_month_exhausts_and_deactivates() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // 1-month guarantee, monthly_amount 100.
    let gid = c.policy.sign_guarantee(&landlord, &100, &1, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    assert_eq!(c.policy.coverage_required(), 100);

    c.policy.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
    assert!(!c.policy.guarantee(&gid).active);
    assert_eq!(c.policy.coverage_required(), 0);

    // Second cover_default is halted: guarantee inactive.
    assert!(c.policy.try_cover_default(&gid).is_err());
}

/// 1b. A 2-month guarantee: coverage_required steps down by monthly_amount per
/// cover_default, and active stays true until the final (exhausting) call.
#[test]
fn cover_default_steps_down_and_stays_active_until_final() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &2, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    assert_eq!(c.policy.coverage_required(), 200);

    // First default: steps down by monthly_amount, still active.
    c.policy.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(c.policy.coverage_required(), 100);
    assert!(c.policy.guarantee(&gid).active);

    // Second (final) default: steps down to 0, now inactive.
    c.policy.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 200);
    assert_eq!(c.policy.coverage_required(), 0);
    assert!(!c.policy.guarantee(&gid).active);
}

/// 2a. cover_default halting guard: once months_used == months_covered the
/// guarantee is inactive AND coverage exhausted. We exercise the
/// "coverage exhausted" guard directly by re-activating via settle is not
/// possible, so we drive months_used to the cap and confirm the halt. The
/// inactive flag is set at the same time, so the first reachable assert is
/// "guarantee inactive"; the "coverage exhausted" branch is unreachable while
/// active==false. We therefore assert the call simply errors after exhaustion.
#[test]
fn cover_default_halts_when_months_used_at_cap() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &1, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    c.policy.cover_default(&gid); // months_used now == months_covered
    // Further cover_default is halted.
    assert!(c.policy.try_cover_default(&gid).is_err());
}

/// 2b. cover_default halting guard: a paid guarantee whose ledger timestamp is
/// advanced past paid_until before default is halted ("premiums not up to date").
#[test]
fn cover_default_halts_when_premiums_lapsed() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // Short 100-sec period so we can advance past paid_until.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &100);
    c.policy.pay_premium(&agency, &gid);
    assert!(c.policy.is_current(&gid));

    // Advance past paid_until: guarantee is still active and not exhausted,
    // but premiums have lapsed -> cover_default halted.
    c.e.ledger().set_timestamp(150);
    assert!(c.policy.guarantee(&gid).active);
    assert!(c.policy.try_cover_default(&gid).is_err());
}

/// 3. settle_guarantee end-to-end: a paid (active, covered) guarantee is
///    deactivated by settle_guarantee. Coverage drops to 0 and cover_default
///    is subsequently halted.
#[test]
fn settle_guarantee_deactivates_and_zeros_coverage() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    assert!(c.policy.coverage_required() > 0);

    c.policy.settle_guarantee(&gid);
    assert!(!c.policy.guarantee(&gid).active);
    assert_eq!(c.policy.coverage_required(), 0);
    assert!(c.policy.try_cover_default(&gid).is_err());
}

/// 4. pay_premium post-activation solvency rollback: with a thin reserve, a
///    guarantee whose coverage_required exceeds stable_assets cannot be activated.
///    pay_premium must error ("insufficient capital to activate coverage") and the
///    whole call rolls back -- premium_income() and total_assets() are unchanged.
#[test]
fn pay_premium_rolls_back_when_coverage_exceeds_stable_assets() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    // Thin reserve: only 100 deposited.
    c.vault.deposit(&100, &alice, &alice, &alice);

    let assets_before = c.vault.total_assets();
    let premium_before = c.vault.premium_income();

    // monthly_amount 100 * 6 months = 600 coverage required > 100 stable.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    assert!(c.policy.try_pay_premium(&agency, &gid).is_err());

    // Whole call rolled back: no premium collected, no asset change.
    assert_eq!(c.vault.premium_income(), premium_before);
    assert_eq!(c.vault.total_assets(), assets_before);
}

/// 4 (boundary). pay_premium succeeds when coverage exactly equals stable_assets.
#[test]
fn pay_premium_succeeds_when_coverage_equals_stable_assets() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    // Reserve 590; the 10-unit premium (100 * 1000bps / 10000) lifts stable_assets
    // to exactly 600 == coverage (100 * 6), the true >= boundary.
    c.vault.deposit(&590, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    // Boundary: stable_assets (590 + 10 premium) == coverage_required (600) holds.
    c.policy.pay_premium(&agency, &gid);
    assert!(c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 600);
}

/// 5a. pay_premium renewal stacking: paying twice while still current extends
/// paid_until by exactly one period from the prior paid_until (stacking, not reset).
#[test]
fn pay_premium_renewal_stacks_paid_until() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let period: u64 = 2_592_000;
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &period);
    c.policy.pay_premium(&agency, &gid);
    let first_paid_until = c.policy.guarantee(&gid).paid_until;

    // Pay again while still current -> stacks onto first_paid_until.
    c.policy.pay_premium(&agency, &gid);
    assert_eq!(c.policy.guarantee(&gid).paid_until, first_paid_until + period);
}

/// sign_guarantee bounds fee_bps at 100 percent (10_000 bps): a fee above the
/// cap is rejected with the typed FeeTooHigh error, while the 10_000 boundary
/// still succeeds and mints a guarantee.
#[test]
fn sign_guarantee_rejects_fee_above_100pct_and_allows_boundary() {
    use crate::PolicyError;
    let c = setup();
    let landlord = Address::generate(&c.e);

    // 10_001 bps (> 100%) is rejected with the typed error.
    let res = c.policy.try_sign_guarantee(&landlord, &100, &6, &10_001, &2_592_000);
    assert_eq!(res, Err(Ok(PolicyError::FeeTooHigh)));

    // The 10_000 (== 100%) boundary still succeeds.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &10_000, &2_592_000);
    assert_eq!(c.policy.guarantee(&gid).fee_bps, 10_000);
}

// ─────────────────── arithmetic widening / overflow (H2 + mediums) ───────────────────

/// Nexus coverage-anchored solvency: `coverage_required` must round the capital
/// floor UP (Ceil) so the pre-disburse gate is never understated. With a ratio
/// that does NOT divide evenly, the result is strictly greater than the floor.
/// RED-first: the prior `raw*ratio/BPS_DENOM` truncation floors this value.
#[test]
fn coverage_required_rounds_up() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &10_000);
    c.token_admin.mint(&agency, &10_000);
    c.vault.deposit(&10_000, &alice, &alice, &alice);

    // raw = monthly_amount(100) * months_covered(6) = 600.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);

    // 7_500 bps: 600 * 7_500 / 10_000 = 4_500_000 / 10_000 = 450 exactly — even.
    // Use 7_511 bps to force a non-even divide: 600*7_511 = 4_506_600;
    // /10_000 = 450 (floor), ceil = 451.
    c.policy.set_coverage_ratio_bps(&7_511);
    let raw = 600i128;
    let ratio = 7_511i128;
    let floor = raw * ratio / 10_000;
    let ceil = (raw * ratio + 10_000 - 1) / 10_000;
    assert_eq!(floor, 450);
    assert_eq!(ceil, 451);
    assert_eq!(c.policy.coverage_required(), ceil); // rounds UP
    assert!(c.policy.coverage_required() > floor);
}

/// With the default ratio (10_000 bps), Ceil of raw*10_000/10_000 == raw exactly
/// (no +1) — confirming the default-config figures do not shift.
#[test]
fn coverage_required_default_ratio_unchanged() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &10_000);
    c.token_admin.mint(&agency, &10_000);
    c.vault.deposit(&10_000, &alice, &alice, &alice);

    // default ratio is 10_000 bps (set in setup()).
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    assert_eq!(c.policy.coverage_required(), 600); // == raw, no rounding shift
}

/// `set_coverage_ratio_bps` accepts a legitimate over-collateralization ratio
/// (200%) but rejects an overflow-class value above the 10*BPS_DENOM ceiling.
#[test]
fn set_coverage_ratio_bps_accepts_over_collateralization() {
    let c = setup();
    c.policy.set_coverage_ratio_bps(&20_000); // 200% — allowed
}

#[test]
#[should_panic]
fn set_coverage_ratio_bps_rejects_overflow_class() {
    let c = setup();
    c.policy.set_coverage_ratio_bps(&200_000); // > 1000% ceiling — rejected
}

/// `monthly_premium` (premium_of, Floor) is behavior-preserving for normal terms.
#[test]
fn premium_of_unchanged_for_normal_terms() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    // monthly_amount 100, fee_bps 1_000 → 100 * 1_000 / 10_000 = 10.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    assert_eq!(c.policy.monthly_premium(&gid), 10);
}

/// 5b. pay_premium rejects an inactive guarantee ("guarantee inactive").
#[test]
fn pay_premium_rejects_inactive_guarantee() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    // Deactivate via settle.
    c.policy.settle_guarantee(&gid);
    assert!(!c.policy.guarantee(&gid).active);

    // Now paying is rejected.
    assert!(c.policy.try_pay_premium(&agency, &gid).is_err());
}

// ─────────────────── policy lifecycle events (observability) ───────────────────

/// sign_guarantee emits exactly one policy-contract event (GuaranteeSigned),
/// mirroring the vault's sep_deposit_emits_event. A lone sign_guarantee is the
/// only policy-id state mutation, so the policy-contract event count is exactly 1.
#[test]
fn sign_guarantee_emits_guarantee_signed_event() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert_eq!(policy_events.events().len(), 1);
}

/// pay_premium emits PremiumPaid on the solvent (activating) path. `events().all()`
/// reflects only the last (successful) top-level invocation, mirroring the vault's
/// sep_deposit_emits_event presence check.
#[test]
fn pay_premium_emits_premium_paid_event() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    // The activating pay_premium publishes a PremiumPaid on the policy contract id.
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}

/// Insolvent pay_premium rolls back AND publishes no PremiumPaid — emit-after-assert.
/// A failed last invocation yields no events at all (testutils semantics), so the
/// policy-contract filter is empty.
#[test]
fn pay_premium_insolvent_emits_no_event() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    // Thin reserve: 100 < 600 coverage required.
    c.vault.deposit(&100, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    assert!(c.policy.try_pay_premium(&agency, &gid).is_err());
    // Rolled back / failed invocation: no PremiumPaid published.
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(policy_events.events().is_empty());
}

/// cover_default emits DefaultCovered on the happy path.
#[test]
fn cover_default_emits_default_covered_event() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    c.policy.cover_default(&gid);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}

/// cover_default halted path (unpaid guarantee) emits nothing — proving the
/// emit-after-disburse-success ordering. A failed last invocation yields no events.
#[test]
fn cover_default_halted_emits_no_event() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // Unpaid guarantee: cover_default is halted ("premiums not up to date").
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    assert!(c.policy.try_cover_default(&gid).is_err());
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(policy_events.events().is_empty());
}

/// settle_guarantee emits GuaranteeSettled on the policy contract id.
#[test]
fn settle_guarantee_emits_settled_event() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    c.policy.settle_guarantee(&gid);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}

/// Field-shape lock: on a 2-month guarantee, the first cover_default decrements to
/// months_used==1 / months_remaining==1 — the values DefaultCovered carries. The
/// on-chain guarantee state cross-checks the event body, and the event is present.
#[test]
fn cover_default_event_carries_months_remaining() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let gid = c.policy.sign_guarantee(&landlord, &100, &2, &1_000, &2_592_000);
    c.policy.pay_premium(&agency, &gid);
    c.policy.cover_default(&gid);
    // Capture events immediately after cover_default — any later read invocation
    // (e.g. guarantee()) would replace the last-invocation event set.
    let evs = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!evs.events().is_empty()); // DefaultCovered present

    // Cross-check the on-chain state the event mirrors: months_used==1,
    // months_remaining (months_covered - months_used) == 1.
    let g = c.policy.guarantee(&gid);
    assert_eq!(g.months_used, 1);
    assert_eq!(g.months_covered - g.months_used, 1);
}
