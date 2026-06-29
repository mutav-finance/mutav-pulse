#![cfg(test)]
//! Randomized invariant harness for the `vault` contract.
//!
//! Drives randomized sequences of money-path ops
//! (deposit / request_redeem / process_redemptions / disburse / rebalance /
//! collect_fee / claim) and asserts, AFTER EVERY STEP, the three core vault
//! invariants:
//!
//!   (a) SOLVENCY      — `stable_assets() >= coverage_required()`.
//!   (b) ESCROW        — `ReservedForClaims == Σ claimable(fulfilled & !claimed)`
//!                       AND vault-held shares `== Σ shares(!fulfilled & !claimed)`,
//!                       and `ReservedForClaims >= 0`.
//!   (c) NAV-vs-FEE    — `nav_per_share()` never decreases across a fee collection.
//!
//! Two harnesses share the same step engine:
//!   * `inv_proptest_*` — `proptest!` over a generated op vector. The crate is
//!     `#![no_std]`; we `extern crate std;` so the test target links std, and
//!     proptest's macro/runtime resolve fine against it (verified to compile and
//!     run under this no_std soroban test crate).
//!   * `inv_lcg_*` — a deterministic LCG sweep (same spirit as
//!     `registry/src/test.rs`'s property test); a fast, seed-stable complement
//!     that runs a single long interleaving.

extern crate std;
use std::vec::Vec as StdVec;

use proptest::prelude::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Address;

use super::test::{add_mock, setup, Ctx};
use crate::types::DataKey;

/// One step of the money-path engine, shared by both harnesses. `sel` picks the op
/// (mod 7), `amt` is a bounded magnitude, `ai` selects an actor. Returns nothing;
/// all ops are best-effort (`try_*`) so an op that is currently invalid (e.g. a
/// redeem larger than the holder's balance) is simply a no-op, never a panic.
fn step(
    c: &Ctx,
    actors: &StdVec<Address>,
    agency: &Address,
    landlord: &Address,
    rids: &mut StdVec<u32>,
    sel: u8,
    amt: i128,
    ai: usize,
) {
    match sel % 7 {
        0 => {
            // deposit
            let a = actors[ai % actors.len()].clone();
            c.token_admin.mint(&a, &amt);
            let _ = c.vault.try_deposit(&amt, &a, &a, &a);
        }
        1 => {
            // request_redeem
            let a = actors[ai % actors.len()].clone();
            let bal = c.vault.balance(&a);
            if bal > 0 {
                let shares = (amt % bal) + 1;
                if let Ok(Ok(rid)) = c.vault.try_request_redeem(&a, &shares) {
                    rids.push(rid);
                }
            }
        }
        2 => {
            // process_redemptions
            let batch = (amt % 4) as u32;
            let _ = c.vault.try_process_redemptions(&batch);
        }
        3 => {
            // disburse — HONEST policy: coverage_after == current coverage, amount
            // within the true solvency room. (The SB-01 blind-trust breach is
            // covered in test_adversarial; here disburse must PRESERVE solvency.)
            let coverage = c.policy.coverage_required();
            let room = c.vault.stable_assets() - coverage;
            if room > 0 {
                let pay = (amt % room) + 1;
                let _ = c.policy.try_call_disburse(landlord, &pay, &coverage);
            }
        }
        4 => {
            // rebalance
            let _ = c.vault.try_rebalance();
        }
        5 => {
            // collect_fee — also enforces invariant (c) locally.
            let nav_before = c.vault.nav_per_share();
            c.token_admin.mint(agency, &amt);
            if c.policy.try_call_collect(agency, &amt).is_ok() {
                assert!(
                    c.vault.nav_per_share() >= nav_before,
                    "(c) fee collection decreased NAV: {} < {}",
                    c.vault.nav_per_share(),
                    nav_before
                );
            }
        }
        _ => {
            // claim the first fulfilled-but-unclaimed request, if any.
            for &rid in rids.iter() {
                let req = c.vault.request(&rid);
                if req.fulfilled && !req.claimed {
                    let _ = c.vault.try_claim(&rid);
                    break;
                }
            }
        }
    }
}

/// Occasionally move coverage to a SOLVENCY-RESPECTING value (`<= stable_assets`),
/// modeling a policy that never over-commits the reserve — so invariant (a) stays
/// meaningful without being trivially broken by the mock's unchecked setter.
fn maybe_set_coverage(c: &Ctx, knob: i128) {
    if knob % 5 == 0 {
        let stable = c.vault.stable_assets();
        let cov = if stable > 0 {
            knob.rem_euclid(stable + 1)
        } else {
            0
        };
        c.policy.set_coverage(&cov);
    }
}

/// Assert all three invariants against current vault state. Uses plain `assert!`
/// so it works in both harnesses (proptest reports the panic as a failing case
/// with the minimized input).
fn assert_invariants(c: &Ctx, rids: &StdVec<u32>, ctx: &str) {
    // (a) solvency
    let coverage = c.policy.coverage_required();
    let stable = c.vault.stable_assets();
    assert!(
        stable >= coverage,
        "(a) solvency breached {}: stable {} < coverage {}",
        ctx,
        stable,
        coverage
    );

    // (b) escrow conservation
    let reserved = c.e.as_contract(&c.vault_id, || {
        c.e.storage()
            .instance()
            .get::<_, i128>(&DataKey::ReservedForClaims)
            .unwrap_or(0)
    });
    assert!(reserved >= 0, "(b) ReservedForClaims negative {}", ctx);
    let mut sum_claimable = 0i128;
    let mut sum_escrowed_shares = 0i128;
    for &rid in rids.iter() {
        let req = c.vault.request(&rid);
        if req.fulfilled && !req.claimed {
            sum_claimable += req.claimable;
        } else if !req.fulfilled && !req.claimed {
            sum_escrowed_shares += req.shares;
        }
    }
    assert_eq!(
        reserved, sum_claimable,
        "(b) reserved != Σ claimable {}",
        ctx
    );
    assert_eq!(
        c.vault.balance(&c.vault_id),
        sum_escrowed_shares,
        "(b) vault shares != Σ escrowed shares {}",
        ctx
    );
}

fn fresh() -> (Ctx, StdVec<Address>, Address, Address) {
    let c = setup();
    let _strat = add_mock(&c, 10_000); // one lossless STABLE strategy
    let landlord = Address::generate(&c.e);
    let mut actors: StdVec<Address> = StdVec::new();
    for _ in 0..3 {
        actors.push(Address::generate(&c.e));
    }
    let agency = Address::generate(&c.e);
    c.policy.set_coverage(&0);
    (c, actors, agency, landlord)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    /// Property: an arbitrary bounded interleaving of money-path ops keeps the
    /// vault solvent, the escrow ledger conserved, and fees NAV-monotone, with the
    /// invariants checked after EVERY step.
    #[test]
    fn inv_proptest_money_paths_preserve_invariants(
        ops in prop::collection::vec((0u8..7u8, 1i128..500i128, 0usize..3usize), 1..50usize),
    ) {
        let (c, actors, agency, landlord) = fresh();
        let mut rids: StdVec<u32> = StdVec::new();

        for (i, (sel, amt, ai)) in ops.iter().enumerate() {
            step(&c, &actors, &agency, &landlord, &mut rids, *sel, *amt, *ai);
            maybe_set_coverage(&c, amt.wrapping_mul((i as i128) + 1));

            // Use the std-friendly fmt only for the context tag.
            assert_invariants(&c, &rids, "in proptest step");
        }
    }
}

/// Deterministic LCG complement: one long (240-step) interleaving from a fixed
/// seed — fast, reproducible, and not dependent on proptest's shrinker.
fn next_rand(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1442695040888963407);
    *state >> 33
}

#[test]
fn inv_lcg_money_paths_preserve_invariants() {
    let (c, actors, agency, landlord) = fresh();
    let mut rids: StdVec<u32> = StdVec::new();
    let mut s: u64 = 0x2545_F491_4F6C_DD1D;

    for _ in 0..240u32 {
        let sel = (next_rand(&mut s) % 7) as u8;
        let amt = (next_rand(&mut s) % 500 + 1) as i128;
        let ai = (next_rand(&mut s) as usize) % actors.len();
        step(&c, &actors, &agency, &landlord, &mut rids, sel, amt, ai);
        maybe_set_coverage(&c, next_rand(&mut s) as i128);
        assert_invariants(&c, &rids, "in lcg sweep");
    }
}
