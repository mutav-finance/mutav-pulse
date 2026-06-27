#![cfg(test)]
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::testutils::storage::{Instance as _, Persistent as _};
use soroban_sdk::{Address, Env};
use interfaces::{Guarantee, RegistryError};
use crate::{guarantee_ttl_ledgers, DataKey, Registry, RegistryClient, CURRENT_SCHEMA_VERSION, MAX_ENTRY_TTL};

fn g(_e: &Env, id: u32, landlord: &Address, active: bool) -> Guarantee {
    Guarantee {
        id,
        landlord: landlord.clone(),
        monthly_amount: 100,
        // months_covered stays 6 here so the TTL tests (put_extends_guarantee_ttl,
        // guarantee_ttl_clamped_to_max) keep their existing span math; the
        // coverage tests override it to the pilot default (3) explicitly.
        months_covered: 6,
        months_used: 0,
        exit_months: 6,
        exit_used: 0,
        fee_bps: 1_000,
        period_secs: 2_592_000,
        paid_until: 0,
        active,
    }
}

#[test]
fn writer_gating_and_active_set() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);
    assert_eq!(r.writer(), policy);

    // next_id returns sequential ids 0, 1, 2, ... The counter uses checked_add
    // internally (panics on the u32::MAX wrap instead of silently colliding
    // Guarantee(0)); the full 4.2B-id boundary is unreachable in-test, so this
    // asserts the behavior-preserving sequential path only.
    let id0 = r.next_id();
    let id1 = r.next_id();
    let id2 = r.next_id();
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);

    r.put(&g(&e, id0, &landlord, true));
    r.put(&g(&e, id1, &landlord, true));
    assert_eq!(r.active_ids().len(), 2);
    assert_eq!(r.get(&id0).monthly_amount, 100);

    // Deactivate id0 -> drops from active set.
    r.put(&g(&e, id0, &landlord, false));
    assert_eq!(r.active_ids().len(), 1);
    assert_eq!(r.active_ids().get(0).unwrap(), id1);
}

/// get on an unknown id returns the typed GuaranteeNotFound error (a stable
/// contract error code) instead of trapping on a bare unwrap.
#[test]
fn get_unknown_id_returns_typed_error() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);

    // Nothing stored under id 42 -> typed error, not a host trap.
    // (Guarantee has no PartialEq/Debug, so match the Err arm directly.)
    match r.try_get(&42) {
        Err(Ok(e)) => assert_eq!(e, RegistryError::GuaranteeNotFound),
        _ => panic!("expected GuaranteeNotFound typed error"),
    }

    // Purity guard: a pure get never materializes a missing id. After a failed
    // get(999) no Guarantee(999) entry exists.
    match r.try_get(&999) {
        Err(Ok(e)) => assert_eq!(e, RegistryError::GuaranteeNotFound),
        _ => panic!("expected GuaranteeNotFound typed error"),
    }
    let exists = e.as_contract(&id, || {
        e.storage().persistent().has(&DataKey::Guarantee(999))
    });
    assert!(!exists, "pure get must not materialize a missing id");
}

// ───────────────────────────── H6: storage TTL hygiene ─────────────────────────────

/// `put` extends the Guarantee entry's TTL to cover the full coverage span
/// (period_secs * months_covered, converted to ledgers). RED before the fix:
/// the entry sits at only the default min_persistent_entry_ttl.
#[test]
fn put_extends_guarantee_ttl() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    // period_secs = 30d, months_covered = 6 → span 15_552_000s.
    // Issue id 0 first (put now rejects ids >= NextId — fabricated keys).
    let _ = r.next_id();
    let g0 = g(&e, 0, &landlord, true); // period_secs 2_592_000, months_covered 6
    r.put(&g0);

    let ttl = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    let target = guarantee_ttl_ledgers(g0.period_secs, g0.months_covered);
    // Computed span in ledgers = 2_592_000 * 6 / 5 = 3_110_400.
    assert_eq!(target, 3_110_400);
    assert!(ttl >= target - 10, "ttl {} below target {}", ttl, target);
    assert!(ttl <= MAX_ENTRY_TTL, "ttl {} above network max", ttl);
}

/// PURITY: `get` is a pure read — it must NOT extend the Guarantee TTL (re-audit
/// H2). The prior TTL fix bumped on every read, so policy.coverage_required (loops
/// get over active_ids) did O(active) storage WRITES per solvency view, and any SDK
/// /frontend treating get as side-effect-free mutated storage on simulate. After
/// advancing the ledger so the TTL decays, a `get` must leave it EXACTLY unchanged.
/// Archival protection comes from the write paths (put / lifecycle re-puts), not get.
#[test]
fn get_does_not_extend_guarantee_ttl() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);
    let _ = r.next_id(); // issue id 0 before put (put rejects fabricated ids)
    let g0 = g(&e, 0, &landlord, true);
    r.put(&g0);

    let ttl_before = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });

    // Advance the ledger so the remaining TTL decays.
    e.ledger().with_mut(|l| l.sequence_number += 1_000_000);
    let decayed = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert!(decayed < ttl_before, "ttl should have decayed after advance");

    // Pure read: still returns the struct...
    assert_eq!(r.get(&0).monthly_amount, 100);

    // ...and leaves the TTL EXACTLY unchanged (load-bearing purity assertion).
    let after = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert_eq!(after, decayed, "get must NOT change TTL (pure read)");
}

/// The WRITE path (`put`, exercised by every policy lifecycle mutation —
/// sign_guarantee / pay_premium / cover_default / settle_guarantee re-put the full
/// struct) re-extends the Guarantee TTL. After advancing the ledger so the TTL
/// decays below target, an in-range re-put bumps it back up. This is the archival
/// defense after get() became pure.
#[test]
fn put_reextends_guarantee_ttl_after_advance() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);
    let _ = r.next_id(); // issue id 0 before put (put rejects fabricated ids)
    let g0 = g(&e, 0, &landlord, true);
    r.put(&g0);

    // Advance the ledger so the remaining TTL drops below target.
    e.ledger().with_mut(|l| l.sequence_number += 1_000_000);
    let target = guarantee_ttl_ledgers(g0.period_secs, g0.months_covered);
    let decayed = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert!(decayed < target, "ttl should have decayed below target");

    // In-range re-put of id 0 re-extends (write path).
    r.put(&g0);
    let bumped = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert!(bumped >= target - 10, "put did not re-extend: {} < {}", bumped, target);
}

/// A guarantee whose span/5 exceeds MAX_ENTRY_TTL must clamp to the network max,
/// and `put` must NOT trap (the host rejects extend_to > max_entry_ttl).
#[test]
fn guarantee_ttl_clamped_to_max() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    // period_secs huge, months_covered 12 → span/5 >> MAX_ENTRY_TTL.
    let _ = r.next_id(); // issue id 0 before put (put rejects fabricated ids)
    let mut g0 = g(&e, 0, &landlord, true);
    g0.period_secs = 100_000_000_000;
    g0.months_covered = 12;
    // Pure helper clamps.
    assert_eq!(guarantee_ttl_ledgers(g0.period_secs, g0.months_covered), MAX_ENTRY_TTL);
    // And put does not trap.
    r.put(&g0);
    let ttl = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert!(ttl <= MAX_ENTRY_TTL);
    assert!(ttl >= MAX_ENTRY_TTL - 10);
}

/// Mutating entrypoints bump the instance entry (Admin/Writer/NextId/ActiveIds)
/// TTL toward the network max so the active_ids iteration behind
/// coverage_required never archives.
#[test]
fn instance_ttl_bumped_on_mutations() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);
    let _ = r.next_id();

    let ttl = e.as_contract(&id, || e.storage().instance().get_ttl());
    // Bumped at least to MAX_ENTRY_TTL/2 (the threshold) → well above default 4096.
    assert!(ttl >= MAX_ENTRY_TTL / 2 - 10, "instance ttl not bumped: {}", ttl);
}

// ──────────────────── Registry hardening (id-trust, writer default, version) ────────────────────

/// `put` must reject a caller-supplied id outside the issued range (>= NextId).
/// RED before the fix: `put` trusted `g.id` and silently wrote a fabricated
/// future key. Here NextId is 1 (one id issued) and id=5 is out of range.
#[test]
fn put_rejects_fabricated_future_id() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let _ = r.next_id(); // issues id 0, NextId becomes 1
    match r.try_put(&g(&e, 5, &landlord, true)) {
        Err(Ok(err)) => assert_eq!(err, RegistryError::InvalidId.into()),
        _ => panic!("expected InvalidId for a fabricated future id"),
    }
}

/// `put` on a fresh registry (NextId == 0) must reject id=0 — closes the
/// empty-registry id=0 footgun where no id has been issued yet.
#[test]
fn put_rejects_id_on_empty_registry() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    match r.try_put(&g(&e, 0, &landlord, true)) {
        Err(Ok(err)) => assert_eq!(err, RegistryError::InvalidId.into()),
        _ => panic!("expected InvalidId on empty registry"),
    }
}

/// Re-puts of an already-issued id must succeed (the `>=` boundary, not `>`).
/// pay_premium / cover_default / settle_guarantee all re-put existing ids;
/// guards against an over-strict regression that would block legitimate updates.
#[test]
fn put_allows_reput_of_issued_id() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = r.next_id();
    let id1 = r.next_id();
    r.put(&g(&e, id0, &landlord, true));
    r.put(&g(&e, id1, &landlord, true));
    assert_eq!(r.active_ids().len(), 2);

    // Re-put id0 with active=false — an in-range update, must NOT be rejected.
    r.put(&g(&e, id0, &landlord, false));
    assert_eq!(r.active_ids().len(), 1);
    assert_eq!(r.active_ids().get(0).unwrap(), id1);
}

/// The constructor defaults Writer=admin (OZ-Ownable convention), removing the
/// unset-writer trap window between deploy and `set_writer`. RED before the fix:
/// `writer()` traps on a missing Writer key.
#[test]
fn writer_defaults_to_admin_in_constructor() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);

    // No set_writer call — admin is the default writer.
    assert_eq!(r.writer(), admin);

    // And the writer-gated path works immediately (admin is the writer).
    let id0 = r.next_id();
    assert_eq!(id0, 0);
    r.put(&g(&e, id0, &landlord, true));
    assert_eq!(r.active_ids().len(), 1);
}

/// Defense-in-depth: when the Writer key is absent (simulating an old layout
/// upgraded in before the constructor default), the writer-gated path surfaces a
/// typed `WriterNotSet` error instead of a host trap. We clear the key directly
/// to reach the otherwise-unreachable fallback.
#[test]
fn writer_unset_returns_typed_error() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);

    // Simulate a pre-default instance: remove the Writer key.
    e.as_contract(&id, || {
        e.storage().instance().remove(&DataKey::Writer);
    });

    // require_writer-driven entrypoint surfaces the typed error.
    match r.try_put(&g(&e, 0, &landlord, true)) {
        Err(Ok(err)) => assert_eq!(err, RegistryError::WriterNotSet.into()),
        _ => panic!("expected WriterNotSet typed error"),
    }
}

/// The constructor records the current schema version (bumped 1 -> 2 for the
/// appended RawCoverage instance entry).
#[test]
fn schema_version_is_two_after_construct() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    assert_eq!(r.schema_version(), CURRENT_SCHEMA_VERSION);
    assert_eq!(r.schema_version(), 2);
}

/// `upgrade` refuses when the on-chain schema version does not match this binary
/// (stale / layout-incompatible storage) — surfacing the dedicated
/// `VersionMismatch` code. We pre-set a mismatched version to reach the guard
/// without needing a real replacement wasm hash.
#[test]
fn upgrade_refuses_on_version_mismatch() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);

    // Force a stale on-chain version.
    e.as_contract(&id, || {
        e.storage().instance().set(&DataKey::SchemaVersion, &0u32);
    });

    let bogus = soroban_sdk::BytesN::from_array(&e, &[0u8; 32]);
    match r.try_upgrade(&bogus) {
        Err(Ok(err)) => assert_eq!(err, RegistryError::VersionMismatch.into()),
        _ => panic!("expected VersionMismatch on stale schema version"),
    }
}

// ──────────────────── #39: O(1) RawCoverage aggregate (put-delta) ────────────────────

/// Issue id 0 active with the PILOT default leg (months_covered = 3) over the
/// helper's exit_months = 6; returns its id. Pilot contribution = 100*3 + 100*6 =
/// 900. Used by the coverage tests below as the starting aggregate.
fn issue_pilot(e: &Env, r: &RegistryClient, landlord: &Address) -> u32 {
    let id0 = r.next_id();
    let mut g0 = g(e, id0, landlord, true);
    g0.months_covered = 3;
    r.put(&g0);
    id0
}

/// A fresh registry has a zero aggregate (constructor init + unwrap_or(0) belt).
#[test]
fn raw_coverage_zero_on_fresh_registry() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    assert_eq!(r.raw_coverage(), 0);
}

/// Activating put adds default + exit legs: 100*3 + (100*6 - 0) = 900.
#[test]
fn raw_coverage_activation_adds_default_plus_exit() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    issue_pilot(&e, &r, &landlord);
    assert_eq!(r.raw_coverage(), 900);
}

/// cover_default re-put (months_used 0 -> 1) decrements the default leg by one
/// monthly: 100*(3-1) + 600 = 800.
#[test]
fn raw_coverage_cover_default_decrements_by_monthly() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = issue_pilot(&e, &r, &landlord);
    assert_eq!(r.raw_coverage(), 900);

    let mut g0 = g(&e, id0, &landlord, true);
    g0.months_covered = 3;
    g0.months_used = 1;
    r.put(&g0);
    assert_eq!(r.raw_coverage(), 800);
}

/// cover_exit re-put (exit_used 0 -> 50) decrements the exit leg by the amount:
/// 100*3 + (600 - 50) = 850.
#[test]
fn raw_coverage_cover_exit_decrements_by_amount() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = issue_pilot(&e, &r, &landlord);
    assert_eq!(r.raw_coverage(), 900);

    let mut g0 = g(&e, id0, &landlord, true);
    g0.months_covered = 3;
    g0.exit_used = 50;
    r.put(&g0);
    assert_eq!(r.raw_coverage(), 850);
}

/// settle (active -> false) subtracts the guarantee's entire remaining
/// contribution: 900 -> 0.
#[test]
fn raw_coverage_settle_subtracts_remaining() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = issue_pilot(&e, &r, &landlord);
    assert_eq!(r.raw_coverage(), 900);

    let mut g0 = g(&e, id0, &landlord, false);
    g0.months_covered = 3;
    r.put(&g0);
    assert_eq!(r.raw_coverage(), 0);
}

/// Exhausting the default leg AND deactivating contributes 0 (inactive ⇒ 0 leg,
/// regardless of months_used == months_covered).
#[test]
fn raw_coverage_exhaust_default_zeroes_default_leg() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = issue_pilot(&e, &r, &landlord);
    assert_eq!(r.raw_coverage(), 900);

    let mut g0 = g(&e, id0, &landlord, false);
    g0.months_covered = 3;
    g0.months_used = 3; // exhausted default leg
    r.put(&g0);
    assert_eq!(r.raw_coverage(), 0);
}

/// First put of an id with active=false adds 0 (inactive ⇒ no contribution).
#[test]
fn raw_coverage_inactive_first_put_contributes_zero() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = r.next_id();
    let mut g0 = g(&e, id0, &landlord, false);
    g0.months_covered = 3;
    r.put(&g0);
    assert_eq!(r.raw_coverage(), 0);
}

/// `reconcile` recomputes the aggregate from the active set, correcting any forced
/// drift back to the independently-summed truth.
#[test]
fn reconcile_corrects_forced_drift() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    // Two active guarantees with distinct params.
    let a = r.next_id();
    let mut ga = g(&e, a, &landlord, true);
    ga.monthly_amount = 100;
    ga.months_covered = 3;
    ga.months_used = 1;
    ga.exit_used = 50;
    r.put(&ga); // 100*(3-1) + (100*6-50) = 200 + 550 = 750
    let b = r.next_id();
    let mut gb = g(&e, b, &landlord, true);
    gb.monthly_amount = 200;
    gb.months_covered = 3;
    r.put(&gb); // 200*3 + 200*6 = 600 + 1200 = 1800

    // Force a wrong aggregate.
    e.as_contract(&id, || {
        e.storage().instance().set(&DataKey::RawCoverage, &123_456i128);
    });
    assert_eq!(r.raw_coverage(), 123_456);

    r.reconcile();

    // Independently recompute over the active set.
    let mut expected: i128 = 0;
    for aid in r.active_ids().iter() {
        let gg = r.get(&aid);
        let dterm = gg.monthly_amount * (gg.months_covered - gg.months_used) as i128;
        let eterm = gg.monthly_amount * gg.exit_months as i128 - gg.exit_used;
        expected += dterm + eterm;
    }
    assert_eq!(expected, 2550);
    assert_eq!(r.raw_coverage(), expected);
}

/// Deterministic LCG (no proptest crate) advances the registry through randomized
/// issue/pay/cover_default/cover_exit/settle lifecycles and asserts, after EVERY
/// step, that the stored O(1) `raw_coverage` equals the aggregate recomputed
/// INDEPENDENTLY by re-reading every active guarantee's fields back from the
/// registry. This is the CORE property: `put` is the sole mutator and its delta is
/// exact at every write across arbitrary interleavings.
fn next_rand(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    *state >> 33
}

#[test]
fn raw_coverage_equals_sum_contribution_across_lifecycles() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let mut s: u64 = 0x2545_F491_4F6C_DD1D;
    let mut n: u32 = 0; // count of issued ids (ids are 0..n)
    const CAP: u32 = 30; // bound the book so the per-step recompute stays cheap

    for step in 0..3000u32 {
        let op = next_rand(&mut s) % 5;
        if op == 0 || n == 0 {
            // issue: next_id() then a fresh active put with random monthly 1..=1000.
            if n < CAP {
                let monthly = (next_rand(&mut s) % 1000 + 1) as i128;
                let nid = r.next_id();
                assert_eq!(nid, n);
                let mut gi = g(&e, nid, &landlord, true);
                gi.monthly_amount = monthly;
                r.put(&gi);
                n += 1;
            }
        } else {
            let pid = (next_rand(&mut s) as u32) % n;
            match op {
                1 => {
                    // pay: no-op re-put of the current struct.
                    let gx = r.get(&pid);
                    r.put(&gx);
                }
                2 => {
                    // cover_default: months_used += 1 (deactivate at == covered).
                    let mut gx = r.get(&pid);
                    if gx.active && gx.months_used < gx.months_covered {
                        gx.months_used += 1;
                        if gx.months_used == gx.months_covered {
                            gx.active = false;
                        }
                        r.put(&gx);
                    }
                }
                3 => {
                    // cover_exit: draw a random amount up to the remaining cap.
                    let mut gx = r.get(&pid);
                    if gx.active {
                        let cap = gx.monthly_amount * gx.exit_months as i128;
                        let remaining = cap - gx.exit_used;
                        if remaining > 0 {
                            let delta = (next_rand(&mut s) as i128) % (remaining + 1);
                            gx.exit_used += delta;
                            r.put(&gx);
                        }
                    }
                }
                _ => {
                    // settle: deactivate.
                    let mut gx = r.get(&pid);
                    gx.active = false;
                    r.put(&gx);
                }
            }
        }

        // Independent recompute over the active set (re-implemented formula).
        let mut expected: i128 = 0;
        for aid in r.active_ids().iter() {
            let gg = r.get(&aid);
            let dterm = gg.monthly_amount * (gg.months_covered - gg.months_used) as i128;
            let eterm = gg.monthly_amount * gg.exit_months as i128 - gg.exit_used;
            expected += dterm + eterm;
        }
        assert_eq!(r.raw_coverage(), expected, "raw_coverage drift at step {}", step);
    }
}
