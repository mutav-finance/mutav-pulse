#![cfg(test)]
//! Adversarial / attacker-model tests for the `vault` contract.
//!
//! Each test maps to one scenario id (SB-/RQ-/AC-/SM-/REENT-/SI-) from the
//! vault threat model. They REUSE the canonical `super::test::setup()` / `Ctx`
//! factory and the `add_mock` helper, mirroring the existing test style
//! (`Env::default()` + `mock_all_auths_allowing_non_root_auth`, `try_*` for
//! negatives, `#[should_panic]` for distinct panic messages).
//!
//! A test that documents an ACCEPTED residual (e.g. SB-01's blind-trust gap) is
//! written to assert the OBSERVED behavior so the gap is pinned as reachable.

use soroban_sdk::testutils::Address as _;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

use super::test::{add_mock, setup, Ctx};
use crate::types::DataKey;
use crate::{Vault, VaultClient, VaultError};

use mock_policy::{MockPolicy, MockPolicyClient};
use mock_strategy::{MockStrategy, MockStrategyClient};

/// Read `ReservedForClaims` directly out of vault instance storage.
fn reserved_for_claims(c: &Ctx) -> i128 {
    c.e.as_contract(&c.vault_id, || {
        c.e.storage()
            .instance()
            .get::<_, i128>(&DataKey::ReservedForClaims)
            .unwrap_or(0)
    })
}

// ───────────────────────────── SB-01 ─────────────────────────────

/// SB-01 (solvency-breach, critical): the vault trusts the policy-attested
/// `coverage_after` BLINDLY (interfaces L132-138). A policy passing a
/// `coverage_after` BELOW the true `coverage_required()` drains stable assets
/// below the real solvency floor while the witness assert still passes.
///
/// This PINS the residual blind-trust gap as reachable: the ideal invariant
/// `stable_assets() >= coverage_required()` is VIOLATED post-disburse because the
/// vault cannot recompute the floor (Soroban re-entry forbids the callback).
#[test]
fn adv_disburse_blind_trusts_underreported_coverage_after() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // True floor = the whole vault.
    c.policy.set_coverage(&1_000);

    // The policy forwards a LYING coverage_after = 0. Witness:
    //   overdraft: stable_pre(1_000) >= 500            ✓
    //   solvency : 1_000 - 500 = 500 >= coverage_after(0) ✓
    // Both pass even though the TRUE floor is 1_000.
    c.policy.call_disburse(&landlord, &500, &0);

    // The drain succeeded.
    assert_eq!(c.token.balance(&landlord), 500);
    assert_eq!(c.vault.stable_assets(), 500);

    // IDEAL solvency invariant is VIOLATED: 500 stable < 1_000 required.
    assert!(
        c.vault.stable_assets() < c.policy.coverage_required(),
        "expected the blind-trust gap to leave the vault insolvent"
    );
}

// ───────────────────────────── RQ-03 ─────────────────────────────

/// RQ-03 (redemption-queue, critical): cash reserved for a fulfilled-but-unclaimed
/// redemption must be invisible to the disburse money-path. `available_held` nets
/// `ReservedForClaims` and `stable_assets_inner` uses it, so a disburse must NOT
/// spend cash earmarked for a pending claim (no claimant/landlord double-spend).
#[test]
fn adv_disburse_cannot_spend_reserved_for_claims() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    c.policy.set_coverage(&0);
    let rid = c.vault.request_redeem(&alice, &1_000);
    c.vault.process_redemptions(&10);

    // All cash is now reserved for the fulfilled claim.
    assert_eq!(reserved_for_claims(&c), 1_000);
    assert_eq!(c.vault.stable_assets(), 0);
    assert_eq!(c.vault.free_capital(), 0);
    assert_eq!(c.vault.available_held(), 0);

    // A disburse must NOT be able to spend the reserved cash → overdraft revert.
    let res = c.policy.try_call_disburse(&landlord, &100, &0);
    assert!(res.is_err(), "disburse spent reserved-for-claims cash");
    assert_eq!(c.token.balance(&landlord), 0);
    assert_eq!(reserved_for_claims(&c), 1_000);

    // The reserved cash is still fully claimable by the redeemer.
    c.vault.claim(&rid);
    assert_eq!(c.token.balance(&alice), 1_000);
    assert_eq!(reserved_for_claims(&c), 0);
}

// ───────────────────────────── AC-01 ─────────────────────────────

/// AC-01 (access-control, critical): `set_policy` names the only address allowed
/// to call `disburse` (money-OUT). The admin gate backing it must block a
/// non-admin from becoming "the policy"; with the policy unchanged, an attacker's
/// direct disburse must also revert. No underlying leaves the vault.
#[test]
fn adv_set_policy_admin_gate_blocks_nonadmin() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let attacker = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // Disable auth mocking so require_auth(admin) actually enforces the caller.
    c.e.set_auths(&[]);
    assert!(
        c.vault.try_set_policy(&attacker).is_err(),
        "non-admin hijacked set_policy"
    );

    // The registered policy is unchanged, so the attacker cannot disburse either.
    c.e.set_auths(&[]);
    assert!(
        c.vault.try_disburse(&attacker, &500, &0).is_err(),
        "non-policy attacker disbursed"
    );

    // Nothing left the vault.
    assert_eq!(c.token.balance(&attacker), 0);
    assert_eq!(c.vault.stable_assets(), 1_000);
}

// ───────────────────────────── RQ-02 ─────────────────────────────

/// RQ-02 (redemption-queue, high): `claim` must be one-shot. A second claim on
/// the same id must revert and `ReservedForClaims` must decrement exactly once,
/// else an investor drains other claimants' reserved pool (double-claim/underflow).
#[test]
fn adv_claim_one_shot_no_double_payout() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    c.policy.set_coverage(&0);
    let rid = c.vault.request_redeem(&alice, &1_000);
    c.vault.process_redemptions(&10);

    c.vault.claim(&rid);
    assert_eq!(c.token.balance(&alice), 1_000);
    assert_eq!(reserved_for_claims(&c), 0);

    // Second claim must revert; no second payout, reserved never goes negative.
    assert!(c.vault.try_claim(&rid).is_err(), "double-claim succeeded");
    assert_eq!(c.token.balance(&alice), 1_000);
    assert_eq!(reserved_for_claims(&c), 0);
}

/// RQ-02 (message variant): the second claim carries the distinct "already
/// claimed" panic.
#[test]
#[should_panic(expected = "already claimed")]
fn adv_claim_second_panics_already_claimed() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    c.policy.set_coverage(&0);
    let rid = c.vault.request_redeem(&alice, &1_000);
    c.vault.process_redemptions(&10);
    c.vault.claim(&rid);
    c.vault.claim(&rid); // panics "already claimed"
}

// ───────────────────────────── RQ-01 ─────────────────────────────

/// RQ-01 (redemption-queue, high): `cancel_redeem` on an already-fulfilled request
/// must revert and must NOT re-credit escrowed shares (burned at fulfill), else it
/// mints shares from nothing while the claim stays payable → double-claim.
#[test]
fn adv_cancel_redeem_after_fulfilled_reverts_no_remint() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    c.policy.set_coverage(&0);
    let rid = c.vault.request_redeem(&alice, &1_000);
    c.vault.process_redemptions(&10);
    assert!(c.vault.request(&rid).fulfilled);
    assert_eq!(reserved_for_claims(&c), 1_000);

    // Cancel on a fulfilled request must revert ("already fulfilled").
    assert!(
        c.vault.try_cancel_redeem(&rid).is_err(),
        "cancel on a fulfilled request succeeded (would re-mint shares)"
    );

    // No re-mint: alice's escrowed shares stay burned; claim path intact.
    assert_eq!(c.vault.balance(&alice), 0);
    assert_eq!(reserved_for_claims(&c), 1_000);
}

// ───────────────────────────── SM-01 ─────────────────────────────

/// SM-01 (strategy-manipulation, high): a stable strategy whose `balance()`
/// over-reports realizable value inflates `stable_pre` so the disburse witness
/// passes, but the actual divest realizes less than `amount`. The tx must revert
/// atomically with the typed `InsufficientLiquidity` (600) — disburse-side analog
/// of `process_redemptions_reverts_when_strategy_lies`.
#[test]
fn adv_disburse_reverts_when_stable_strategy_lies() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let s1 = add_mock(&c, 10_000); // stable (volatile=false)
    c.vault.rebalance();
    assert_eq!(s1.balance(), 1_000);
    assert_eq!(c.vault.available_held(), 0);

    // Reports 1_000 but divest realizes only ~500.
    s1.set_loss_bps(&5_000);

    // Witness passes off the inflated stable_pre (1_000), ensure_liquidity realizes
    // ~500 and the terminal guard traps with the typed code.
    let res = c.policy.try_call_disburse(&landlord, &1_000, &0);
    assert!(res.is_err(), "lying-strategy disburse must revert");
    match res {
        Err(Ok(e)) => assert_eq!(e, VaultError::InsufficientLiquidity.into()),
        other => panic!(
            "expected typed VaultError::InsufficientLiquidity, got {:?}",
            other
        ),
    }

    // Whole-tx rollback: nothing paid out, strategy balance intact.
    assert_eq!(c.token.balance(&landlord), 0);
    assert_eq!(s1.balance(), 1_000);
}

// ───────────────────────────── SM-04 ─────────────────────────────

/// SM-04 (strategy-manipulation, high): a `volatile=true` strategy over-reporting
/// `balance()` inflates `total_assets`/NAV but MUST be excluded from
/// `stable_assets_inner` and `free_capital`. No existing test adds a volatile
/// strategy, so this solvency-subset boundary is otherwise uncharacterized.
#[test]
fn adv_volatile_strategy_excluded_from_solvency() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    c.policy.set_coverage(&0);

    // Add a VOLATILE strategy (excluded from the solvency subset).
    let id = c.e.register(MockStrategy, (c.underlying.clone(),));
    MockStrategyClient::new(&c.e, &id).set_controller(&c.vault_id);
    c.vault.add_strategy(&id, &10_000, &true); // volatile = true
    let strat = MockStrategyClient::new(&c.e, &id);

    let stable0 = c.vault.stable_assets();
    let fc0 = c.vault.free_capital();
    let ta0 = c.vault.total_assets();
    let nav0 = c.vault.nav_per_share();

    // Over-report a huge volatile balance.
    strat.accrue(&1_000_000);

    // total_assets and NAV rise with the volatile accrual …
    assert_eq!(c.vault.total_assets(), ta0 + 1_000_000);
    assert!(c.vault.nav_per_share() > nav0);
    // … but the solvency subset is UNCHANGED.
    assert_eq!(c.vault.stable_assets(), stable0);
    assert_eq!(c.vault.free_capital(), fc0);

    // A disburse sized to the volatile-inflated total still reverts against the
    // stable-only witness (overdraft on stable_pre = stable0).
    assert!(
        c.policy
            .try_call_disburse(&landlord, &(stable0 + 1), &0)
            .is_err(),
        "volatile balance fabricated disburse headroom"
    );
}

// ───────────────────────────── REENT-05 ─────────────────────────────
//
// `claim` does `token.transfer(vault -> owner)` with NO Locked guard and
// decrements `ReservedForClaims` AFTER the transfer. A malicious underlying token
// whose transfer re-enters `claim(id)` could double-claim; protection relies
// SOLELY on the Soroban host frame-check (no contract may be re-entered while on
// the call stack). This builds a minimal in-crate token double whose `transfer`,
// when armed and `from == vault`, re-enters `claim` once before completing.

#[contracttype]
enum MtKey {
    Bal(Address),
    Armed,
    Vault,
    Rid,
}

/// Minimal SEP-41-shaped token double. Only the methods the vault actually invokes
/// on its underlying during the deposit→request→process→claim flow are
/// implemented (`balance`, `transfer`, plus a test `mint`/`arm`). NEVER deployed.
#[contract]
pub struct MaliciousToken;

#[contractimpl]
impl MaliciousToken {
    pub fn mint(e: &Env, to: Address, amount: i128) {
        let cur: i128 = e
            .storage()
            .persistent()
            .get(&MtKey::Bal(to.clone()))
            .unwrap_or(0);
        e.storage()
            .persistent()
            .set(&MtKey::Bal(to), &(cur + amount));
    }

    /// Arm the re-entrant callback: the next `transfer` whose `from` is the vault
    /// re-enters `vault.claim(rid)` exactly once.
    pub fn arm(e: &Env, vault: Address, rid: u32) {
        e.storage().instance().set(&MtKey::Vault, &vault);
        e.storage().instance().set(&MtKey::Rid, &rid);
        e.storage().instance().set(&MtKey::Armed, &true);
    }

    pub fn balance(e: &Env, id: Address) -> i128 {
        e.storage().persistent().get(&MtKey::Bal(id)).unwrap_or(0)
    }

    pub fn transfer(e: &Env, from: Address, to: Address, amount: i128) {
        // RE-ENTRANCY ATTEMPT: before moving funds, if armed and the vault is the
        // payer, call back into claim once. The host MUST reject re-entering the
        // vault instance that is already on the call stack.
        let armed: bool = e.storage().instance().get(&MtKey::Armed).unwrap_or(false);
        if armed {
            if let Some(vault) = e.storage().instance().get::<_, Address>(&MtKey::Vault) {
                if from == vault {
                    e.storage().instance().set(&MtKey::Armed, &false); // one-shot
                    let rid: u32 = e.storage().instance().get(&MtKey::Rid).unwrap();
                    VaultClient::new(e, &vault).claim(&rid);
                }
            }
        }
        let fb: i128 = e
            .storage()
            .persistent()
            .get(&MtKey::Bal(from.clone()))
            .unwrap_or(0);
        e.storage()
            .persistent()
            .set(&MtKey::Bal(from), &(fb - amount));
        let tb: i128 = e
            .storage()
            .persistent()
            .get(&MtKey::Bal(to.clone()))
            .unwrap_or(0);
        e.storage()
            .persistent()
            .set(&MtKey::Bal(to), &(tb + amount));
    }

    pub fn transfer_from(e: &Env, _spender: Address, from: Address, to: Address, amount: i128) {
        Self::transfer(e, from, to, amount);
    }
}

/// REENT-05 (reentrancy, high): a malicious-token `claim` re-entry must trap and
/// roll back fully; `claimed` flips at most once, `ReservedForClaims` decrements
/// by exactly `claimable` (never twice / negative), the owner receives at most
/// `claimable`. Documents reliance on the host frame-check (claim has no Locked).
#[test]
fn adv_malicious_token_claim_reentry_traps() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let underlying = e.register(MaliciousToken, ());
    let mtok = MaliciousTokenClient::new(&e, &underlying);

    let vault_id = e.register(
        Vault,
        (
            admin.clone(),
            underlying.clone(),
            String::from_str(&e, "Mutav Reserve"),
            String::from_str(&e, "mtvR"),
        ),
    );
    let vault = VaultClient::new(&e, &vault_id);
    let policy_id = e.register(MockPolicy, (vault_id.clone(),));
    vault.set_policy(&policy_id);
    let policy = MockPolicyClient::new(&e, &policy_id);

    let alice = Address::generate(&e);
    mtok.mint(&alice, &1_000);
    vault.deposit(&1_000, &alice, &alice, &alice);
    policy.set_coverage(&0);
    let rid = vault.request_redeem(&alice, &1_000);
    vault.process_redemptions(&10);

    let reserved_before = e.as_contract(&vault_id, || {
        e.storage()
            .instance()
            .get::<_, i128>(&DataKey::ReservedForClaims)
            .unwrap_or(0)
    });
    assert_eq!(reserved_before, 1_000);

    // Arm the malicious token and attempt the claim — the re-entry must trap.
    mtok.arm(&vault_id, &rid);
    let res = vault.try_claim(&rid);
    assert!(res.is_err(), "host failed to reject claim re-entry");

    // Whole-tx rollback: no payout, reserved intact, request still unclaimed.
    assert_eq!(mtok.balance(&alice), 0);
    let reserved_after = e.as_contract(&vault_id, || {
        e.storage()
            .instance()
            .get::<_, i128>(&DataKey::ReservedForClaims)
            .unwrap_or(0)
    });
    assert_eq!(reserved_after, 1_000);
    assert!(!vault.request(&rid).claimed);
}

// ───────────────────────────── REENT-01 ─────────────────────────────

/// REENT-01 (reentrancy, high): `process_redemptions` divests through an adapter
/// inside `ensure_liquidity`. A re-entrant divest (here: a strategy whose divest
/// calls `rebalance`) must trap and roll back the whole batch — queue and
/// `ReservedForClaims` untouched — and must NOT wedge the lock (a later clean
/// process succeeds). Existing ReentrantStrategy tests only hit `disburse`.
#[test]
fn adv_reentrant_process_redemptions_traps_rolls_back() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    c.policy.set_coverage(&0);

    // Wire a ReentrantStrategy (from the test module) and deploy all idle into it.
    let id =
        c.e.register(super::test::ReentrantStrategy, (c.underlying.clone(),));
    super::test::ReentrantStrategyClient::new(&c.e, &id).set_controller(&c.vault_id);
    c.vault.add_strategy(&id, &10_000, &false);
    let s = super::test::ReentrantStrategyClient::new(&c.e, &id);
    c.vault.rebalance();
    assert_eq!(s.balance(), 1_000);
    assert_eq!(c.vault.available_held(), 0);

    let rid = c.vault.request_redeem(&alice, &500);

    // Arm the re-entry: divest (reached via ensure_liquidity) re-enters rebalance.
    s.set_reenter_target(&c.vault_id);
    let supply_before = c.vault.total_supply();

    let res = c.vault.try_process_redemptions(&10);
    assert!(res.is_err(), "re-entrant process_redemptions must trap");

    // Whole batch rolled back: nothing fulfilled, queue intact, no escrow drift.
    assert!(!c.vault.request(&rid).fulfilled);
    assert_eq!(c.vault.pending_requests().len(), 1);
    assert_eq!(reserved_for_claims(&c), 0);
    assert_eq!(c.vault.total_supply(), supply_before); // shares NOT burned
    assert_eq!(c.token.balance(&c.vault_id), 0); // vault cash unchanged
    assert_eq!(s.balance(), 1_000); // strategy untouched

    // Lock is NOT wedged: fund the vault with fresh cash so the same request can be
    // satisfied without divesting the (still-armed) strategy, then process cleanly.
    c.token_admin.mint(&bob, &1_000);
    c.vault.deposit(&1_000, &bob, &bob, &bob);
    c.vault.process_redemptions(&10);
    assert!(
        c.vault.request(&rid).fulfilled,
        "lock wedged after rollback"
    );
}

// ───────────────────────────── AC-07 ─────────────────────────────

/// AC-07 (access-control, high): `add_strategy` / `remove_strategy` / `rebalance`
/// are all `require_auth(admin)`. A non-admin must not be able to introduce an
/// attacker strategy, force a griefing divest, or trigger a rebalance. The
/// strategy set and balances stay unchanged.
#[test]
fn adv_vault_strategy_setters_admin_gate() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    let s_existing = add_mock(&c, 10_000);
    c.vault.rebalance();
    assert_eq!(s_existing.balance(), 1_000);
    let evil = Address::generate(&c.e);

    // Disable auth mocking → require_auth(admin) enforces the caller.
    c.e.set_auths(&[]);
    assert!(c.vault.try_add_strategy(&evil, &10_000, &false).is_err());
    c.e.set_auths(&[]);
    assert!(c.vault.try_rebalance().is_err());
    c.e.set_auths(&[]);
    assert!(c.vault.try_remove_strategy(&s_existing.address).is_err());

    // Restore auth mocking and confirm nothing changed.
    c.e.mock_all_auths_allowing_non_root_auth();
    assert_eq!(c.vault.strategies().len(), 1);
    assert_eq!(
        c.vault.strategies().get(0).unwrap().address,
        s_existing.address
    );
    assert_eq!(s_existing.balance(), 1_000);
}

// ───────────────────────────── SI-01 ─────────────────────────────

/// SI-01 (share-inflation, high): with `VIRTUAL_OFFSET=1` an attacker who seeds 1
/// share then donates must not extract a net profit. Net P/L of holding his shares
/// must be <= 0 (his donation always exceeds reclaimable value).
#[test]
fn adv_inflation_donation_attacker_net_loss() {
    let c = setup();
    let attacker = Address::generate(&c.e);
    let victim = Address::generate(&c.e);
    c.policy.set_coverage(&0);

    // Attacker seeds 1 share.
    c.token_admin.mint(&attacker, &1);
    c.vault.deposit(&1, &attacker, &attacker, &attacker);

    // Direct donation to inflate NAV.
    let donation = 10_000i128;
    c.token_admin.mint(&c.vault_id, &donation);

    // Victim deposits.
    let victim_dep = 10_000i128;
    c.token_admin.mint(&victim, &victim_dep);
    c.vault.deposit(&victim_dep, &victim, &victim, &victim);

    // Attacker's reclaimable value vs. total spent (deposit + donation).
    let attacker_shares = c.vault.balance(&attacker);
    let reclaim = c.vault.convert_to_assets(&attacker_shares);
    let spent = 1 + donation;
    assert!(
        reclaim <= spent,
        "donation attack profitable: reclaim {} > spent {}",
        reclaim,
        spent
    );
}

// ───────────────────────────── SI-02 ─────────────────────────────

/// SI-02 (share-inflation, high): the victim's realized loss under an extreme
/// donation ratio must be bounded by at most ONE share's worth of NAV at deposit
/// time (the rounding remainder), NOT an arbitrary fraction of principal. NOTE:
/// under an extreme donation, one-share-of-NAV is itself LARGE in absolute units,
/// so while the per-share bound holds, the loss is not "a few units" — documenting
/// the limit of `VIRTUAL_OFFSET=1` (argues for `decimals_offset > 0`).
#[test]
fn adv_inflation_victim_loss_bounded_one_share() {
    let c = setup();
    let attacker = Address::generate(&c.e);
    let victim = Address::generate(&c.e);
    c.policy.set_coverage(&0);

    c.token_admin.mint(&attacker, &1);
    c.vault.deposit(&1, &attacker, &attacker, &attacker);

    let donation = 1_000_000i128;
    c.token_admin.mint(&c.vault_id, &donation);

    // Deposit-time price per share (assets), with the virtual offset:
    //   (total_assets + 1) / (total_supply + 1)
    let one_share_value = (c.vault.total_assets() + 1) / (c.vault.total_supply() + 1);

    let victim_dep = 600_000i128; // large enough that shares_v >= 1
    c.token_admin.mint(&victim, &victim_dep);
    c.vault.deposit(&victim_dep, &victim, &victim, &victim);

    let victim_shares = c.vault.balance(&victim);
    assert!(victim_shares >= 1, "victim zeroed out of shares");
    let victim_value = c.vault.convert_to_assets(&victim_shares);
    let victim_loss = victim_dep - victim_value;

    assert!(
        victim_loss <= one_share_value,
        "victim loss {} exceeds the one-share bound {}",
        victim_loss,
        one_share_value
    );
}

// ───────────────────────────── SI-05 ─────────────────────────────

/// SI-05 (share-inflation, medium): a queued redeem is priced at PROCESS time off
/// live `total_assets`, not at request time. A direct donation between request and
/// process inflates the claimable, but must not corrupt the escrow ledger.
#[test]
fn adv_process_time_nav_donation_escrow_ledger_exact() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    c.policy.set_coverage(&0);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&bob, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);
    c.vault.deposit(&1_000, &bob, &bob, &bob);

    let rid = c.vault.request_redeem(&alice, &1_000);
    let claim_at_request = c.vault.preview_redeem(&1_000);

    // Donate between request and process — inflates the process-time price.
    c.token_admin.mint(&c.vault_id, &1_000);
    c.vault.process_redemptions(&10);
    let claim_at_process = c.vault.request(&rid).claimable;

    assert!(
        claim_at_process > claim_at_request,
        "process-time NAV did not capture the donation: {} !> {}",
        claim_at_process,
        claim_at_request
    );

    c.vault.claim(&rid);
    // Escrow ledger is exact: nothing reserved, no negative available_held.
    assert_eq!(reserved_for_claims(&c), 0);
    assert!(c.vault.available_held() >= 0);
}

// ───────────────────────────── SI-03 ─────────────────────────────

/// SI-03 (share-inflation, medium): at an inflated NAV a dust deposit whose assets
/// floor to 0 shares must REVERT ("zero shares minted") and must NOT pull the
/// depositor's dust into NAV.
#[test]
fn adv_dust_deposit_zero_shares_reverts_no_pull() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    c.policy.set_coverage(&0);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    // Push NAV far above 1 so a 1-unit deposit previews to 0 shares.
    c.token_admin.mint(&c.vault_id, &10_000_000);
    assert_eq!(c.vault.preview_deposit(&1), 0);

    c.token_admin.mint(&bob, &5);
    assert!(
        c.vault.try_deposit(&1, &bob, &bob, &bob).is_err(),
        "dust deposit silently absorbed without minting"
    );
    // Dust not pulled.
    assert_eq!(c.token.balance(&bob), 5);
}

// ───────────────────────────── SI-04 ─────────────────────────────

/// SI-04 (share-inflation, medium): the convert round-trip must always favor the
/// vault at non-unit NAV across magnitudes —
/// `convert_to_assets(convert_to_shares(x)) <= x` and the dual — so no input
/// grinds a net gain from rounding.
#[test]
fn adv_convert_roundtrip_favors_vault_nonunit_nav() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.policy.set_coverage(&0);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    let xs: [i128; 8] = [1, 2, 3, 7, 99, 500, 1_000, 999_999];

    // Two different non-integer NAVs via cumulative donations.
    for donation in [333i128, 777i128] {
        c.token_admin.mint(&c.vault_id, &donation);
        for x in xs.iter() {
            let shares = c.vault.convert_to_shares(x);
            assert!(
                c.vault.convert_to_assets(&shares) <= *x,
                "assets round-trip minted value: x={} donation={}",
                x,
                donation
            );
            let assets = c.vault.convert_to_assets(x);
            assert!(
                c.vault.convert_to_shares(&assets) <= *x,
                "shares round-trip minted value: x={} donation={}",
                x,
                donation
            );
        }
    }
}

// ───────────────────────────── RQ-04 ─────────────────────────────

/// RQ-04 (redemption-queue, medium): the surplus gate is NOT head-of-line
/// blocking. An oldest request exceeding `free_capital` is pushed back and the
/// loop continues, so a younger smaller request is fulfilled ahead of it — a
/// fairness deviation from strict FIFO (documented, not a hard failure).
#[test]
fn adv_process_redemptions_non_fifo_surplus_skip() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    c.policy.set_coverage(&700); // free_capital = 300
    let r0 = c.vault.request_redeem(&alice, &800); // claimable ~800 > 300 → gated
    let r1 = c.vault.request_redeem(&alice, &200); // claimable ~200 <= 300 → fits
    c.vault.process_redemptions(&10);

    assert!(
        !c.vault.request(&r0).fulfilled,
        "older gated request was fulfilled"
    );
    assert!(
        c.vault.request(&r1).fulfilled,
        "younger request did not jump ahead"
    );
}

// ───────────────────────────── RQ-05 ─────────────────────────────

/// RQ-05 (redemption-queue, medium): `max_batch` counts ATTEMPTS, not
/// fulfillments — `processed += 1` runs before the free_capital gate, so a leading
/// gated request consumes a batch slot and starves a later fulfillable one despite
/// ample free capital.
#[test]
fn adv_process_redemptions_batch_budget_starvation() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&1_000, &alice, &alice, &alice);

    c.policy.set_coverage(&800); // free_capital = 200
    let r0 = c.vault.request_redeem(&alice, &500); // claimable 500 > 200 → gated
    let r1 = c.vault.request_redeem(&alice, &100); // claimable 100 <= 200 → would fit
    c.vault.process_redemptions(&1); // budget of one

    assert!(!c.vault.request(&r0).fulfilled);
    assert!(
        !c.vault.request(&r1).fulfilled,
        "gated leading request did not consume the batch slot"
    );
    assert_eq!(c.vault.pending_requests().len(), 2);
}
