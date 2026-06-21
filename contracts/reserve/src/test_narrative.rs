#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Address;
use crate::test::{add_mock, setup};

#[test]
fn full_demo_flow_holds_solvency_invariant() {
    const MONTH: u64 = 2_592_000;
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &10_000);
    c.token_admin.mint(&bob, &10_000);
    c.token_admin.mint(&agency, &10_000);

    // 1. Two investors deposit; capital diversifies across two venues.
    c.reserve.deposit(&alice, &10_000);
    c.reserve.deposit(&bob, &10_000);
    let s1 = add_mock(&c, 6_000);
    let s2 = add_mock(&c, 4_000);
    c.reserve.rebalance();
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 2. Underwrite a batch of guarantees; agencies pay premiums to activate.
    let g1 = c.reserve.sign_guarantee(&landlord, &500, &6, &1_000, &MONTH); // exposure 3000
    let g2 = c.reserve.sign_guarantee(&landlord, &300, &6, &1_000, &MONTH); // exposure 1800
    c.reserve.pay_premium(&agency, &g1); // +50 revenue, activates coverage
    c.reserve.pay_premium(&agency, &g2); // +30 revenue, activates coverage
    assert_eq!(c.reserve.coverage_required(), 4_800);
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 3. A contract defaults; landlord is paid first.
    c.reserve.cover_default(&g1);
    assert_eq!(c.token.balance(&landlord), 500);
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 4. Bob queues to exit; only surplus is available.
    let rid = c.reserve.request_redeem(&bob, &5_000);
    c.reserve.process_redemptions(&10);
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 5. Yield accrues, surplus grows, the queue drains.
    s1.accrue(&1_000);
    s2.accrue(&1_000);
    c.reserve.process_redemptions(&10);
    if c.reserve.request(&rid).fulfilled {
        c.reserve.claim(&rid);
    }
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());
}
