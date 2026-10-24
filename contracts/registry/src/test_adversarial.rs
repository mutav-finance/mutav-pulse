#![cfg(test)]
//! Adversarial tests for the `registry` contract.
//!
//! These complement `test.rs`. The existing suite runs entirely under
//! `mock_all_auths_allowing_non_root_auth()`, so every `require_auth` passes
//! VACUOUSLY — the auth GATES (writer on next_id/put, admin on upgrade) are never
//! actually exercised as a negative. Here we flip the env into ENFORCING mode with
//! `e.set_auths(&[])` AFTER setup, so the only configured authorizer is "nobody",
//! and prove the gates reject an unauthorized caller.
//!
//! Style mirrors `test.rs`: `Env::default()` + a local `g(...)` Guarantee factory
//! (the one in `test.rs` is a private `fn`, not re-exportable, so it is replicated
//! minimally here per the harness instructions).

use crate::{DataKey, Registry, RegistryClient, CURRENT_SCHEMA_VERSION};
use interfaces::{Guarantee, RegistryError};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

/// Minimal Guarantee factory (replicates `test::g`, which is private to that
/// module). Pilot-shaped: monthly 100, default leg 3 months, exit leg 6 months.
fn g(_e: &Env, id: u32, landlord: &Address, active: bool) -> Guarantee {
    Guarantee {
        id,
        landlord: landlord.clone(),
        monthly_amount: 100,
        months_covered: 3,
        months_used: 0,
        exit_months: 6,
        exit_used: 0,
        fee_bps: 1_000,
        period_secs: 2_592_000,
        paid_until: 0,
        active,
    }
}

// ───────────────────────────── AC-03 ─────────────────────────────
//
// Write-gating (require_writer on next_id L240 / put L253, both -> writer.require_auth
// L168) is the ONLY thing stopping a non-policy actor from fabricating / mutating
// guarantee rows — the very rows that feed RawCoverage and the policy solvency floor.
// The existing tests only ever cover the WriterNotSet fallback and the id-range guard,
// always under mock_all_auths (so require_auth never actually rejects anyone).
//
// Here: configure writer = `policy`, issue id 0 (so a put of id 0 is in-range and
// would otherwise succeed), then switch to ENFORCING mode with an EMPTY auth set.
// With no auth satisfying the configured writer, BOTH next_id and put must Err, and
// neither NextId, the Guarantee row, nor RawCoverage may change.
#[test]
fn adv_registry_put_next_id_require_writer() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    // Issue id 0 so a subsequent put(id=0) is in the valid range (NextId becomes 1).
    let id0 = r.next_id();
    assert_eq!(id0, 0);

    // Snapshot the writer-gated state BEFORE the unauthorized attempts.
    let next_before: u32 = e.as_contract(&id, || {
        e.storage().instance().get(&DataKey::NextId).unwrap()
    });
    let raw_before: i128 = e.as_contract(&id, || {
        e.storage().instance().get(&DataKey::RawCoverage).unwrap()
    });
    assert_eq!(next_before, 1);
    assert_eq!(raw_before, 0);

    // Flip to ENFORCING mode: the only authorizer is now the empty set, so the
    // configured writer (`policy`) cannot satisfy require_auth.
    e.set_auths(&[]);

    // next_id() by a non-writer must Err (writer.require_auth, L168).
    let r_next = r.try_next_id();
    assert!(
        r_next.is_err(),
        "next_id must be rejected without writer auth"
    );

    // put() by a non-writer must Err — no row may be fabricated/mutated.
    let r_put = r.try_put(&g(&e, 0, &landlord, true));
    assert!(r_put.is_err(), "put must be rejected without writer auth");

    // INVARIANT: nothing mutated. NextId unchanged, no Guarantee(0) row written,
    // RawCoverage cannot be inflated by a non-writer. (Storage reads via as_contract
    // bypass auth — they assert the gate held, not that reads are gated.)
    let next_after: u32 = e.as_contract(&id, || {
        e.storage().instance().get(&DataKey::NextId).unwrap()
    });
    assert_eq!(
        next_after, next_before,
        "NextId mutated by unauthorized caller"
    );

    let row_exists = e.as_contract(&id, || e.storage().persistent().has(&DataKey::Guarantee(0)));
    assert!(!row_exists, "non-writer fabricated a Guarantee row");

    let raw_after: i128 = e.as_contract(&id, || {
        e.storage().instance().get(&DataKey::RawCoverage).unwrap()
    });
    assert_eq!(
        raw_after, raw_before,
        "RawCoverage moved without writer auth"
    );
}

// ───────────────────────────── AC-05 ─────────────────────────────
//
// upgrade() is the malicious-wasm vector. require_auth(admin) (L145) runs BEFORE the
// VersionMismatch check (L153-156). The existing `upgrade_refuses_on_version_mismatch`
// test deliberately trips the VERSION guard (by pre-setting a stale version) under
// mock_all_auths, so the AUTH-ONLY gate is genuinely untested.
//
// Here we keep SchemaVersion at CURRENT so the version guard would PASS — isolating
// the auth gate as the sole thing that can reject. Then, in ENFORCING mode with an
// empty auth set, a non-admin upgrade to a bogus wasm hash must Err at require_auth,
// and crucially must NOT be the typed VersionMismatch (which would mean it slipped
// past the auth gate).
#[test]
fn adv_upgrade_admin_gate_blocks_nonadmin() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);

    // Constructor sets SchemaVersion = CURRENT, so the version guard would pass —
    // any rejection below is therefore attributable to the admin auth gate alone.
    assert_eq!(r.schema_version(), CURRENT_SCHEMA_VERSION);

    // Flip to ENFORCING mode: no auth can satisfy require_auth(admin).
    e.set_auths(&[]);

    let bogus = BytesN::from_array(&e, &[0u8; 32]);
    let res = r.try_upgrade(&bogus);

    // Must be rejected...
    assert!(
        res.is_err(),
        "upgrade must be rejected for a non-admin caller"
    );
    // ...and NOT via the version guard (which we kept satisfied). If it surfaced
    // VersionMismatch, that would prove it ran the version check, i.e. slipped past
    // require_auth — the bug this test is designed to catch.
    match res {
        Err(Ok(err)) => assert_ne!(
            err,
            RegistryError::VersionMismatch.into(),
            "upgrade tripped the version guard instead of the admin auth gate — \
             auth was not enforced first"
        ),
        // A host-level auth error (Err(Err(InvokeError))) is the expected, ideal
        // outcome: require_auth(admin) rejected before any typed contract logic ran.
        Err(Err(_)) => {}
        Ok(_) => panic!("upgrade unexpectedly succeeded for a non-admin caller"),
    }

    // INVARIANT: schema version (and therefore the contract's notion of its own
    // layout/wasm) is untouched by the rejected upgrade.
    e.mock_all_auths_allowing_non_root_auth();
    assert_eq!(
        r.schema_version(),
        CURRENT_SCHEMA_VERSION,
        "schema version changed"
    );
}
