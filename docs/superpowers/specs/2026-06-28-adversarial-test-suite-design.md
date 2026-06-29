# Adversarial Test Suite & Hardening Loop — Design

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Scope:** `mutav-pulse` Soroban contracts (`contracts/`). Throwaway hackathon testbed for the mutav SGR reserve/fund — NOT the audited `mutav-stellar` Fund.
**Mode:** Tests-only. No contract logic (`lib.rs`/`types.rs`) edits. Failing tests are kept as documented findings.

## Problem

The protocol has **135 passing tests** with solid happy-path coverage and *some* adversarial cases (share-inflation, strategy re-entrancy). But the money-path invariants lack adversarial depth, there is **no property/fuzz framework** (one hand-rolled LCG in `registry`), and several invariants are explicitly untested:

- **Witness-trust**: `vault.disburse` blindly trusts the policy's reported `coverage_after` (`vault/src/lib.rs:683-687`). A buggy/malicious policy under-reporting it still passes the solvency assert.
- **DeFindex adverse-pool slippage**: real-vault fee/rounding on `divest` is uncharacterized (`adapter-defindex/src/lib.rs:216-221`).
- **Redemption-queue escrow accounting** under abuse (double-claim, `ReservedForClaims` drift, NAV manipulation between `request_redeem` and `process_redemptions`).
- **NAV donation / rounding-direction** edges around `VIRTUAL_OFFSET = 1`.

The gap is **adversarial depth on money-path invariants**, not raw coverage.

## Goal

Produce, this round:
1. **~25–35 adversarial Rust tests** across 9 attack categories and the 4 production crates (`vault`, `policy`, `registry`, `adapter-defindex`).
2. A **`proptest` invariant harness** — randomized operation sequences asserting core invariants never break.
3. A **findings report** mapping scenario → test → outcome → severity → `file:line`.
4. A **repeatable methodology** (the create → test → refine → improve loop) so this can be re-run.

Non-goal: contract logic fixes. Failing tests that expose bugs are deliverables; remediation is a separate, human-gated follow-up via the existing `audit-remediation` skill.

## Attack categories (9)

| # | Category | Primary targets | Representative hypotheses |
|---|----------|-----------------|---------------------------|
| 1 | Share-inflation / donation / first-depositor | vault | Is `VIRTUAL_OFFSET=1` enough? Direct token transfer inflating `total_assets`/`nav_per_share`. Rounding-direction in `convert_to_shares/assets`. |
| 2 | Solvency / coverage breach | policy, vault | `sign_guarantee`→`disburse` race; **witness-trust under a buggy/malicious policy under-reporting `coverage_after`**; BPS rounding to under-collateralize. |
| 3 | Redemption-queue abuse | vault | FIFO/escrow drift; double-`claim`; `ReservedForClaims` under/overflow; NAV manipulation between `request_redeem` and `process_redemptions`; `cancel_redeem` after process. |
| 4 | Re-entrancy (beyond existing) | vault | Cross-function via the global `Locked` lock; re-entry during `ensure_liquidity` in `disburse`; during `process_redemptions` divest. |
| 5 | Strategy / allocator manipulation | vault, adapter | Lossy/lying strategy `balance()` inflating NAV; `strategy_max_debt_bps` bypass; slippage drain via `rebalance`; controller spoofing. |
| 6 | Premium / fee gaming | policy, vault | Deposit-just-before-`collect_fee` to capture accrued NAV; grace-window / lapse cycling; fee-bound edges. |
| 7 | Access-control / admin / upgrade | all | Setter hijack (`set_policy`/`set_vault`/`set_registry`); registry writer-gating bypass / id-fabrication; malicious-wasm `upgrade`; schema-version guard. |
| 8 | NAV sandwiching | vault | Deposit/redeem sandwiched around `collect_fee` or `cover_default`. |
| 9 | Economic / parameter cross-check | policy + `model/` | Default-rate stress and coverage-ratio edges, cross-checked against `model/mutav_model.py` selftest assertions. |

## Architecture — the dynamic Workflow

Five phases. Default-pipeline where possible; barriers only where a phase genuinely needs all prior results.

**Phase 1 — Catalog (fan-out, schema-validated).** One researcher agent per category (9). Each deep-researches against the references the protocol was built on (ERC-4626/7540, Yearn v3, Centrifuge, Nexus Mutual, DeFindex, Soroban security) and the actual code, emitting a list of concrete scenarios. Each scenario: `{id, category, target_crate, target_method, hypothesis, preconditions, attack_steps, expected_invariant, severity, already_covered_guess}`.

**Phase 2 — Triage (barrier).** Collect all scenarios; dedup; drop those already covered by the 135 existing tests (map by crate+method+hypothesis); prioritize by severity × money-path proximity; select the round budget (~25–35). This barrier is justified — selection needs the full set at once.

**Phase 3 — Author (fan-out, one agent per crate).** Group selected scenarios by `target_crate`. One author agent per crate writes a new `contracts/<crate>/src/test_adversarial.rs` containing all that crate's scenarios in the existing test style (`Env::default()`, `mock_all_auths_allowing_non_root_auth()`, `setup() -> Ctx` factories reused from `test.rs`, `#[should_panic(expected=...)]` for negatives), wires `#[cfg(test)] mod test_adversarial;` in `lib.rs`, and iterates `cargo test -p <crate>` until it **compiles**. *Grouping by crate gives one owner per file — no parallel edit-conflicts, no worktrees needed.* The proptest harness is authored here too (Phase 3b, on the vault crate): add `proptest` as a `[dev-dependencies]`, write `test_invariants.rs` with randomized deposit/redeem/disburse/rebalance sequences asserting `stable_assets >= coverage_required` and escrow conservation never break.

**Phase 4 — Classify & verify (pipeline).** For each authored test, capture outcome: ✅ passes (invariant holds) or 🔴 fails/panics-unexpectedly (candidate bug). Adversarially verify each 🔴 with skeptic agents (is it a real protocol bug or a bad test / wrong assumption?). Majority-refute → reclassify as test defect; survives → confirmed finding.

**Phase 5 — Synthesize.** Write `docs/security/adversarial-test-report.md` (scenario→test→outcome→severity→file:line, coverage delta, refinement punch-list) and the methodology section into this spec's companion. Run the full `cargo test` workspace gate; record pass/fail counts honestly.

## Constraints & gates

- **Build/test gate:** `cargo test -p <crate>` per crate during authoring; full-workspace `cargo test` at the end. `stellar contract build` is **not** required (tests-only; no wasm shipped). Per CLAUDE.md, never raw `cargo build --release` for wasm — irrelevant here.
- **Tests-only invariant:** no edits to any `lib.rs`/`types.rs` *contract logic*. The only non-test edits permitted: adding `#[cfg(test)] mod test_adversarial;` / `mod test_invariants;` lines and a `[dev-dependencies] proptest` entry in `Cargo.toml`. Dev-dependencies don't change deployed wasm.
- **no_std caveat:** Soroban crates are `#![no_std]`; the `proptest` harness must live behind `#[cfg(test)]` with `extern crate std` so std is available only in the test build. Author agents must verify the harness compiles before claiming done.
- **Honesty:** failing tests are kept, not deleted or weakened to pass. A 🔴 that is a real bug is the point of the exercise.

## Components & isolation

- **Scenario catalog** (Phase 1 output) — pure data, schema-validated, independently reviewable.
- **Per-crate `test_adversarial.rs`** — each owned by one author, reuses that crate's existing `setup()`; understandable without reading other crates.
- **`vault/src/test_invariants.rs`** — the proptest harness; self-contained, one purpose (sequence-level invariant fuzzing).
- **`docs/security/adversarial-test-report.md`** — the findings ledger; the human-facing deliverable.
- **Methodology** — the repeatable loop, documented for re-runs.

## The create → test → refine → improve loop (methodology)

1. **Create** — fan out category researchers → scenario catalog (Phase 1).
2. **Test** — triage + author tests + run them (Phases 2–3).
3. **Refine** — classify outcomes, adversarially verify findings, weed test defects (Phase 4).
4. **Improve** — report + punch-list; real bugs handed to `audit-remediation` (human-gated, separate run because it edits contract logic); proptest harness stays as a permanent regression net; optionally add CI to run `cargo test` + model selftest on every push (currently absent — biggest infra gap).

Re-running the loop later picks up where the catalog left off (scenarios not yet implemented) or starts a fresh category sweep.

## Risks

- **proptest + no_std friction** — mitigated by `#[cfg(test)]` isolation and a compile gate before completion.
- **False findings** — mitigated by Phase 4 adversarial verification (skeptic majority).
- **Parallel file conflicts** — eliminated by one-author-per-crate grouping.
- **Token cost** — bounded by the ~25–35 round budget set in Phase 2.
