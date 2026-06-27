#![cfg(test)]
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::testutils::storage::{Instance as _, Persistent as _};
use soroban_sdk::{Address, Env};
use interfaces::{Guarantee, RegistryError};
use crate::{guarantee_ttl_ledgers, DataKey, Registry, RegistryClient, MAX_ENTRY_TTL};

fn g(_e: &Env, id: u32, landlord: &Address, active: bool) -> Guarantee {
    Guarantee {
        id,
        landlord: landlord.clone(),
        monthly_amount: 100,
        months_covered: 6,
        months_used: 0,
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

    // TTL-hygiene guard: extending on the read path must NOT materialize a write
    // for a missing id (extend only on the Some branch). After a failed get(999)
    // no Guarantee(999) entry exists.
    match r.try_get(&999) {
        Err(Ok(e)) => assert_eq!(e, RegistryError::GuaranteeNotFound),
        _ => panic!("expected GuaranteeNotFound typed error"),
    }
    let exists = e.as_contract(&id, || {
        e.storage().persistent().has(&DataKey::Guarantee(999))
    });
    assert!(!exists, "missing id must not be materialized by read-path extend");
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

/// The lifecycle read path (`get`, behind policy.coverage_required / cover_default
/// / pay_premium) re-extends the Guarantee TTL. After advancing the ledger so the
/// remaining TTL decays below target, a single `get` bumps it back up. RED before
/// the fix: the read path never extends, so the TTL stays decayed.
#[test]
fn get_reextends_guarantee_ttl_after_advance() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);
    let g0 = g(&e, 0, &landlord, true);
    r.put(&g0);

    // Advance the ledger so the remaining TTL drops well below target.
    e.ledger().with_mut(|l| l.sequence_number += 1_000_000);
    let target = guarantee_ttl_ledgers(g0.period_secs, g0.months_covered);
    let decayed = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert!(decayed < target, "ttl should have decayed below target");

    // Lifecycle read re-extends.
    let _ = r.get(&0);
    let bumped = e.as_contract(&id, || {
        e.storage().persistent().get_ttl(&DataKey::Guarantee(0))
    });
    assert!(bumped >= target - 10, "get did not re-extend: {} < {}", bumped, target);
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
