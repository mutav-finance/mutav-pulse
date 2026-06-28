# Solvency & coverage

How mutav-pulse guarantees it can always pay the *fianças* it has written — the protocol's core invariant and the two-leg coverage model behind it.

## The invariant

The reserve is **solvency-gated**. At all times the vault holds enough stable capital to cover every obligation it has underwritten:

```
stable_assets ≥ coverage_required
```

- `stable_assets` — cash held by the vault plus the balance of every **non-volatile** strategy (`contracts/vault/src/lib.rs`, `stable_assets`). Volatile yield positions do **not** count toward solvency.
- `coverage_required` — the capital reserved behind the active guarantee book (`contracts/policy/src/lib.rs`, `coverage_required`), read as an O(1) stored aggregate from the registry.

Everything the protocol allows to leave the reserve is gated on the **surplus** above this floor:

```
free_capital = max(0, stable_assets − coverage_required)
```

Only `free_capital` can ever be redeemed by investors — an on-chain anti-bank-run guarantee. See [vault & shares](./vault-and-shares.md) for how the redemption queue consumes surplus, and the [security model](../security/security-model.md) for how the floor is enforced on every payout.

## Two-leg coverage (the *fiança*)

Mutav is a **fiador institucional** (institutional guarantor), not an insurer. The obligation on a lease has two parts, and a guarantee reserves capital for both:

| Leg | Covers | Pilot size | Drawn by |
|---|---|---|---|
| **DEFAULT** | rent arrears while the tenant is in default | `monthly × months_covered` (3× rent) | `cover_default` — one month per call, capped at `months_covered` |
| **EXIT** | property recovery: eviction, damages, restoration | `monthly × exit_months` (6× rent) | `cover_exit` — arbitrary draws up to the cap |

Maximum executable obligation per guarantee = **9× monthly rent** at coverage ratio `c = 1.0` (hard-solvent, no leverage).

### What a guarantee reserves

Each active guarantee contributes its **remaining** exposure to `coverage_required` (`contracts/registry/src/lib.rs`, `contribution`):

```
default_term = monthly × (months_covered − months_used)
exit_term    = monthly × exit_months − exit_used
contribution = default_term + exit_term      (0 if settled or not active)
```

The registry maintains the sum incrementally as a single stored scalar (`RawCoverage`), updated on every write — no per-call O(n) loop over the book. `coverage_required = ceil(raw_coverage × c)`.

## The fee stream is the default oracle

The tenant pays a monthly **fee** (`pay_fee`); the fee stream itself signals solvency of the lease:

- **fee paid within the grace window → current.** `cover_default` reverts — not in default.
- **fee missed past grace → default.** `cover_default` is authorized and pays the landlord.

A missed fee **triggers** the claim; it never *releases* coverage. Coverage is reserved at `sign_guarantee` and only released by drawing it down (`cover_default`/`cover_exit`) or by `settle_guarantee`. Fees accrue to NAV and mint no shares.

## Capacity is solvency, not a count

There is no fixed cap on the number of guarantees. Issuance is bounded only by the floor: `sign_guarantee` reverts if activating the guarantee would push `coverage_required` above `stable_assets`. The book grows exactly as far as capital backs it.

## Lifecycle summary

| Step | Effect on the aggregate |
|---|---|
| `sign_guarantee` | `+= monthly × (months_covered + exit_months)`; asserts solvency after the write |
| `pay_fee` | no change (coverage reserved at signing); extends `paid_until` |
| `cover_default` | `months_used += 1`, `−= monthly`; disburses one month to the landlord |
| `cover_exit` | `exit_used += amount`, `−= amount`; disburses an exit cost (≤ cap) |
| `settle_guarantee` | `−=` the guarantee's remaining contribution; deactivates |

See [`policy`](../reference/contracts/policy.md) and [`registry`](../reference/contracts/registry.md) for the method signatures, and the [economic model](./economic-model.md) for how these parameters price the product.
