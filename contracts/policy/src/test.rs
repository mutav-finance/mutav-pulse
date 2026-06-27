#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::testutils::Events as _;
use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{token, Address, Env, String};
use vault::{Vault, VaultClient};
use registry::{Registry, RegistryClient};
use crate::{Policy, PolicyClient};

const DEFAULT_GRACE_SECS: u64 = 432_000;
const PERIOD: u64 = 2_592_000;

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    vault: VaultClient<'static>,
    registry: RegistryClient<'static>,
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
        e, vault, registry, policy, policy_id,
    }
}

/// Mint + deposit `amount` of underlying into the vault as freely-available
/// reserve so the `sign_guarantee` capacity gate has capital to assert against.
fn fund(c: &Ctx, amount: i128) {
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &amount);
    c.vault.deposit(&amount, &alice, &alice, &alice);
}

// ─────────────────────── sign: both legs reserved immediately ───────────────────────

/// The fiador commits at signing: BOTH legs (default `monthly * months_covered` +
/// exit `monthly * exit_months`) are reserved immediately — `coverage_required`
/// equals the full 9× obligation right after sign, with NO pay_fee. (The fee
/// stream is the default oracle, not a coverage gate.)
#[test]
fn sign_reserves_both_legs_immediately() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 1_000);
    // monthly 100, default 3 + exit 6 -> 100 * 9 = 900 reserved at sign.
    let _gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 900); // no pay_fee needed
}

/// `coverage_required` is an O(1) read of the registry's running raw aggregate
/// (no O(n) loop): at ratio 1.0 it equals `registry.raw_coverage()` and the
/// hand-summed Σ contribution, and its ledger-entry read count is a small
/// constant independent of the number of guarantees (mirrors the deleted
/// _stays_within_budget metering, now without the cap/loop).
#[test]
fn coverage_required_is_o1_read_of_raw_coverage() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 2_000);

    let _g1 = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD); // 900
    let _g2 = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD); // 900

    let hand_sum = 900 + 900;
    assert_eq!(c.policy.coverage_required(), hand_sum);
    assert_eq!(c.registry.raw_coverage(), hand_sum);
    assert_eq!(c.policy.coverage_required(), c.registry.raw_coverage());

    // O(1) proof: the read footprint is a small constant (policy instance +
    // registry instance), NOT one entry per active guarantee. reset only the CPU
    // budget (recording-auth test artifact); the call below is a pure read.
    c.e.cost_estimate().budget().reset_unlimited();
    let _ = c.policy.coverage_required();
    let res = c.e.cost_estimate().resources();
    let reads = res.disk_read_entries + res.memory_read_entries;
    assert!(reads <= 8, "coverage_required read {} ledger entries — not O(1)", reads);
}

// ─────────────────────────────── pay_fee ───────────────────────────────

/// pay_fee leaves active/months_used/exit_used unchanged, so the registry
/// put-delta is provably 0: the aggregate is identical before and after, while
/// paid_until extends by exactly one period (renewal stacking preserved).
#[test]
fn pay_fee_does_not_change_aggregate() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &1_000);
    fund(&c, 1_000);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    let coverage_before = c.policy.coverage_required();

    c.policy.pay_fee(&agency, &gid);
    assert_eq!(c.policy.coverage_required(), coverage_before); // delta = 0
    let first_paid_until = c.policy.guarantee(&gid).paid_until;
    assert_eq!(first_paid_until, PERIOD); // sign at t=0 -> 0 + period

    // Renewal while still current stacks one more period (not reset).
    c.policy.pay_fee(&agency, &gid);
    assert_eq!(c.policy.coverage_required(), coverage_before);
    assert_eq!(c.policy.guarantee(&gid).paid_until, first_paid_until + PERIOD);
}

/// The only solvency gate is at sign_guarantee — pay_fee NEVER re-asserts
/// solvency. With coverage exactly == stable_assets, pay_fee still succeeds.
#[test]
fn pay_fee_no_solvency_reassert() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &1_000);
    // Fund EXACTLY the 900 obligation: coverage == stable_assets at the boundary.
    fund(&c, 900);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), c.vault.stable_assets()); // 900 == 900
    // pay_fee adds fee revenue to NAV but does NOT re-check solvency.
    c.policy.pay_fee(&agency, &gid);
    assert!(c.policy.is_current(&gid));
}

/// pay_fee rejects an inactive (settled) guarantee.
#[test]
fn pay_fee_rejects_inactive_guarantee() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &1_000);
    fund(&c, 1_000);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.policy.settle_guarantee(&gid);
    assert!(c.policy.try_pay_fee(&agency, &gid).is_err()); // "guarantee inactive"
}

// ─────────────────── #40: capacity is solvency, not a count ───────────────────

/// Capacity gate lives at sign_guarantee: a sign that would push
/// coverage_required above stable_assets reverts, and the WHOLE call rolls back
/// (no active guarantee left in the registry). Boundary: funding exactly the
/// obligation succeeds.
#[test]
fn capacity_gate_at_sign_reverts_when_underfunded() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 100); // thin reserve, 900 required

    assert!(c.policy.try_sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD).is_err());
    // Full rollback: no active guarantee, aggregate untouched.
    assert_eq!(c.registry.active_ids().len(), 0);
    assert_eq!(c.registry.raw_coverage(), 0);

    // Boundary twin: fund EXACTLY 900 -> succeeds, coverage == stable_assets.
    fund(&c, 800); // 100 + 800 = 900
    let _gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 900);
    assert_eq!(c.policy.coverage_required(), c.vault.stable_assets());
}

/// No flat count ceiling (MAX_ACTIVE_GUARANTEES is gone): with ample capital and
/// a tiny per-guarantee obligation, issuing well past the old 90 cap all succeed
/// — capacity is solvency, never a count.
#[test]
fn no_count_ceiling_issue_past_90() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 10_000_000);
    // monthly 1, default 3 + exit 6 -> 9 reserved each. 95 * 9 = 855 << capital.
    for _ in 0..95u32 {
        let _gid = c.policy.sign_guarantee(&landlord, &1, &3, &6, &1_000, &PERIOD);
    }
    assert_eq!(c.registry.active_ids().len(), 95);
    assert_eq!(c.policy.coverage_required(), 95 * 9);
}

// ─────────────────── lapse-flip: fee stream as default oracle ───────────────────

/// cover_default is gated by the grace window, not by "premiums up to date".
/// While the fee is current (now < paid_until + grace) cover_default reverts
/// "not in default"; once the fee lapses past grace it succeeds and pays the
/// landlord, decrementing coverage by exactly one monthly.
#[test]
fn lapse_flip_cover_default_gated_by_grace() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &1_000);
    fund(&c, 900);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.policy.pay_fee(&agency, &gid); // paid_until = PERIOD, fee current

    // Within grace: NOT in default -> cover_default reverts.
    assert!(c.policy.try_cover_default(&gid).is_err()); // "not in default"

    // Advance past paid_until + grace -> in default -> cover_default succeeds.
    c.e.ledger().set_timestamp(PERIOD + DEFAULT_GRACE_SECS + 1);
    c.policy.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(c.policy.coverage_required(), 800); // 900 - 100
}

/// cover_default caps at months_covered (3 draws) and KEEPS the exit leg
/// reserved: the 4th call reverts "coverage exhausted", the guarantee stays
/// active, and coverage_required holds the full exit reservation (600).
#[test]
fn cover_default_caps_and_keeps_exit_reserved() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    // No pay_fee: paid_until = 0 (sign at t=0). Advance past grace -> in default.
    c.e.ledger().set_timestamp(DEFAULT_GRACE_SECS + 1);

    c.policy.cover_default(&gid);
    assert_eq!(c.policy.coverage_required(), 800);
    c.policy.cover_default(&gid);
    assert_eq!(c.policy.coverage_required(), 700);
    c.policy.cover_default(&gid);
    assert_eq!(c.policy.coverage_required(), 600); // default leg exhausted, exit intact

    // 4th draw: months_used == months_covered -> "coverage exhausted".
    assert!(c.policy.try_cover_default(&gid).is_err());
    assert!(c.policy.guarantee(&gid).active); // NOT auto-deactivated
    assert_eq!(c.policy.coverage_required(), 600); // exit stays reserved
    assert_eq!(c.token.balance(&landlord), 300);
}

// ─────────────────── cover_exit: the property-recovery leg ───────────────────

/// cover_exit draws partial amounts that accumulate to the `monthly * exit_months`
/// cap; coverage decrements by exactly each draw; over-cap and zero draws revert.
#[test]
fn cover_exit_partial_draws_accumulate_to_cap() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 900); // 300 default + 600 exit

    c.policy.cover_exit(&gid, &200);
    assert_eq!(c.policy.guarantee(&gid).exit_used, 200);
    assert_eq!(c.policy.coverage_required(), 700); // -200
    c.policy.cover_exit(&gid, &400);
    assert_eq!(c.policy.guarantee(&gid).exit_used, 600); // == cap
    assert_eq!(c.policy.coverage_required(), 300); // -400, exit leg drained
    assert_eq!(c.token.balance(&landlord), 600);

    // Over the cap and zero-amount draws both revert.
    assert!(c.policy.try_cover_exit(&gid, &1).is_err()); // "exit cap exceeded"
    assert!(c.policy.try_cover_exit(&gid, &0).is_err()); // "zero exit amount"
}

// ─────────────────── settle releases BOTH legs ───────────────────

/// After one default draw + one exit draw, settle deactivates the guarantee and
/// the registry put-delta releases BOTH remaining legs — coverage drops to 0 and
/// subsequent cover_default / cover_exit revert (inactive).
#[test]
fn settle_releases_both_remaining_legs() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.e.ledger().set_timestamp(DEFAULT_GRACE_SECS + 1);
    c.policy.cover_default(&gid); // 900 -> 800
    c.policy.cover_exit(&gid, &100); // 800 -> 700
    assert_eq!(c.policy.coverage_required(), 700);

    c.policy.settle_guarantee(&gid);
    assert!(!c.policy.guarantee(&gid).active);
    assert_eq!(c.policy.coverage_required(), 0); // both legs released

    assert!(c.policy.try_cover_default(&gid).is_err());
    assert!(c.policy.try_cover_exit(&gid, &50).is_err());
}

// ─────────────────── grace_secs setter + window ───────────────────

/// grace_secs defaults to DEFAULT_GRACE_SECS at construction; the admin setter
/// changes the default-deadline window — cover_default fires only once now passes
/// paid_until + grace_secs.
#[test]
fn grace_secs_setter_admin_and_window() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);

    assert_eq!(c.policy.grace_secs(), DEFAULT_GRACE_SECS); // seeded at construction
    c.policy.set_grace_secs(&100);
    assert_eq!(c.policy.grace_secs(), 100);

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    // No pay_fee: paid_until = 0. Window now closes at now > 0 + 100.
    c.e.ledger().set_timestamp(50); // within grace
    assert!(c.policy.try_cover_default(&gid).is_err()); // "not in default"
    c.e.ledger().set_timestamp(150); // past grace
    c.policy.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
}

// ─────────────────── coverage_required ratio rounding ───────────────────

/// coverage_required rounds the capital floor UP (Ceil) so the gate is never
/// understated: raw 900 at ratio 7_511 yields the ceil (676), strictly above the
/// floor (675).
#[test]
fn coverage_required_rounds_up() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 10_000);

    let _gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD); // raw 900
    c.policy.set_coverage_ratio_bps(&7_511);

    let raw = 900i128;
    let ratio = 7_511i128;
    let floor = raw * ratio / 10_000;
    let ceil = (raw * ratio + 10_000 - 1) / 10_000;
    assert_eq!(floor, 675);
    assert_eq!(ceil, 676);
    assert_eq!(c.policy.coverage_required(), ceil);
    assert!(c.policy.coverage_required() > floor);
}

/// At the default ratio (10_000 bps), Ceil of raw*10_000/10_000 == raw exactly.
#[test]
fn coverage_required_default_ratio_unchanged() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 10_000);
    let _gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 900); // == raw, no rounding shift
}

/// set_coverage_ratio_bps accepts over-collateralization (200%) but rejects an
/// overflow-class value above the 10×BPS_DENOM ceiling.
#[test]
fn set_coverage_ratio_bps_accepts_over_collateralization() {
    let c = setup();
    c.policy.set_coverage_ratio_bps(&20_000);
}

#[test]
#[should_panic]
fn set_coverage_ratio_bps_rejects_overflow_class() {
    let c = setup();
    c.policy.set_coverage_ratio_bps(&200_000);
}

// ─────────────────── fee math + fee_bps bound ───────────────────

/// monthly_fee (fee_of, Floor) is behavior-preserving for normal terms.
#[test]
fn fee_of_unchanged_for_normal_terms() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 1_000);
    // monthly 100, fee_bps 1_000 -> 100 * 1_000 / 10_000 = 10.
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.monthly_fee(&gid), 10);
}

/// sign_guarantee bounds fee_bps at 100% (10_000 bps): above the cap is the typed
/// FeeTooHigh error; the 10_000 boundary still succeeds.
#[test]
fn sign_guarantee_rejects_fee_above_100pct_and_allows_boundary() {
    use crate::PolicyError;
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 10_000);

    let res = c.policy.try_sign_guarantee(&landlord, &100, &3, &6, &10_001, &PERIOD);
    assert_eq!(res, Err(Ok(PolicyError::FeeTooHigh)));

    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &10_000, &PERIOD);
    assert_eq!(c.policy.guarantee(&gid).fee_bps, 10_000);
}

// ─────────────────── events (renamed: fiança terms) ───────────────────

/// sign_guarantee emits exactly one GuaranteeSigned (carrying exit_months) on the
/// policy contract id; the on-chain guarantee cross-checks the exit_months field.
#[test]
fn sign_emits_one_guarantee_signed_with_exit_months() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 1_000);
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert_eq!(policy_events.events().len(), 1);
    assert_eq!(c.policy.guarantee(&gid).exit_months, 6); // event mirrors this
}

/// Insolvent sign rolls back and publishes no event (emit-after-assert).
#[test]
fn insolvent_sign_emits_no_event() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 100); // 900 required > 100
    assert!(c.policy.try_sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD).is_err());
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(policy_events.events().is_empty());
}

/// pay_fee emits FeePaid on the policy contract id.
#[test]
fn pay_fee_emits_fee_paid_event() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &1_000);
    fund(&c, 1_000);
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.policy.pay_fee(&agency, &gid);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}

/// cover_default emits DefaultCovered on the happy (in-default) path.
#[test]
fn cover_default_emits_default_covered_event() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.e.ledger().set_timestamp(DEFAULT_GRACE_SECS + 1);
    c.policy.cover_default(&gid);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}

/// cover_default while NOT in default emits nothing (emit-after-disburse-success).
#[test]
fn cover_default_not_in_default_emits_no_event() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    // Fresh sign: paid_until = now, not past grace -> "not in default".
    assert!(c.policy.try_cover_default(&gid).is_err());
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(policy_events.events().is_empty());
}

/// cover_exit emits ExitCovered on the happy path.
#[test]
fn cover_exit_emits_exit_covered_event() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.policy.cover_exit(&gid, &100);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}

/// settle_guarantee emits GuaranteeSettled on the policy contract id.
#[test]
fn settle_guarantee_emits_settled_event() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 900);
    let gid = c.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    c.policy.settle_guarantee(&gid);
    let policy_events = c.e.events().all().filter_by_contract(&c.policy_id);
    assert!(!policy_events.events().is_empty());
}
