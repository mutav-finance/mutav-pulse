# Testing and audits

Test coverage, audit status, and SEP-0056 conformance decisions for the mutav-pulse reserve vault.

## Test coverage

Contracts: `cargo test --workspace` → **135 tests, 0 failed**. Frontend: `bunx vitest run` → **28 tests, 0 failed**. Totals verified 2026-06-28.

### Contracts (Rust / Soroban)

| Suite | Count | Exercises |
|---|---|---|
| `vault` | 51 | custody, NAV/`total_assets` anchor, virtual-offset anti-inflation, fees-mint-no-shares, full SEP-0056 surface (convert/preview/max, disabled `withdraw`/`redeem`), surplus-gated redemption queue, strategy allocator |
| `policy` | 31 | underwriting brain — `sign` two-leg reservation, `pay_fee`, `cover_default`/`cover_exit`, `coverage_required` math/rounding, grace/lapse, solvency witness, policy swap (test.rs 25 + test_system.rs 6) |
| `registry` | 23 | writer-gated typed guarantee store, auth gating, aggregate coverage |
| `adapter-defindex` | 18 | real DeFindex yield adapter — deposit/withdraw, balance accounting, slippage handling |
| `interfaces` | 3 | shared `Guarantee` type + cross-contract client traits |
| mocks (`mock-defindex`, `mock-strategy`, `mock-tesouro`) | 9 | test doubles for strategy/yield wiring (1 + 3 + 5) |

### Frontend (TypeScript / Vitest, `frontend/lib/`)

| Suite | Count | Exercises |
|---|---|---|
| `format.test.ts` | 11 | stroops/decimal formatting, currency display |
| `economics.test.ts` | 6 | NAV, free-capital, coverage math mirrored client-side |
| `discovery.test.ts` | 5 | contract/asset discovery |
| `queue.test.ts` | 4 | redemption-queue state derivation |
| `contracts.test.ts` | 2 | binding/address wiring |

## Load-bearing tests

The invariants a reviewer should check first:

- **Re-entrancy-safe default path** — `policy::test_system::full_demo_flow_holds_solvency_invariant` drives the full lifecycle (deposit → sign → pay_fee → cover_default → settle) and asserts `stable_assets >= coverage_required` holds throughout. The policy reduces coverage *before* calling `vault.disburse` (the vault cannot call back into `policy.coverage_required` during a default — Soroban re-entrancy). `solvency_witness_blocks_overdraw` confirms the witness-asserted `disburse(coverage_after)` rejects overdraw.
- **Fees mint no shares** — `vault::collect_fee_accrues_to_nav` confirms premiums/fees raise NAV per share rather than minting shares (and `collect_fee_releases_lock`).
- **Virtual-offset anti-inflation** — `vault::inflation_attack_does_not_zero_out_second_depositor` and `nav_per_share_unchanged_after_widening` confirm the OZ virtual-offset (`VIRTUAL_OFFSET = 1`) defeats the first-depositor inflation attack.
- **Two-leg coverage** — `policy::sign_reserves_both_legs_immediately`, `cover_default_caps_and_keeps_exit_reserved`, `cover_exit_partial_draws_accumulate_to_cap`, and `settle_releases_both_remaining_legs` exercise the DEFAULT and EXIT legs independently, including caps and residual release.
- **Solvency gate scaling** — `policy::test_system::coverage_required_scales_above_one_x` / `coverage_required_scales_below_one_x` and `policy_swap_preserves_coverage` confirm the gate holds across coverage ratios and across a hot policy swap.

Tests run under `e.mock_all_auths_allowing_non_root_auth()`.

## Audit status

**Not audited.** mutav-pulse is a hackathon proof-of-concept (Stellar Pulso) and a throwaway prototype. It is **not** the production `mutav-stellar` `Fund` contract — that is a separately audited surface (NearX) and shares no code or deployment with this testbed. Nothing here should be treated as production-ready or mainnet-bound.

Hardening that remains before any mainnet consideration:

- **DeFindex slippage-floor characterization** — the `adapter-defindex` withdraw path needs a characterized minimum-out / slippage floor under adverse pool conditions; current tests cover nominal accounting, not worst-case divestment.
- Independent security audit of the full default path, solvency witness, and upgrade/storage-layout invariants.
- The interop follow-ups noted in the SEP-0056 record (how ERC-4626/DeFindex tooling handles a `max_* = 0` / reverting-`withdraw` "withdrawals disabled" vault).

See [../security/security-model.md](../security/security-model.md) for the threat model and trust assumptions.

## SEP-0056 conformance — design decisions

The `vault` contract conforms to **SEP-0056** (Soroban port of ERC-4626, the tokenized-vault standard). Settled decisions:

- **Full surface, not a subset.** The complete standard surface ships — `query_asset`, `total_assets`/`total_supply`, `convert_*`, `preview_*`, `max_*`, `deposit`/`mint`/`withdraw`/`redeem`, plus the `Deposit` event — for interop with ERC-4626 tooling and DeFindex/aggregators.
- **Hand-rolled on OZ `Base`, reusing audited math.** OZ's `FungibleVault` is **not used**: its `total_assets` is hardcoded to the vault's *idle* token balance and the trait requires OZ's concrete `Vault` type as `ContractType`, so there is no injection point for our strategy-aware NAV. Since we deploy capital to strategies, OZ's share-price math would be wrong on every operation. Instead the surface is hand-rolled on the OZ `Base` share token, reusing OZ's audited `mul_div_with_rounding` + `Rounding` (overflow-checked, I256-backed) for convert/preview. Formulas are identical to OZ's `Vault` with `VIRTUAL_OFFSET = 1`.
- **Async-queue-only redemptions; synchronous `withdraw`/`redeem` disabled.** A synchronous, live-solvency-gated, strategy-divesting money-out function callable by any caller is the riskiest new path — so it is omitted. `max_withdraw`/`max_redeem` return `0` and `withdraw`/`redeem` **revert**. The standard explicitly permits this: a vault with withdrawals disabled MUST report `max_* = 0` and revert, which is a conformant configuration. Redemptions go through the existing guarded extension: `request_redeem → process_redemptions (admin, FIFO, reentrancy-guarded) → claim`, bounded by `free_capital = max(0, stable_assets − coverage_required)`.
- **The four forced divergences from a vanilla OZ vault:** (1) `total_assets` counts deployed strategy capital, not just idle balance — the NAV anchor; (2) `max_withdraw`/`max_redeem` return `0`; (3) `withdraw`/`redeem` revert; (4) the async queue is the redemption mechanism (no OZ analog).
- **Breaking renames accepted** — `underlying()` → `query_asset()`, `deposit(from, amount)` → `deposit(assets, receiver, from, operator)` — to keep a single canonical surface rather than additive duplicates. Full operator/allowance delegation semantics on deposit/mint.
- **Fail-closed by construction:** with `withdraw`/`redeem` reverting and `max_* = 0`, the standard write surface moves no funds; the only money-out paths are the existing guarded ones (`process_redemptions`/`claim`, policy `disburse`).

Full per-method origin and impl-source table: [`vault` reference](../reference/contracts/vault.md).
