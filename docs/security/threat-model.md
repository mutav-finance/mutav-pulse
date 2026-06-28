# Threat model

The attack surfaces mutav-pulse is designed against, and the on-chain mitigation for each.

This complements the [security model](./security-model.md) (the authority rules and invariants). Each row names a concrete attack and the mechanism that closes it; the load-bearing ones have dedicated tests (see [testing & audits](./testing-and-audits.md)).

## Custody & solvency

| Threat | Mitigation |
|---|---|
| **Bank run / draining below the floor** — investors redeem capital that is reserved behind active guarantees | Redemptions are gated on `free_capital = max(0, stable_assets − coverage_required)`; only surplus can leave. The `sign_guarantee` solvency assert prevents over-writing the book. |
| **Solvency bypass on payout** — a default payout drops the reserve below coverage | `disburse` asserts `stable_pre − amount ≥ coverage_after` (the policy-attested witness). A payout that would breach the floor reverts. |
| **Overdraft** — paying out more than the vault holds | `disburse` asserts `stable_pre ≥ amount` before the witness check. |
| **Counting volatile yield as solvent capital** | `stable_assets` sums cash + **non-volatile** strategies only; volatile positions never back coverage. |

## Re-entrancy & cross-contract

| Threat | Mitigation |
|---|---|
| **Re-entrant `vault → policy` read** during a default (Soroban traps it) | The witness pattern removes the callback entirely — the vault never calls the in-progress policy (see [security model](./security-model.md)). |
| **Malicious/buggy strategy re-enters a money path** mid-payout | A shared re-entrancy lock (`DataKey::Locked`) guards `rebalance`, `process_redemptions`, `disburse`, `collect_fee`. |
| **Unauthorized fund movement** — a third party calls `disburse`/`collect_fee` | Both require `policy.require_auth()`; only the registered policy can move money. |
| **Forced liquidation of the yield position** — a third party calls the adapter's `divest` to realize slippage (griefing) | The adapter is fail-closed: `invest`/`divest` require the registered controller and trap until `set_controller` is wired. |

## Share token & accounting

| Threat | Mitigation |
|---|---|
| **Inflation / donation attack** — a direct token donation skews NAV to front-run the first depositor | Virtual offset (`VIRTUAL_OFFSET = 1`) on all convert/preview math; dedicated test. |
| **Fee dilution** — fees minting shares would dilute existing holders | Fees accrue to NAV and mint **no** shares (`collect_fee`); dedicated test. |
| **Spending claim escrow** — deploy/rebalance using funds owed to a fulfilled redemption | `available_held` nets `reserved_for_claims`; escrow is never deployed. |
| **Lossy-adapter shortfall** — a strategy reports a `balance()` it cannot realize on `divest` | `ensure_liquidity` re-reads the live balance after each divest and reverts with `InsufficientLiquidity (600)` rather than realizing an incorrect loss (Yearn-v3 stance). |

## Underwriting integrity

| Threat | Mitigation |
|---|---|
| **Writing data without authority** — forging a guarantee record | The registry is writer-gated (`set_writer`); only the policy writes. |
| **Coverage-aggregate drift** — the O(1) `raw_coverage` scalar diverging from the true sum | Single mutator (the `registry::put` delta), a property test (`raw_coverage == Σ contribution`), and an admin `reconcile()` true-up. Any lag errs conservative (floor too high → safe). |
| **Paying a guarantee that is current** | `cover_default` asserts the default condition (`paid_until + grace < now`); a fee paid within grace blocks the payout. |
| **Exit-leg overdraw** | `cover_exit` asserts `exit_used + amount ≤ monthly × exit_months` (the 6× cap). |
| **Fabricated guarantee id** | `registry::put` rejects any id at or beyond the monotonic `NextId` (CWE-840 hardening). |

## Operator & key risk (accepted for the pilot)

| Surface | Status |
|---|---|
| **Admin key** | Single key for the pilot; gates `cover_default`/`cover_exit`/`rebalance`/`process_redemptions`/setters/`upgrade`. Production custody (KMS-backed actions / M-of-N multisig) is out of scope for this testbed. |
| **Admin-gated payouts** | `cover_default`/`cover_exit` are admin-triggered — the on-chain default is provable, but the operator stays on the money path for the pilot (permissionless triggering is deferred). |
| **Upgrade authority** | Admin-gated `upgrade(wasm_hash)` on every contract; layout changes require redeploy + re-wire. |

## Out of scope / hardening before mainnet

- **DeFindex slippage floor** — a conservative 0.5% default (`max_slippage_bps`), not yet characterized against a real DeFindex vault. Tune via `set_max_slippage_bps` before mainnet.
- **No external audit** — this is a hackathon proof of concept; it is not the audited production `mutav-stellar` Fund.
