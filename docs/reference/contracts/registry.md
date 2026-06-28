# Registry method surface (guarantee store)

The `registry` is the writer-gated, data-only guarantee store: it holds the typed
`Guarantee` records and maintains an O(1) running coverage aggregate.

The registry stores guarantee data and nothing else — it moves no money and runs
no underwriting logic. It is **writer-gated**: only the wired writer (the
[policy](./policy.md)) may mutate it. Its one piece of derived state is
`RawCoverage`, the running sum of every active guarantee's remaining coverage,
maintained incrementally inside `put` (the sole mutator chokepoint) so
`policy.coverage_required` is a single read rather than an O(n) loop. See
[solvency and coverage](../../concepts/solvency-and-coverage.md).

## The `Guarantee` type (`contracts/interfaces/src/lib.rs`)

The stable core of a guarantee. Per-agency/per-tenant identifiers and per-leg draw
timestamps live in the policy's own keyed storage — never here.

| Field | Type | Notes |
|---|---|---|
| `id` | `u32` | Primary key, derived from the registry's monotonic `NextId` (a writer must never fabricate it) |
| `landlord` | `Address` | Payout recipient on `disburse` |
| `monthly_amount` | `i128` | Monthly rent backed; the per-leg coverage unit |
| `months_covered` | `u32` | DEFAULT leg term (pilot = 3) |
| `months_used` | `u32` | DEFAULT months drawn; `0 <= months_used <= months_covered` |
| `fee_bps` | `u32` | Fee rate; `fee = monthly_amount * fee_bps / 10_000` |
| `period_secs` | `u64` | Fee period length; also drives the entry's TTL span |
| `paid_until` | `u64` | Fee-paid horizon; `> now` = current, `+ grace < now` = default |
| `active` | `bool` | `false` once settled; an inactive guarantee contributes `0` coverage |
| `exit_months` | `u32` | EXIT leg term as a multiple of rent (pilot = 6) |
| `exit_used` | `i128` | Cumulative underlying drawn via `cover_exit`; `0 <= exit_used <= monthly_amount * exit_months` |

Max executable obligation per guarantee = `monthly_amount * (months_covered +
exit_months)` = 9× monthly rent at the pilot params, at coverage ratio `c = 1.0`.

## Methods

| Method (signature) | Access | Notes |
|---|---|---|
| `next_id() -> u32` | writer | Returns the current `NextId` and increments it; `checked_add` panics on `u32::MAX` exhaustion rather than wrapping to collide `Guarantee(0)` |
| `put(g: Guarantee)` | writer | Sole mutator. Rejects `g.id >= NextId` (`InvalidId = 201`, CWE-840). Updates `ActiveIds`, persists the struct, sizes its TTL to the coverage span, and applies the `(new − old) contribution` delta to `RawCoverage` (read pre-overwrite so first-put nets `+new`, re-put nets the difference) |
| `get(id) -> Result<Guarantee, RegistryError>` | — | Pure read; `GuaranteeNotFound = 200` if absent. NO `extend_ttl` (a read-path bump would cost O(active) writes per solvency view) |
| `active_ids() -> Vec<u32>` | — | Enumeration of active ids; off every hot path (retained for `reconcile`) |
| `raw_coverage() -> i128` | — | O(1) read of the running `Σ contribution(g)` aggregate. Pure — no auth, no `extend_ttl`. `unwrap_or(0)` belt-and-suspenders |
| `reconcile()` | admin | Drift true-up: recomputes `RawCoverage` once from the active set and overwrites the scalar (safety valve; `put` keeps it exact) |
| `writer() -> Address` | — | Current writer; `WriterNotSet = 202` for a pre-default upgraded-in instance |
| `set_writer(writer)` | admin | Wire the sole writer (the policy). Bumps instance TTL |
| `schema_version() -> u32` | — | On-chain storage layout version; `0` for a pre-versioning instance |
| `admin() -> Address` | — | Current admin |
| `set_admin(new_admin)` | admin | Rotate admin; bumps instance TTL |
| `upgrade(wasm_hash)` | admin | In-place wasm swap. Refused (`VersionMismatch = 203`) if stored `SchemaVersion != CURRENT_SCHEMA_VERSION` (= 2); layout-changing edits redeploy + re-wire via `bootstrap.sh`. Emits `Upgraded` |
| `__constructor(admin)` | — | Seeds `Admin`, `NextId = 0`, empty `ActiveIds`, `Writer = admin` (closes the unset-writer window), `SchemaVersion = 2`, `RawCoverage = 0` |

### `contribution(g)` — the per-guarantee coverage formula

`raw_coverage` sums `contribution(g)` over active guarantees:

```text
contribution(g) = (active && id < NextId)
    ? monthly_amount * (months_covered - months_used)   // DEFAULT leg
      + (monthly_amount * exit_months - exit_used)       // EXIT leg
    : 0
```

A settled (`active = false`) or not-yet-issued guarantee reserves nothing.
`checked_*` arithmetic traps on overflow/underflow (the active set is unbounded —
no `MAX_ACTIVE_GUARANTEES` ceiling).

## Invariants / access

- **Data-only, writer-gated.** The registry moves no money and runs no
  underwriting. Both `next_id` and `put` require the wired writer's auth
  (`require_writer`); only the [policy](./policy.md) holds that role. See
  `contracts/registry/src/lib.rs`.
- **Non-negativity (load-bearing).** `0 <= months_used <= months_covered` and
  `0 <= exit_used <= monthly_amount * exit_months`, so BOTH leg contributions stay
  `>= 0` at every write. The conservative-drift property (any lag errs by reserving
  too much, never too little) depends on this.
- **Exact aggregate.** `put` is the sole mutator of `RawCoverage`; the per-write
  delta keeps it EXACT at every write (Yearn-v3-style write-chokepoint total), so
  reads are O(1). `reconcile` is the admin drift safety valve.
- **TTL hygiene.** `put` sizes each `Guarantee` entry's TTL to its full coverage
  span; every policy lifecycle mutation re-puts the struct and re-extends. Reads
  never extend (pure). Error codes occupy the `2xx` band.
