#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{token, Address, Env, String};
use soroban_sdk::Vec as SVec;
use vault::{Vault, VaultClient};
use registry::{Registry, RegistryClient};
use mock_strategy::{MockStrategy, MockStrategyClient};
use crate::{Policy, PolicyClient};

const GRACE: u64 = 432_000; // DEFAULT_GRACE_SECS
const PERIOD: u64 = 2_592_000;

struct Sys {
    e: Env, admin: Address, underlying: Address,
    token_admin: token::StellarAssetClient<'static>,
    vault: VaultClient<'static>, vault_id: Address,
    registry_id: Address, policy: PolicyClient<'static>, policy_id: Address,
}

fn wire() -> Sys {
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
    policy.set_vault(&vault_id); policy.set_registry(&registry_id); policy.set_coverage_ratio_bps(&10_000);
    vault.set_policy(&policy_id);
    Sys { token_admin: token::StellarAssetClient::new(&e, &underlying),
          e, admin, underlying, vault, vault_id, registry_id, policy, policy_id }
}

#[test]
fn full_demo_flow_holds_solvency_invariant() {
    let s = wire();
    let alice = Address::generate(&s.e);
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&alice, &20_000);
    s.token_admin.mint(&agency, &10_000);

    s.vault.deposit(&20_000, &alice, &alice, &alice);
    let sid = s.e.register(MockStrategy, (s.underlying.clone(),));
    // Wire controller to the reserve vault so rebalance/divest authorize. (audit H1/H4 gate)
    MockStrategyClient::new(&s.e, &sid).set_controller(&s.vault_id);
    s.vault.add_strategy(&sid, &10_000, &false);
    s.vault.rebalance();
    assert_eq!(s.policy.coverage_required(), 0); // no guarantees signed yet — coverage is vacuously zero

    // Two-leg coverage: each guarantee reserves monthly * (months_covered + exit_months).
    let g1 = s.policy.sign_guarantee(&landlord, &500, &6, &6, &1_000, &PERIOD); // 500 * 12 = 6_000
    let g2 = s.policy.sign_guarantee(&landlord, &300, &6, &6, &1_000, &PERIOD); // 300 * 12 = 3_600
    s.policy.pay_fee(&agency, &g1);
    s.policy.pay_fee(&agency, &g2);
    assert_eq!(s.policy.coverage_required(), 9_600);
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());

    // cover_default now requires the fee to have lapsed past the grace window.
    s.e.ledger().set_timestamp(PERIOD + GRACE + 1);
    s.policy.cover_default(&g1);
    assert_eq!(s.policy.coverage_required(), 9_100); // 9_600 - 500
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());

    let rid = s.vault.request_redeem(&alice, &5_000);
    let alice_before = token::TokenClient::new(&s.e, &s.underlying).balance(&alice);
    s.vault.process_redemptions(&10);
    // Happy path must not silently no-op: the redemption was fulfilled and the claim paid out.
    assert!(s.vault.request(&rid).fulfilled, "redemption should be fulfilled after processing");
    s.vault.claim(&rid);
    assert!(
        token::TokenClient::new(&s.e, &s.underlying).balance(&alice) > alice_before,
        "claim should pay redeemed underlying back to alice"
    );
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());
    let _ = (s.vault_id, s.registry_id, s.policy_id, s.admin);
}

#[test]
fn coverage_required_scales_below_one_x() {
    let s = wire();
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&agency, &10_000);
    let alice = Address::generate(&s.e);
    s.token_admin.mint(&alice, &20_000);
    s.vault.deposit(&20_000, &alice, &alice, &alice);

    // Raw exposure = monthly * (months_covered + exit_months) = 1_000 * 12 = 12_000.
    let gid = s.policy.sign_guarantee(&landlord, &1_000, &6, &6, &1_000, &PERIOD);
    s.policy.pay_fee(&agency, &gid);

    s.policy.set_coverage_ratio_bps(&5_000);
    assert_eq!(s.policy.coverage_required(), 12_000 * 5_000 / 10_000); // 6_000
}

#[test]
fn coverage_required_scales_above_one_x() {
    let s = wire();
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&agency, &10_000);
    let alice = Address::generate(&s.e);
    s.token_admin.mint(&alice, &20_000);
    s.vault.deposit(&20_000, &alice, &alice, &alice);

    // Raw exposure = monthly * (months_covered + exit_months) = 1_000 * 12 = 12_000.
    let gid = s.policy.sign_guarantee(&landlord, &1_000, &6, &6, &1_000, &PERIOD);
    s.policy.pay_fee(&agency, &gid);

    s.policy.set_coverage_ratio_bps(&15_000);
    assert_eq!(s.policy.coverage_required(), 12_000 * 15_000 / 10_000); // 18_000
}

/// PROPERTY (system level): across a randomized interleaving of issue / pay_fee /
/// cover_default (only after the fee has lapsed past grace) / cover_exit / settle
/// driven through the POLICY entrypoints at ratio 1.0, the O(1) aggregate equals
/// the hand-summed Σ contribution after EVERY step — including reverted no-ops.
/// raw_coverage() == Σ AND coverage_required() == Σ (Ceil at 1.0 is identity).
#[test]
fn aggregate_matches_sum_of_contributions() {
    let s = wire(); // ratio 1.0 (10_000)
    let landlord = Address::generate(&s.e);
    let agency = Address::generate(&s.e);
    let alice = Address::generate(&s.e);
    s.token_admin.mint(&alice, &100_000_000);
    s.token_admin.mint(&agency, &100_000_000);
    // Ample capital so the sign-time capacity gate never blocks (we test the
    // aggregate, not capacity here).
    s.vault.deposit(&100_000_000, &alice, &alice, &alice);

    let reg = RegistryClient::new(&s.e, &s.registry_id);
    let mut ids: SVec<u32> = SVec::new(&s.e);
    let mut seed: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut clock: u64 = 1;
    s.e.ledger().set_timestamp(clock);

    let monthlies = [100i128, 250, 400];
    let mcs = [2u32, 3];
    let exits = [4u32, 6];

    for _ in 0..32 {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let r = (seed >> 33) as u32;
        match r % 5 {
            0 => {
                if ids.len() < 5 {
                    let m = monthlies[(r as usize >> 2) % 3];
                    let mc = mcs[(r as usize >> 4) % 2];
                    let ex = exits[(r as usize >> 6) % 2];
                    s.e.ledger().set_timestamp(clock);
                    let gid = s.policy.sign_guarantee(&landlord, &m, &mc, &ex, &1_000, &PERIOD);
                    ids.push_back(gid);
                }
            }
            1 => {
                if ids.len() > 0 {
                    let gid = ids.get((r >> 2) % ids.len()).unwrap();
                    s.e.ledger().set_timestamp(clock);
                    let _ = s.policy.try_pay_fee(&agency, &gid);
                }
            }
            2 => {
                if ids.len() > 0 {
                    let gid = ids.get((r >> 2) % ids.len()).unwrap();
                    // Advance the clock past every active guarantee's lapse deadline
                    // so cover_default actually fires (the fee-stream default oracle).
                    let grace = s.policy.grace_secs();
                    let mut max_pu = 0u64;
                    for id in reg.active_ids().iter() {
                        let pu = reg.get(&id).paid_until;
                        if pu > max_pu { max_pu = pu; }
                    }
                    let deadline = max_pu.saturating_add(grace).saturating_add(1);
                    if deadline > clock { clock = deadline; }
                    s.e.ledger().set_timestamp(clock);
                    let _ = s.policy.try_cover_default(&gid);
                }
            }
            3 => {
                if ids.len() > 0 {
                    let gid = ids.get((r >> 2) % ids.len()).unwrap();
                    let amt = 30i128 + (r as i128 % 120);
                    s.e.ledger().set_timestamp(clock);
                    let _ = s.policy.try_cover_exit(&gid, &amt);
                }
            }
            _ => {
                if ids.len() > 0 {
                    let gid = ids.get((r >> 2) % ids.len()).unwrap();
                    s.e.ledger().set_timestamp(clock);
                    let _ = s.policy.try_settle_guarantee(&gid);
                }
            }
        }

        // Invariant after EVERY step: stored O(1) aggregate == recomputed Σ.
        let mut expected = 0i128;
        for id in reg.active_ids().iter() {
            let g = reg.get(&id);
            let default_term = g.monthly_amount * (g.months_covered as i128 - g.months_used as i128);
            let exit_term = g.monthly_amount * g.exit_months as i128 - g.exit_used;
            expected += default_term + exit_term;
        }
        assert_eq!(reg.raw_coverage(), expected, "raw_coverage drift");
        assert_eq!(s.policy.coverage_required(), expected, "coverage_required drift");
    }
    let _ = (s.vault_id, s.admin, s.policy_id, &s.underlying);
}

/// The disburse witness blocks any payout that would push the vault below the
/// post-payout coverage floor. Happy path (c = 1.0) drains exactly to the floor
/// and stays solvent after every payout; the under-collateralized path (c = 0.5,
/// funded to the ceil'd floor) reverts "disburse breaches solvency" with a full
/// rollback.
#[test]
fn solvency_witness_blocks_overdraw() {
    // ── Happy path (c = 1.0): a full drain stays on/above the floor every step. ──
    let s = wire();
    let landlord = Address::generate(&s.e);
    let alice = Address::generate(&s.e);
    s.token_admin.mint(&alice, &900);
    s.vault.deposit(&900, &alice, &alice, &alice);
    let gid = s.policy.sign_guarantee(&landlord, &100, &3, &6, &1_000, &PERIOD); // 900
    s.e.ledger().set_timestamp(GRACE + 1); // past grace (paid_until = 0)
    for _ in 0..3 {
        s.policy.cover_default(&gid);
        assert!(s.vault.stable_assets() >= s.policy.coverage_required());
    }
    for _ in 0..3 {
        s.policy.cover_exit(&gid, &100);
        assert!(s.vault.stable_assets() >= s.policy.coverage_required());
    }

    // ── Breach path (c = 0.5): funded exactly to the floor, the first default
    //    payout would dip stable_pre − amount below coverage_after -> revert. ──
    let s2 = wire();
    let landlord2 = Address::generate(&s2.e);
    let alice2 = Address::generate(&s2.e);
    s2.policy.set_coverage_ratio_bps(&5_000);
    s2.token_admin.mint(&alice2, &450);
    s2.vault.deposit(&450, &alice2, &alice2, &alice2);
    let gid2 = s2.policy.sign_guarantee(&landlord2, &100, &3, &6, &1_000, &PERIOD);
    assert_eq!(s2.policy.coverage_required(), 450); // ceil(900 * 0.5)
    assert_eq!(s2.vault.stable_assets(), 450);
    s2.e.ledger().set_timestamp(GRACE + 1);
    // coverage_after = ceil(800 * 0.5) = 400; 450 - 100 = 350 < 400 -> breach.
    assert!(s2.policy.try_cover_default(&gid2).is_err());
    // Full rollback: nothing drained, aggregate + counters intact.
    assert_eq!(s2.vault.stable_assets(), 450);
    assert_eq!(s2.policy.coverage_required(), 450);
    assert_eq!(s2.policy.guarantee(&gid2).months_used, 0);
    let _ = (&s.token_admin, &s2.token_admin);
}

/// Port of `policy_swap_preserves_data_and_funds`: coverage_required is a pure
/// function of registry state, so a freshly-wired policy-v2 on the SAME registry
/// returns the identical coverage with NO migration, and can immediately operate
/// (a default pays out through the same vault once the fee has lapsed past grace).
#[test]
fn policy_swap_preserves_coverage() {
    let s = wire();
    let alice = Address::generate(&s.e);
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&alice, &10_000);
    s.token_admin.mint(&agency, &10_000);
    s.vault.deposit(&10_000, &alice, &alice, &alice);
    let gid = s.policy.sign_guarantee(&landlord, &100, &6, &6, &1_000, &PERIOD); // 1_200
    s.policy.pay_fee(&agency, &gid);
    let assets_before = s.vault.total_assets();
    let coverage_before = s.policy.coverage_required();
    assert_eq!(coverage_before, 1_200);

    // Deploy policy-v2, re-point writer + vault.policy. Same registry + vault.
    let policy2_id = s.e.register(Policy, (s.admin.clone(),));
    let policy2 = PolicyClient::new(&s.e, &policy2_id);
    policy2.set_vault(&s.vault_id);
    policy2.set_registry(&s.registry_id);
    policy2.set_coverage_ratio_bps(&10_000);
    RegistryClient::new(&s.e, &s.registry_id).set_writer(&policy2_id);
    s.vault.set_policy(&policy2_id);

    // Data and funds survived the swap; v2 sees the existing guarantee + aggregate.
    assert_eq!(s.vault.total_assets(), assets_before);
    assert_eq!(policy2.coverage_required(), coverage_before);
    assert_eq!(policy2.guarantee(&gid).monthly_amount, 100);

    // v2 can now operate: a default pays out through the same vault, once lapsed.
    s.e.ledger().set_timestamp(PERIOD + GRACE + 1);
    policy2.cover_default(&gid);
    assert_eq!(policy2.coverage_required(), coverage_before - 100);
    let _ = &s.token_admin;
}
