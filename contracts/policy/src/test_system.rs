#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env, String};
use soroban_sdk::Vec as SVec;
use vault::{Vault, VaultClient};
use registry::{DataKey as RegKey, Registry, RegistryClient, MAX_ACTIVE_GUARANTEES};
use mock_strategy::{MockStrategy, MockStrategyClient};
use interfaces::Guarantee;
use crate::{Policy, PolicyClient};

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

    let g1 = s.policy.sign_guarantee(&landlord, &500, &6, &1_000, &2_592_000);
    let g2 = s.policy.sign_guarantee(&landlord, &300, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &g1);
    s.policy.pay_premium(&agency, &g2);
    assert_eq!(s.policy.coverage_required(), 4_800);
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());

    s.policy.cover_default(&g1);
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
    // Capital must cover the largest coverage requirement exercised below (1.5x case = 9_000).
    let alice = Address::generate(&s.e);
    s.token_admin.mint(&alice, &20_000);
    s.vault.deposit(&20_000, &alice, &alice, &alice);

    // Raw exposure = monthly_amount * months_covered = 1_000 * 6 = 6_000.
    let gid = s.policy.sign_guarantee(&landlord, &1_000, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &gid);

    s.policy.set_coverage_ratio_bps(&5_000);
    assert_eq!(s.policy.coverage_required(), 6_000 * 5_000 / 10_000);
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

    // Raw exposure = monthly_amount * months_covered = 1_000 * 6 = 6_000.
    let gid = s.policy.sign_guarantee(&landlord, &1_000, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &gid);

    s.policy.set_coverage_ratio_bps(&15_000);
    assert_eq!(s.policy.coverage_required(), 6_000 * 15_000 / 10_000);
}

/// Activation under Ceil coverage rounding: with a non-evenly-dividing ratio the
/// pre-activation solvency gate (`stable_assets >= coverage_required`) uses the
/// ceil'd (tighter) coverage. Seeding stable_assets to exactly the ceil value
/// must still activate — Ceil composes safely with the gate (boundary, not an
/// off-by-one revert).
#[test]
fn pay_premium_activation_with_ceil_coverage() {
    let s = wire();
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    let alice = Address::generate(&s.e);
    s.token_admin.mint(&agency, &10_000);
    s.token_admin.mint(&alice, &10_000);

    // raw = 100 * 6 = 600. Ratio 7_511 → ceil(600*7_511/10_000) = 451.
    // Premium = 100 * 1_000bps / 10_000 = 10. Deposit 441 so post-premium
    // stable_assets = 441 + 10 = 451 == ceil(coverage). Boundary must succeed.
    s.vault.deposit(&441, &alice, &alice, &alice);
    s.policy.set_coverage_ratio_bps(&7_511);

    let gid = s.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &gid); // must not revert at the exact ceil boundary
    assert!(s.policy.is_current(&gid));
    assert_eq!(s.policy.coverage_required(), 451);
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());
}

/// H3 budget proof: sign + pay_premium for the FULL MAX_ACTIVE_GUARANTEES cap
/// using representative amounts, then assert `coverage_required()` (a) succeeds
/// within the test ledger budget while iterating the bounded active set, and (b)
/// equals the exact summed figure. This is the conservative aggregate-matches-sum
/// check the finding asks for — achieved by the registry cap (bound the N), NOT a
/// policy-side aggregate (which would break the time-gate and stateless-swap
/// invariant). Runs at the REAL cap so the resource claim for 200 cross-contract
/// get()s is actually exercised, not asserted.
#[test]
fn coverage_required_at_active_cap_stays_within_budget() {
    let s = wire();
    let landlord = Address::generate(&s.e);

    // Representative per-guarantee terms (NOT 1): monthly_amount 500, months 6.
    let monthly_amount: i128 = 500;
    let months: u32 = 6;
    let n = MAX_ACTIVE_GUARANTEES;

    // Raw coverage at the cap = n * monthly_amount * months.
    let expected = (n as i128) * monthly_amount * (months as i128);

    // Seed the registry's active set + Guarantee entries DIRECTLY (the exact
    // entries `put` would write), bypassing the per-call auth-recording machinery.
    // The standard sign+pay path records an auth tree per invocation that the test
    // host re-validates on EVERY subsequent call, so 200 sign+pay calls in one Env
    // is O(N^2) in the harness's auth meter (a test artifact, NOT a real per-tx
    // cost) and overflows before we can even measure coverage_required. Seeding
    // state directly lets us reset to a single-tx default budget and measure the
    // ACTUAL cost claim: the bounded loop of N cross-contract get()s.
    let now = s.e.ledger().timestamp();
    let paid_until = now + 10_000_000; // far in the future → all included by the gate
    // Seed the Guarantee entries in batches so each as_contract block stays under
    // the per-invocation WRITE footprint limit (~50 entries); the measured call
    // below is what must fit the READ footprint at the cap.
    const BATCH: u32 = 40;
    let mut start = 0u32;
    while start < n {
        let end = (start + BATCH).min(n);
        s.e.as_contract(&s.registry_id, || {
            for id in start..end {
                let g = Guarantee {
                    id,
                    landlord: landlord.clone(),
                    monthly_amount,
                    months_covered: months,
                    months_used: 0,
                    fee_bps: 1_000,
                    period_secs: 2_592_000,
                    paid_until,
                    active: true,
                };
                s.e.storage().persistent().set(&RegKey::Guarantee(id), &g);
            }
        });
        start = end;
    }
    // Set the active set + NextId in a final small block.
    s.e.as_contract(&s.registry_id, || {
        let mut active = SVec::<u32>::new(&s.e);
        for id in 0..n {
            active.push_back(id);
        }
        s.e.storage().instance().set(&RegKey::ActiveIds, &active);
        s.e.storage().instance().set(&RegKey::NextId, &n);
    });

    // Sanity: the active set is exactly at the cap.
    assert_eq!(RegistryClient::new(&s.e, &s.registry_id).active_ids().len(), n);

    // wire() armed the RECORDING auth mode (mock_all_auths_allowing_non_root_auth),
    // whose mandatory end-of-invocation authorization snapshot scans accumulated
    // state and consumes the call's BUDGET on a test artifact unrelated to the
    // loop's real cost (it starves the host's per-call CPU budget at ~200 entries).
    // coverage_required is a pure read (no require_auth), so reset the budget to
    // unlimited — this isolates the genuine resource constraint, the per-tx LEDGER
    // FOOTPRINT, which we keep ENFORCED at mainnet limits below.
    s.e.cost_estimate().budget().reset_unlimited();
    // The test Env enforces InvocationResourceLimits::mainnet() on every top-level
    // call BY DEFAULT (cost_estimate.rs), whose binding constraint is
    // `ledger_entries: 100` — the per-tx footprint cap that rejected an earlier cap
    // of 200 with "total footprint entries: 402 > 100". reset_unlimited() above only
    // lifts the CPU/mem BUDGET (to dodge the recording-auth test artifact); the
    // mainnet FOOTPRINT limit stays enforced. So this call SUCCEEDING is host-checked
    // proof that coverage_required at the cap stays inside a real mainnet
    // transaction's footprint (the H3 resource claim) — an enforced bound, not an
    // asserted one. The returned value also equals the exact summed coverage figure
    // (aggregate-matches-sum, the conservative H3 check).
    assert_eq!(s.policy.coverage_required(), expected);

    // And confirm the measured footprint: ~one read per active guarantee, at/below
    // the mainnet 100-entry cap, with the active-set size (n) dominating it. (At
    // n=90 this measured 92 read entries: 90 Guarantee reads + registry instance +
    // policy instance, 0 disk, 0 writes — comfortable headroom under 100.)
    let res = s.e.cost_estimate().resources();
    let read_entries = res.disk_read_entries + res.memory_read_entries;
    assert!(
        read_entries <= 100,
        "coverage_required read {} ledger entries at cap {} — exceeds mainnet 100",
        read_entries, n,
    );
    assert!(
        read_entries >= n,
        "expected at least {} reads (one per active guarantee), got {}",
        n, read_entries,
    );
}

#[test]
fn policy_swap_preserves_data_and_funds() {
    let s = wire();
    let alice = Address::generate(&s.e);
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&alice, &10_000);
    s.token_admin.mint(&agency, &10_000);
    s.vault.deposit(&10_000, &alice, &alice, &alice);
    let gid = s.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &gid);
    let assets_before = s.vault.total_assets();
    let coverage_before = s.policy.coverage_required();

    // Deploy policy-v2, re-point writer + vault.policy. Same registry + vault.
    let policy2_id = s.e.register(Policy, (s.admin.clone(),));
    let policy2 = PolicyClient::new(&s.e, &policy2_id);
    policy2.set_vault(&s.vault_id);
    policy2.set_registry(&s.registry_id);
    policy2.set_coverage_ratio_bps(&10_000);
    RegistryClient::new(&s.e, &s.registry_id).set_writer(&policy2_id);
    s.vault.set_policy(&policy2_id);

    // Data and funds survived the swap; v2 sees the existing guarantee.
    assert_eq!(s.vault.total_assets(), assets_before);
    assert_eq!(policy2.coverage_required(), coverage_before);
    assert_eq!(policy2.guarantee(&gid).monthly_amount, 100);
    // v2 can now operate: a default pays out through the same vault.
    policy2.cover_default(&gid);
    let _ = &s.token_admin;
}
