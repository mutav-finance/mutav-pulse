#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};
use interfaces::{Guarantee, RegistryError};
use crate::{Registry, RegistryClient};

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
}
