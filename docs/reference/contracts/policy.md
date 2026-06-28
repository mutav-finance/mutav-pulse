# Policy method surface (underwriting)

The `policy` contract is the swappable underwriting brain: it signs guarantees,
pulls fees, authorizes coverage payouts, and is the **sole writer** of the
[registry](./registry.md).

The policy owns the monetary model. It reads/writes guarantee data through the
`registry` and moves money only through the [vault](./vault.md) (`collect_fee`,
`disburse`) — it never holds custody. Coverage is a **two-leg** obligation per
guarantee: a DEFAULT (rent-arrears) leg drawn one month at a time via
`cover_default`, and an EXIT (property-recovery/restoration) leg drawn in
arbitrary partial amounts via `cover_exit`. Both legs are reserved at signing and
gated by the solvency model. See [solvency and coverage](../../concepts/solvency-and-coverage.md)
and the [security model](../../security/security-model.md).

The policy is the **swappable** brain: every cross-contract link is setter-wired
(`set_vault`/`set_registry`), never constructor-baked, so the monetary model can be
upgraded or redeployed without moving funds. `coverage_required` stays a pure
function of registry state (the aggregate lives in the registry, not policy
storage), so a freshly-wired policy-v2 reads the same book with no migration.

| Method (signature) | Access | Notes |
|---|---|---|
| `sign_guarantee(landlord, monthly_amount, months_covered, exit_months, fee_bps, period_secs) -> Result<u32, PolicyError>` | admin | Issues a guarantee. Bounds `fee_bps <= 10_000` (else `FeeTooHigh = 300`); asserts `monthly_amount > 0`, `months_covered > 0`, `fee_bps > 0`, `period_secs > 0`. `paid_until = now` (obligation exists immediately). Asserts the book stays solvent after writing (`stable_assets >= coverage_required`) BEFORE emitting `GuaranteeSigned` |
| `pay_fee(payer, id)` | payer | Pulls `fee_of(g)` into the vault via `collect_fee` and extends `paid_until` by `period_secs`. Asserts guarantee active and fee `> 0`. No post-put solvency reassert (put-delta is provably 0) |
| `cover_default(e, id)` | admin | DEFAULT leg. Asserts active, `months_used < months_covered`, and in-default (`paid_until + grace_secs < now`). Increments `months_used`, persists, THEN computes `coverage_after` witness, THEN calls `vault.disburse(landlord, monthly_amount, coverage_after)` |
| `cover_exit(e, id, amount)` | admin | EXIT leg. Asserts active, `amount > 0`, and `exit_used + amount <= monthly_amount * exit_months` (cap). Adds to `exit_used`, persists, THEN witness, THEN `vault.disburse(landlord, amount, coverage_after)`. Partial/multiple draws allowed |
| `settle_guarantee(e, id)` | admin | Sets `active = false` and re-puts; the registry put-delta releases BOTH remaining legs (`contribution(g) -> 0`) |
| `coverage_required() -> i128` | — | `interfaces::Policy` trait. O(1): `ceil(registry.raw_coverage() * coverage_ratio_bps / 10_000)`. Ceil keeps the capital floor never-understated; at ratio `10_000` returns `raw_coverage` exactly |
| `guarantee(id) -> Guarantee` | — | View — reads `registry.get(id)` |
| `is_current(id) -> bool` | — | `true` while `paid_until > now` (fee not yet lapsed) |
| `monthly_fee(id) -> i128` | — | `fee_of(g) = monthly_amount * fee_bps / 10_000` (floor) |
| `grace_secs() -> u64` | — | Missed-fee grace window before default. Defaults to `DEFAULT_GRACE_SECS` (432_000s ≈ 5 days) |
| `set_grace_secs(secs)` | admin | Tune the grace window |
| `coverage_ratio_bps` setter — `set_coverage_ratio_bps(bps)` | admin | Coverage ratio knob. Bounded `<= 100_000` (1000%); `>100%` over-collateralization is legitimate, not clamped to `10_000` |
| `set_vault(addr)` | admin | Wire the vault (money path) |
| `set_registry(addr)` | admin | Wire the registry (data path) |
| `set_admin(new_admin)` | admin | Rotate admin |
| `upgrade(wasm_hash)` | admin | In-place wasm swap; requires preserved storage layout |
| `__constructor(admin)` | — | Seeds `Admin`, `CoverageRatioBps = 10_000`, `GraceSecs = DEFAULT_GRACE_SECS`. Vault/registry are setter-wired after deploy |

## Invariants / access

- **Sole registry writer.** All guarantee state changes flow through the policy;
  the registry is writer-gated to the policy address (see [registry](./registry.md)).
- **Witness-asserted solvency (re-entrancy invariant).** `cover_default` and
  `cover_exit` follow a HARD ORDER: decrement-and-persist the guarantee via
  `registry.put` FIRST, THEN compute `coverage_after = coverage_required()`, THEN
  call `vault.disburse(to, amount, coverage_after)`. The vault asserts
  `stable_pre - amount >= coverage_after` against a value it already holds — it
  CANNOT call back into `policy.coverage_required` during a default (Soroban
  forbids re-entering the in-progress policy frame). See `contracts/policy/src/lib.rs`
  and the `Vault::disburse` witness contract in `contracts/interfaces/src/lib.rs`.
- **Fee stream is the default oracle (fiança, not insurance).** A fee paid on time
  keeps the guarantee current; a fee MISSED past `grace_secs` is what authorizes
  the payout. Missing a fee does not release coverage.
- **Admin-gated money paths.** `cover_default`/`cover_exit`/`settle_guarantee`/
  `sign_guarantee` require admin auth; `pay_fee` requires the payer's auth.
- **Error band.** Policy errors occupy the `3xx` band (`FeeTooHigh = 300`),
  clear of registry `2xx` and strategy/adapter `4xx`/`5xx` codes.
