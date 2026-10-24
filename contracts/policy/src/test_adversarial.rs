#![cfg(test)]
//! Adversarial tests for the `policy` underwriting brain.
//!
//! TESTS ONLY — no contract logic is modified. The factory below mirrors the
//! private `setup()/Ctx/fund` helpers in `test.rs` (they are private to that
//! sibling module, so they are replicated here rather than imported).
use crate::{Policy, PolicyClient};
use registry::{Registry, RegistryClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{token, Address, Env, String};
use vault::{Vault, VaultClient};

const GRACE: u64 = 432_000; // DEFAULT_GRACE_SECS
const PERIOD: u64 = 2_592_000;

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    vault: VaultClient<'static>,
    registry: RegistryClient<'static>,
    policy: PolicyClient<'static>,
    #[allow(dead_code)]
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
        e,
        vault,
        registry,
        policy,
        policy_id,
    }
}

/// Mint + deposit `amount` of underlying into the vault as freely-available
/// reserve so the capacity gate / disburse witness have capital to assert against.
fn fund(c: &Ctx, amount: i128) {
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &amount);
    c.vault.deposit(&amount, &alice, &alice, &alice);
}

// ─────────────────── AC-02: set_registry / set_vault admin gate ───────────────────

/// Re-pointing where the policy reads coverage / moves money is admin-gated. With
/// no admin auth a would-be attacker cannot swap the registry for one whose
/// raw_coverage()==0 (which would collapse coverage_required and let the sign /
/// disburse witnesses pass trivially), nor swap the vault. After auth is dropped
/// both setters Err and the wiring stays bound to the real registry — coverage
/// cannot be spoofed.
#[test]
fn adv_policy_set_registry_vault_admin_gate() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 1_000);
    let _gid = c
        .policy
        .sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 900);

    // An attacker-controlled registry that reports zero coverage, and a junk vault.
    let evil_admin = Address::generate(&c.e);
    let evil_registry = c.e.register(Registry, (evil_admin.clone(),));
    let evil_vault = Address::generate(&c.e);

    // Drop all authorizations: no admin signature is available.
    c.e.set_auths(&[]);
    assert!(c.policy.try_set_registry(&evil_registry).is_err());
    assert!(c.policy.try_set_vault(&evil_vault).is_err());

    // Restore auth: wiring is untouched, coverage still reads the REAL registry.
    c.e.mock_all_auths_allowing_non_root_auth();
    assert_eq!(c.policy.coverage_required(), 900);
}

// ─────────────────── AC-04: state-machine entrypoint admin gate ───────────────────

/// All four state-machine entrypoints (sign / cover_default / cover_exit / settle)
/// are admin-gated. With no admin auth every one Errs at require_auth(admin)
/// BEFORE any registry mutation or vault.disburse — the guarantee book and vault
/// balance are unchanged.
#[test]
fn adv_policy_entrypoints_admin_gate() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 1_000);
    let gid = c
        .policy
        .sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    let cov_before = c.policy.coverage_required();
    let stable_before = c.vault.stable_assets();

    c.e.set_auths(&[]);
    assert!(c
        .policy
        .try_sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD)
        .is_err());
    assert!(c.policy.try_cover_exit(&gid, &50).is_err());
    assert!(c.policy.try_settle_guarantee(&gid).is_err());
    // Advance past grace so ONLY the admin gate (not "not in default") can block.
    c.e.ledger().set_timestamp(GRACE + 1);
    assert!(c.policy.try_cover_default(&gid).is_err());

    // Restore auth and confirm nothing leaked.
    c.e.mock_all_auths_allowing_non_root_auth();
    assert_eq!(c.policy.coverage_required(), cov_before);
    assert_eq!(c.vault.stable_assets(), stable_before);
    assert!(c.policy.guarantee(&gid).active);
    assert_eq!(c.token.balance(&landlord), 0);
}

// ─────────────────── SB-05: c<1.0 cover_default stuck mid-term ───────────────────

/// At ratio<1.0 cover_default disburses the FULL monthly but coverage_required
/// drops only ratio*monthly, so stable drains faster than the floor recedes. A
/// guarantee funded only to its ceil'd floor cannot pay its full term — it reverts
/// mid-term via the witness with full rollback. Only 1 of 4 promised default
/// months is payable (the c<1 actuarial tradeoff).
#[test]
fn adv_cover_default_ratio_below_one_stuck_midterm() {
    let c = setup();
    c.policy.set_coverage_ratio_bps(&5_000);
    let landlord = Address::generate(&c.e);
    fund(&c, 250);
    // monthly 100, default 4, exit 0 -> raw 400, coverage_required = ceil(400*0.5)=200.
    let gid = c
        .policy
        .sign_guarantee(&landlord, &100, &4, &0, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 200);

    c.e.ledger().set_timestamp(GRACE + 1);
    // #1: stable 250 -> 150, coverage_after = ceil(300*0.5)=150. 150 >= 150 OK.
    c.policy.cover_default(&gid);
    assert_eq!(c.vault.stable_assets(), 150);
    assert_eq!(c.policy.coverage_required(), 150);

    // #2: would need 150-100=50 >= ceil(200*0.5)=100 -> breach.
    assert!(c.policy.try_cover_default(&gid).is_err()); // "disburse breaches solvency"

    // Full rollback: months_used==1, stable + coverage unchanged from after #1.
    assert_eq!(c.policy.guarantee(&gid).months_used, 1);
    assert_eq!(c.vault.stable_assets(), 150);
    assert_eq!(c.policy.coverage_required(), 150);
}

// ─────────────────── ECON-03: default count to breach at ratio ───────────────────

/// In actuarial mode (c<1.0) each cover_default pays full R but releases only c*R
/// of the floor, so the solvency margin drops by R*(1-c) per draw. With
/// buffer = K*R*(1-c), exactly K draws succeed and the (K+1)th reverts. Twin with
/// a larger buffer exhausts the (smaller) default term first.
#[test]
fn adv_default_count_breaks_solvency_at_ratio() {
    // K=2: R=100, c=0.5 -> R*(1-c)=50; fund 550 = floor 450 + buffer 100 = 2*50.
    let c = setup();
    c.policy.set_coverage_ratio_bps(&5_000);
    let landlord = Address::generate(&c.e);
    fund(&c, 550);
    let gid = c
        .policy
        .sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 450); // ceil(900*0.5)
    c.e.ledger().set_timestamp(GRACE + 1);
    c.policy.cover_default(&gid); // margin 100 -> 50
    c.policy.cover_default(&gid); // margin 50 -> 0
    assert!(c.policy.try_cover_default(&gid).is_err()); // (K+1)th: margin -> -50 -> breach
    assert_eq!(c.policy.guarantee(&gid).months_used, 2); // rollback of failed draw

    // Twin: buffer 150 (=3*50). Default term is only 3, so all 3 draws pass and the
    // default leg is exhausted before the witness can bite.
    let c2 = setup();
    c2.policy.set_coverage_ratio_bps(&5_000);
    let l2 = Address::generate(&c2.e);
    fund(&c2, 600);
    let g2 = c2.policy.sign_guarantee(&l2, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(c2.policy.coverage_required(), 450);
    c2.e.ledger().set_timestamp(GRACE + 1);
    c2.policy.cover_default(&g2);
    c2.policy.cover_default(&g2);
    c2.policy.cover_default(&g2); // 3rd succeeds (margin lands exactly at 0)
    assert_eq!(c2.policy.guarantee(&g2).months_used, 3);
    assert!(c2.vault.stable_assets() >= c2.policy.coverage_required());
}

// ─────────────────── SB-04: default-leg exhaust keeps exit reservation ───────────────────

/// Exhausting the DEFAULT leg (months_used==months_covered) must NOT release the
/// EXIT-leg reservation; coverage_required stays at the still-promised exit cap.
/// Only settle_guarantee releases both legs.
#[test]
fn adv_default_leg_exhaust_keeps_exit_reservation() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 1_000);
    // monthly 100, default 1, exit 6 -> raw 700.
    let gid = c
        .policy
        .sign_guarantee(&landlord, &100, &1, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 700);

    c.e.ledger().set_timestamp(GRACE + 1);
    c.policy.cover_default(&gid); // default leg exhausted (months_used==1==months_covered)
    assert_eq!(c.policy.coverage_required(), 600); // exit leg INTACT, not released

    assert!(c.policy.try_cover_default(&gid).is_err()); // "coverage exhausted"
    assert_eq!(c.policy.coverage_required(), 600);

    c.policy.cover_exit(&gid, &100); // exit leg still payable
    assert_eq!(c.policy.coverage_required(), 500);

    c.policy.settle_guarantee(&gid); // only settle drops coverage to 0
    assert_eq!(c.policy.coverage_required(), 0);
}

// ─────────────────── ECON-02: sign capacity packing boundary ───────────────────

/// The sign-time solvency gate permits exactly floor(reserve/9000) standard
/// (9× monthly) guarantees and reverts the next, with full rollback.
#[test]
fn adv_sign_guarantee_capacity_packing_boundary() {
    let c = setup();
    let landlord = Address::generate(&c.e);
    fund(&c, 50_000);
    // monthly 1_000, default 3 + exit 6 -> 9_000 reserved each. floor(50_000/9_000)=5.
    for _ in 0..5 {
        let _ = c
            .policy
            .sign_guarantee(&landlord, &1_000, &3, &6, &1_200, &PERIOD);
    }
    assert_eq!(c.policy.coverage_required(), 45_000);
    assert_eq!(c.registry.active_ids().len(), 5);

    // 6th would need 54_000 > 50_000 -> revert with full rollback.
    assert!(c
        .policy
        .try_sign_guarantee(&landlord, &1_000, &3, &6, &1_200, &PERIOD)
        .is_err());
    assert_eq!(c.registry.active_ids().len(), 5);
    assert_eq!(c.registry.raw_coverage(), 45_000);
}

// ─────────────────── ECON-05: over-collateralization margin grows ───────────────────

/// At c>1.0 the sign gate demands >1x capital (reverts below ceil(raw*c)) and each
/// cover_default GROWS the solvency margin (releases ceil(c*R) of floor, pays only
/// R) — it never reverts for being over-collateralized.
#[test]
fn adv_over_collateralization_margin_grows() {
    let c = setup();
    c.policy.set_coverage_ratio_bps(&15_000); // c = 1.5
    let landlord = Address::generate(&c.e);

    // raw = 1_000 * (3 + 6) = 9_000 -> coverage_required = ceil(9_000*1.5)=13_500.
    // 13_000 is short of the >1x requirement.
    fund(&c, 13_000);
    assert!(c
        .policy
        .try_sign_guarantee(&landlord, &1_000, &3, &6, &1_000, &PERIOD)
        .is_err());

    fund(&c, 500); // -> 13_500
    let gid = c
        .policy
        .sign_guarantee(&landlord, &1_000, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.coverage_required(), 13_500);
    assert_eq!(c.vault.stable_assets(), 13_500);
    let margin_before = c.vault.stable_assets() - c.policy.coverage_required();
    assert_eq!(margin_before, 0);

    c.e.ledger().set_timestamp(GRACE + 1);
    // pays 1_000, releases the floor on one default month: raw -> 8_000,
    // coverage_after = ceil(8_000*1.5)=12_000.
    c.policy.cover_default(&gid);
    assert_eq!(c.policy.coverage_required(), 12_000);
    assert_eq!(c.vault.stable_assets(), 12_500);
    let margin_after = c.vault.stable_assets() - c.policy.coverage_required();
    assert_eq!(margin_after, 500); // grew by R*(c-1) = 1_000 * 0.5
    assert!(margin_after > margin_before);
}

// ─────────────────── FG-3: pay_fee cannot block accrued cover_default ───────────────────

/// FINDING (economic): cover_default is gated by `paid_until + grace < now` and
/// pay_fee pushes paid_until to now+period. A tenant already in default can pay
/// only the small monthly FEE to reset paid_until forward, flipping out of default
/// and BLOCKING the landlord's legitimate cover_default — a fee payment (the
/// default oracle) is conflated with a rent cure. This test documents that a
/// ~1_000 payout is defeated for the price of one ~100 fee.
#[test]
fn adv_pay_fee_cannot_block_accrued_cover_default() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &10_000);
    fund(&c, 100_000);

    let gid = c
        .policy
        .sign_guarantee(&landlord, &1_000, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.monthly_fee(&gid), 100);

    // Past one full period + grace -> the default is accrued and cover_default would pay.
    c.e.ledger().set_timestamp(PERIOD + GRACE + 1);

    // Tenant pays a single fee, pushing paid_until to now + PERIOD.
    c.policy.pay_fee(&agency, &gid);

    // Landlord's legitimate cover_default is now blocked: "not in default".
    assert!(c.policy.try_cover_default(&gid).is_err());
    assert_eq!(c.token.balance(&landlord), 0); // the ~1_000 payout was defeated for ~100
}

// ─────────────────── FG-2: pay_fee lapse base-collapse (back-fee leak) ───────────────────

/// FINDING (economic): pay_fee sets paid_until = (paid_until>now ? paid_until :
/// now) + period. After a long lapse the base collapses to `now`, so a tenant who
/// skipped 10 periods pays only ONE period's fee to become current — no back-charge
/// — while coverage was reserved the whole time.
#[test]
fn adv_pay_fee_lapse_back_fee_leak() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &10_000);
    fund(&c, 100_000);

    let gid = c
        .policy
        .sign_guarantee(&landlord, &1_000, &3, &6, &1_000, &PERIOD);
    assert_eq!(c.policy.monthly_fee(&gid), 100);

    // Skip 10 periods without paying, then pay once.
    c.e.ledger().set_timestamp(10 * PERIOD);
    c.policy.pay_fee(&agency, &gid);

    // Only ONE period added (base collapsed to now), and only 100 charged for 10
    // periods of reserved coverage.
    assert_eq!(c.policy.guarantee(&gid).paid_until, 11 * PERIOD);
    assert_eq!(c.token.balance(&agency), 9_900); // 10_000 - 100, NOT - 1_000
}

// ─────────────────── FG-4: zero-floored fee = free coverage ───────────────────

/// FINDING (economic): sign_guarantee only checks fee_bps>0, but fee_of floors
/// monthly*fee_bps/10_000. With small terms the fee floors to 0, yet the guarantee
/// is signed and coverage reserved; pay_fee then asserts fee>0 and permanently
/// reverts — the tenant can NEVER pay, so full coverage carries a zero fee stream
/// (free coverage that still pays out on default).
#[test]
fn adv_sign_guarantee_zero_floored_fee_free_coverage() {
    let c = setup();
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&agency, &10_000);
    fund(&c, 100_000);

    // monthly 100, fee_bps 50 -> fee_of = floor(100*50/10_000) = 0, but fee_bps>0 passes.
    let gid = c
        .policy
        .sign_guarantee(&landlord, &100, &3, &6, &50, &PERIOD);
    assert_eq!(c.policy.monthly_fee(&gid), 0);
    assert_eq!(c.policy.coverage_required(), 900); // full coverage reserved

    // The tenant can NEVER pay a fee: pay_fee asserts fee>0.
    assert!(c.policy.try_pay_fee(&agency, &gid).is_err()); // "zero fee"

    // Yet the guarantee still pays out on default, having collected zero fees.
    c.e.ledger().set_timestamp(GRACE + 1);
    c.policy.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
}
