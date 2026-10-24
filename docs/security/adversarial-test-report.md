# Adversarial-Test Hardening Round — Findings Report

**Protocol:** mutav-pulse (Soroban — `vault` / `policy` / `registry` / `adapter-defindex`)
**Round date:** 2026-06-28
**Scope:** Tests-only hardening. No contract logic was changed. Edits are limited to new
`#[cfg(test)] mod …` declarations, one `proptest` dev-dependency in `vault`, and the new
test source files themselves.

---

## (a) Summary

| Metric | Value |
| --- | --- |
| Scenarios cataloged | 62 |
| Scenarios selected (budget 25–35) | 31 |
| Scenarios dropped / deferred | 32 |
| Adversarial tests authored | 32 |
| Tests passing | 32 / 32 |
| Confirmed findings (logic bugs proven by a red test) | **0** |
| Documented economic/spec findings (green tests that pin real risky behavior) | 6 |
| — by severity | 1 high (FG-3), 2 medium (FG-2, FG-4), 3 documented residual/tradeoff (SB-01, SI-02, RQ-04/RQ-05) |
| Test defects / reclassifications | 1 (ECON-05 scenario arithmetic corrected — test-code only) |

**Full-workspace `cargo test` result: GREEN — 0 failed.** Per-binary summary lines:

```
vault             71 passed / 0 failed   (52 pre-existing + 19 new)
policy            41 passed / 0 failed   (31 pre-existing + 10 new)
registry          25 passed / 0 failed   (23 pre-existing + 2 new)
adapter-defindex  19 passed / 0 failed   (18 pre-existing + 1 new)
interfaces         3 passed / 0 failed
mock-defindex      1 passed / 0 failed
mock-strategy      3 passed / 0 failed
mock-tesouro       5 passed / 0 failed
(faucet / defindex-hodl / mock-policy / strategy: 0 unit tests; all doc-tests 0)
```

> **Note on counts.** The structured intake JSON lists `selectedCount: 30`; the catalog
> triage prose and the per-crate test inventory both enumerate **31 distinct scenarios**
> (19 vault + 10 policy + 2 registry + 1 adapter, less the one panic-message *variant*
> `adv_claim_second_panics_already_claimed` which shares scenario id RQ-02), realized as
> **32 authored `#[test]` functions**. All 32 compile and pass. The workspace run is the
> source of truth and it is fully green.

**Honesty statement (step 3).** The workspace is **not** red. Every adversarial test was
authored to *assert the observed behavior* — including the risky behaviors — so they go
green by design. No test is failing, and none was left red to "expose" a bug. Where a test
documents a genuine economic weakness (the 6 findings below), the weakness lives in
*contract logic*, and fixing it is out of scope for this tests-only round (see HUMAN-GATED
note). There is nothing being hidden behind a green bar: the 6 findings are called out
explicitly with reasoning and file:line so a human can act on them.

---

## (b) Confirmed findings

No finding in this round is a *red-test* logic bug. The six entries below are **behaviors
proven reachable by a passing adversarial test** that violate an *ideal* invariant or an
external-standard expectation (ERC-4626/ERC-7540), even though the contract does not panic
or corrupt escrow. They are ordered by severity.

| # | Sev | Crate | Test | Invariant / expectation violated | Reasoning | File:line |
| --- | --- | --- | --- | --- | --- | --- |
| FG-3 | **High** | policy | `adv_pay_fee_cannot_block_accrued_cover_default` | An accrued default must remain claimable by the landlord; fee payment ≠ rent cure | At `PERIOD+GRACE+1` the default is accrued, but a tenant `pay_fee` (~100) pushes `paid_until` forward and `cover_default` then errs `not in default`, defeating the ~1000 landlord payout for the price of one fee. Fee-payment is conflated with rent cure. | `policy/src/test_adversarial.rs` (FG-3); logic in `policy/src/lib.rs` `pay_fee` / `cover_default` |
| FG-4 | **Medium** | policy | `adv_sign_guarantee_zero_floored_fee_free_coverage` | A signed guarantee must have a payable (non-zero) fee stream | `sign_guarantee` checks `fee_bps > 0` but `fee_of` floors to 0 for small terms (monthly 100, fee_bps 50 → fee 0). Guarantee is signed with full coverage reserved; `pay_fee` then permanently errs `zero fee` (tenant can never pay) yet `cover_default` still pays out — free coverage. | `policy/src/test_adversarial.rs` (FG-4); `policy/src/lib.rs` `sign_guarantee` / `fee_of` |
| FG-2 | **Medium** | policy | `adv_pay_fee_lapse_back_fee_leak` | A lapsed tenant must pay for all reserved-coverage periods (no free socialized periods) | After skipping 10 periods, a single `pay_fee` collapses the base to `now`, charging only one period (100, not 1000) to become current — no back-charge for 10 periods of reserved coverage. | `policy/src/test_adversarial.rs` (FG-2); `policy/src/lib.rs` `pay_fee` |
| SB-01 | Documented residual | vault | `adv_disburse_blind_trusts_underreported_coverage_after` | Ideal: `stable_assets >= coverage_required` post-disburse | Policy sets true coverage=1000 but forwards `coverage_after=0`; the vault witness passes and disburses 500, leaving `stable_assets=500 < coverage_required=1000`. **Accepted spec tradeoff** — the vault cannot recompute the floor during a default due to Soroban re-entrancy; it must trust the policy's `coverage_after`. | `vault/src/test_adversarial.rs` (SB-01); `vault/src/lib.rs` `disburse` witness |
| SI-02 | Documented tradeoff | vault | `adv_inflation_victim_loss_bounded_one_share` | Inflation-attack victim loss should be "a few units" | `VIRTUAL_OFFSET=1` bounds victim loss to ≤ one share's NAV, but under an extreme donation that bound is large in absolute terms (~66k loss / ~11% on a 600k deposit). Per-share bound *holds*; magnitude argues for `decimals_offset > 0`. | `vault/src/test_adversarial.rs` (SI-02); `vault/src/lib.rs` virtual-offset config |
| RQ-04 / RQ-05 | Documented deviation | vault | `adv_process_redemptions_non_fifo_surplus_skip`, `adv_process_redemptions_batch_budget_starvation` | ERC-7540 strict FIFO redemption ordering / batch fairness | RQ-04: a younger request jumps ahead of an older gated one (non-FIFO surplus skip). RQ-05: a gated request consumes the batch slot (`processed += 1` before the gate), starving a later request that would have fit. Both are real ordering deviations, not panics. | `vault/src/test_adversarial.rs` (RQ-04, RQ-05); `vault/src/lib.rs` `process_redemptions` |

**Remediation hints (all HUMAN-GATED).** Every fix below changes *contract logic* and is
therefore **out of scope for this tests-only round**. Route them through the
**`audit-remediation` skill** for human sign-off (several touch trait/API or storage-layout
surfaces and need redeploy + re-wire via `bootstrap.sh`):

- **FG-3 (high):** separate "fee paid" from "rent cured" — `cover_default` eligibility must
  key off rent-arrears state, not `paid_until` advanced by a fee payment. Consider a distinct
  cure entrypoint and a default-latch that a fee cannot silently clear.
- **FG-4 (medium):** require `fee_of(g) > 0` at `sign_guarantee` (not merely `fee_bps > 0`),
  so a guarantee whose per-period fee floors to 0 cannot be signed.
- **FG-2 (medium):** on `pay_fee` after a lapse, back-charge the missed periods (accrue
  `paid_until` forward by whole periods owed) instead of collapsing the base to `now`.
- **SB-01 (residual):** documented accepted tradeoff; if ever closed, requires a re-entrancy-safe
  way for the vault to bound the post-disburse floor (design change, not a quick patch).
- **SI-02 (tradeoff):** raise `decimals_offset` (virtual-offset exponent) so absolute victim
  loss shrinks; storage/spec-level change.
- **RQ-04/RQ-05:** decide intended ERC-7540 ordering semantics; if strict FIFO is desired,
  stop younger-request skipping and count *fulfillments* not *attempts* against the batch budget.

---

## (c) Scenario → test → outcome matrix

Legend: ✅ pass = invariant holds / attack repelled · 🔴 fail = candidate finding (none this
round) · ⚠️ reclassified test defect. Documented-finding tests are ✅ (the test asserts the
real behavior) and flagged **[FINDING]**.

### vault (19 new tests)

| Scenario | Test | Outcome |
| --- | --- | --- |
| SB-01 | `adv_disburse_blind_trusts_underreported_coverage_after` | ✅ **[FINDING — residual]** blind-trust gap reachable |
| RQ-03 | `adv_disburse_cannot_spend_reserved_for_claims` | ✅ reserved-for-claims unspendable |
| AC-01 | `adv_set_policy_admin_gate_blocks_nonadmin` | ✅ admin gate holds |
| RQ-02 | `adv_claim_one_shot_no_double_payout` (+ `adv_claim_second_panics_already_claimed`) | ✅ one-shot claim, no double payout |
| RQ-01 | `adv_cancel_redeem_after_fulfilled_reverts_no_remint` | ✅ no re-mint of burned escrow |
| SM-01 | `adv_disburse_reverts_when_stable_strategy_lies` | ✅ typed `InsufficientLiquidity`, full rollback |
| SM-04 | `adv_volatile_strategy_excluded_from_solvency` | ✅ volatile assets excluded from witness |
| REENT-05 | `adv_malicious_token_claim_reentry_traps` | ✅ host frame-check rejects re-entry, rolls back |
| REENT-01 | `adv_reentrant_process_redemptions_traps_rolls_back` | ✅ Locked guard + frame-check, lock not wedged |
| AC-07 | `adv_vault_strategy_setters_admin_gate` | ✅ strategy setters admin-gated |
| SI-01 | `adv_inflation_donation_attacker_net_loss` | ✅ donation attack net loss-making |
| SI-02 | `adv_inflation_victim_loss_bounded_one_share` | ✅ **[FINDING — tradeoff]** bound holds, magnitude large |
| SI-05 | `adv_process_time_nav_donation_escrow_ledger_exact` | ✅ donation cannot corrupt escrow ledger |
| SI-03 | `adv_dust_deposit_zero_shares_reverts_no_pull` | ✅ dust deposit reverts, not pulled |
| SI-04 | `adv_convert_roundtrip_favors_vault_nonunit_nav` | ✅ rounding favors vault, no grind |
| RQ-04 | `adv_process_redemptions_non_fifo_surplus_skip` | ✅ **[FINDING — deviation]** non-FIFO skip confirmed |
| RQ-05 | `adv_process_redemptions_batch_budget_starvation` | ✅ **[FINDING — deviation]** batch starvation confirmed |
| INV-proptest | `inv_proptest_money_paths_preserve_invariants` | ✅ 48 cases, per-step (a)/(b)/(c) invariants hold |
| INV-lcg | `inv_lcg_money_paths_preserve_invariants` | ✅ 240-step deterministic complement |

### policy (10 new tests)

| Scenario | Test | Outcome |
| --- | --- | --- |
| AC-02 | `adv_policy_set_registry_vault_admin_gate` | ✅ wiring immutable to non-admin; coverage cannot be spoofed |
| SB-05 | `adv_cover_default_ratio_below_one_stuck_midterm` | ✅ c<1 actuarial tradeoff confirmed, full rollback |
| FG-3 | `adv_pay_fee_cannot_block_accrued_cover_default` | ✅ **[FINDING — high]** fee blocks accrued cover_default |
| ECON-03 | `adv_default_count_breaks_solvency_at_ratio` | ✅ buffer-exact breach boundary characterized |
| AC-04 | `adv_policy_entrypoints_admin_gate` | ✅ all four entrypoints admin-gated pre-state-change |
| SB-04 | `adv_default_leg_exhaust_keeps_exit_reservation` | ✅ no premature exit-leg release |
| ECON-02 | `adv_sign_guarantee_capacity_packing_boundary` | ✅ capacity packing boundary exact, rollback |
| ECON-05 | `adv_over_collateralization_margin_grows` | ⚠️ scenario arithmetic corrected (12k/18k → 13.5k); invariant `margin += R*(c-1)` fully exercised, passes |
| FG-2 | `adv_pay_fee_lapse_back_fee_leak` | ✅ **[FINDING — medium]** lapse back-fee leak |
| FG-4 | `adv_sign_guarantee_zero_floored_fee_free_coverage` | ✅ **[FINDING — medium]** zero-floored fee → free coverage |

### registry (2 new tests)

| Scenario | Test | Outcome |
| --- | --- | --- |
| AC-03 | `adv_registry_put_next_id_require_writer` | ✅ writer gate repels non-writer (no row fabrication, floor unmoved) |
| AC-05 | `adv_upgrade_admin_gate_blocks_nonadmin` | ✅ `require_auth(admin)` runs before version check; wasm install blocked |

### adapter-defindex (1 new test)

| Scenario | Test | Outcome |
| --- | --- | --- |
| SM-03 | `adv_rebalance_divest_adverse_pool_slippage_traps` | ✅ slippage floor trips → all-or-nothing divest, full rebalance revert, position intact |

---

## (d) Coverage delta

| Crate | Pre-existing unit tests | New adversarial tests | Total | Notes |
| --- | --- | --- | --- | --- |
| vault | 52 | **19** | 71 | Two new files: `test_adversarial.rs` (17 scenarios + 1 panic-message variant) and `test_invariants.rs` (proptest + LCG harness). Added `proptest = "1"` under `[dev-dependencies]`; `mod test_adversarial;` + `mod test_invariants;` in `lib.rs`. |
| policy | 31 | **10** | 41 | `test_adversarial.rs`; `setup/Ctx/fund` factory replicated (private in `test.rs`). No new dev-deps. |
| registry | 23 | **2** | 25 | `test_adversarial.rs`; uses `set_auths(&[])` to switch to enforcing-auth mode. No new dev-deps. |
| adapter-defindex | 18 | **1** | 19 | `test_adversarial.rs`; reuses existing vault/mock-policy/mock-defindex dev-deps. |
| **Total** | **124** | **32** | **156** | +25.8% unit-test surface across the four audited crates. |

**Proptest harness added to vault.** `inv_proptest_money_paths_preserve_invariants` runs
48 cases over op-vectors of length 1..50 (deposit / request_redeem / process / disburse /
rebalance / collect_fee / claim). proptest resolves under the `#![no_std]` soroban test crate
once the module does `extern crate std;` — genuinely probed (compiled + ran). After **every
step** it asserts: (a) `stable_assets >= coverage_required`; (b) `ReservedForClaims == Σ
claimable(fulfilled & !claimed)` AND vault-held shares `== Σ shares(!fulfilled & !claimed)`
AND `reserved >= 0`; (c) NAV non-decreasing across `collect_fee`. A deterministic LCG sweep
(seed `0x2545F4914F6CDD1D`, 240 steps) shares the same step engine and assertions as a
fast, seed-stable complement. Both the `disburse` ops use the **honest** policy path (the
dishonest blind-trust drain is isolated to SB-01). Re-run 3× with fresh proptest seeds —
stable.

---

## (e) Refinement punch-list

**Dropped / deferred scenarios (still untested, candidates for the next round).** Triage
selected 31 of 62 within the 25–35 budget, biasing to vault custody + policy solvency
money-paths and the explicitly-untested invariants. The following were dropped or folded:

- **Already-covered (2 dropped):** SM-07 (controller spoofing); ECON-07 (≡ existing
  `solvency_witness_blocks_overdraw` breach leg).
- **Reentrancy family folded into REENT-01 + REENT-05:** REENT-02/03/04/06/07 still untested.
- **NAV/JIT sandwich family folded into FG-2/FG-4/FG-3 + SI-05:** the `nav-sandwich-01/04/05/06/07`
  defensive "should-hold" confirmations of known ERC-4626/7540 socialization gaps remain
  untested (lower value, but unconfirmed).
- **Rounding boundaries trimmed to SI-04:** SB-03 and the remaining SI rounding-boundary
  probes deferred.
- **Economic model pins dropped:** ECON-01/04/06 (model-number pins, c=1.0 zero-breach happy
  path) — confirmatory, untested.
- **Access-control surfaces dropped to fit budget:** AC-06 (`set_admin`) and AC-08
  (param-setter auth) — not yet covered.
- **Cross-crate upgrade gate:** AC-05 covers the *registry* upgrade gate only; the analogous
  `upgrade(wasm_hash)` admin gates on **vault / policy / adapter-defindex** are untested from
  their own crates (separate test crates, not importable from registry).
- **adapter real-vault slippage:** SM-03 characterizes the *mock* pool; real-vault adverse-pool
  slippage remains UNCHARACTERIZED per `adapter-defindex/src/lib.rs:216-221`.

**CI recommendation (no CI exists).** The repo has **no CI workflow**. Add one before the next
hardening round so the green bar is enforced on every push, not just locally:

1. `cargo test` (whole workspace) — the gate this round ran by hand.
2. `cargo fmt --check` — would have caught the unformatted new test files (fixed this round
   by `rustfmt`-ing the five new files only; note the pre-existing `adapter-defindex/src/lib.rs`
   also reports fmt drift but was **not** touched — it is contract logic, out of scope).
3. A **model selftest** step (run `model/mutav_model.py` invariants) so the economic
   assumptions behind FG-2/FG-3/FG-4 and the ECON-* boundaries are validated alongside the
   contract tests.
4. Consider `stellar contract build` in CI to catch spec-shaking breakage (`cargo build` is
   insufficient per soroban-sdk 26.1).

---

## (f) Methodology — the create → test → refine → improve loop

Each scenario followed a repeatable adversarial loop. **Create:** translate a catalog
hypothesis into a concrete, minimal test that drives the real contract through the
money-path (reusing existing factories/mocks, adding in-crate doubles like `MaliciousToken`
only where re-entry must be forced). **Test:** run it and observe what the contract *actually*
does — pass means the invariant holds or the attack is repelled; an unexpected result is a
candidate finding. **Refine:** when the observed behavior diverges from the hypothesis,
correct the *test* (not the contract) so it asserts ground truth — e.g. ECON-05's scenario
arithmetic was fixed to the contract's real coverage math, and SB-01/SI-02/RQ-04/RQ-05 were
re-framed from "should never happen" into documenting-passes that pin the real risky behavior
with explicit reasoning. **Improve:** fold the validated assertion into the permanent suite
(plus a proptest/LCG invariant harness for the broad money-path), so the round leaves behind
durable regression coverage and a precise, human-actionable finding list — with every
*logic* fix deferred to the HUMAN-GATED `audit-remediation` skill.
