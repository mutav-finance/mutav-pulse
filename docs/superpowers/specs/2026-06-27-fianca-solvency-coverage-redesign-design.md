# Spec — Fiança solvency & coverage redesign (issues #38 / #39 / #40)

**Date:** 2026-06-27  ·  **Status:** approved design, pre-implementation
**Repo:** `mutav-pulse` (throwaway hackathon testbed)
**Supersedes the deferred plan in:** #38 (witness arg), #39 (O(1) coverage), #40 (active-set cap)

## Context

Three open issues — #38 (solvency enforced only by call-ordering), #39 (`coverage_required`
is an O(n) loop), #40 (a flat 90-guarantee cap) — are **three symptoms of one root choice**:
`coverage_required` is computed as the *full remaining sum insured*, **re-summed over every
active guarantee on each call**, with a **time-gate** (`paid_until > now`) that silently
drops lapsed guarantees. The O(n) re-sum is why the 90-cap exists; the time-gate is why the
sum can't be a cheap stored scalar; and because the floor is a derived O(n) number the vault
can't read it during `disburse` (Soroban forbids the re-entrant `vault → policy` call), so
solvency survives only by the policy's "decrement coverage before calling disburse" convention
(the `TODO(solvency-oracle)` at `vault/src/lib.rs:~685`).

Two independent research streams (external surety/insurance practice; the local `mutav` +
`mutav-app` business material) plus a model of the actual product informed the decisions below.
Full briefs live in the conversation; the load-bearing findings are cited inline.

### The decisive reframe: we are a *fiança*, not insurance

Mutav is a **fiador institucional** (Código Civil art. 818+; art. 37-II of Lei 8.245/91),
**not a seguradora**. The obligation has two parts: *cover the rent while the tenant is in
default* (the short rent-arrears window) **and** *cover the cost of recovering and restoring
the property* (eviction proceedings, damages, restoration). The insurance-shaped **30× rent
LMI ceiling** found in `mutav-app` (`apps/agency/src/lib/pricing/tiers.ts`) is a **seguro-fiança**
framing and is **not** adopted — it stays far above our model and is a Draau product decision.

The pilot floor is **default coverage = 3× monthly rent** (the rent-arrears window) **+ exit
coverage = 6× monthly rent** (property recovery/restoration), at coverage ratio **`c = 1.0`**
(hard-solvent). Max executable obligation per guarantee = **9× monthly rent**. This keeps the
provable-solvency story without `c < 1` leverage and stays well under the seguro LMI.

### The B2B2C simplification (the semantic flip)

In the simplified pilot model the **tenant (locatário) pays the monthly fee**, and the fee
stream **is** the default oracle: **fee paid on time = solvent; fee missed past a grace window
= default = the guarantee pays in.** This *inverts* today's lapse logic. Today a missed
premium *releases* coverage (the guarantee drops out of the time-gated sum, and `cover_default`
even reverts "premiums not up to date"). In the new model a missed fee past grace is precisely
what **authorizes the payout**. Removing the time-gate is what collapses #39, #38 and #40.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Floor basis | what capital must back per guarantee | **default** `monthly × (months_covered − months_used)`, `months_covered = 3`; **+ exit** `monthly × exit_months − exit_used`, `exit_months = 6`; `c = 1.0`. Max 9× rent. 30× LMI **deferred to Draau**. |
| Lapse semantics | what a missed fee means | **fee missed → grace window → default**; lapse triggers the claim, never releases coverage. |
| `cover_default` trigger | who pays out | **admin-gated** (unchanged). The on-chain lapse is provable but the operator stays on the money path for the pilot. |
| #39 accounting | how `coverage_required` is maintained | **stored running aggregate** in the registry (data layer), maintained incrementally; no time-gate → no lazy expiry needed. |
| #38 enforcement | how the vault enforces solvency | **policy-attested witness**: `disburse(..., coverage_after)`; vault asserts `stable_pre − amount ≥ coverage_after`. No re-entrancy. |
| #40 capacity | how the book is bounded | **solvency only**: gate issuance on `coverage_required ≤ stable_assets`. Delete `MAX_ACTIVE_GUARANTEES`. |
| Positioning | naming | rename insurance-coded terms → **fiança** terms (premium → fee). |

## The redesigned model

### Lifecycle

- **`sign_guarantee`** (admin) — the fiador commits, so the obligation exists immediately.
  Registry activates the guarantee and the **raw coverage aggregate grows by `monthly ×
  (months_covered + exit_months)`** (default + exit = 9× monthly at the pilot params). The
  **capacity/solvency gate lives here**: after the write, assert `vault.stable_assets() ≥
  coverage_required()`, else revert (this *is* #40). A fresh guarantee's `paid_until` is set so
  the first fee is due within the grace window; `months_used = 0`, `exit_used = 0`.
- **`pay_fee`** (tenant, was `pay_premium`) — pulls the monthly fee into the vault (accrues to
  NAV, mints no shares), extends `paid_until` by one `period_secs`. **Does not change the
  aggregate** (coverage was reserved at signing).
- **default** — `paid_until + grace < now`. Provable on-chain; admin calls `cover_default`.
- **`cover_default`** (admin, the rent-arrears leg) — assert default condition (`paid_until +
  grace < now`), `months_used += 1`, aggregate `−= monthly`, persist; **then**
  `vault.disburse(landlord, monthly, coverage_after)` with `coverage_after = coverage_required()`
  recomputed *after* the decrement. Caps at `months_used == months_covered` (3 draws).
- **`cover_exit`** (admin, the property-recovery leg — NEW) — pay an exit cost up to the cap:
  assert `exit_used + amount ≤ monthly × exit_months`, `exit_used += amount`, aggregate
  `−= amount`, persist; **then** `vault.disburse(landlord, amount, coverage_after)`. Allows
  partial/multiple draws against the 6× cap (damages, eviction, restoration).
- **`settle_guarantee`** (admin) — `active = false`; aggregate `−=` the guarantee's remaining
  contribution (`monthly × (months_covered − months_used) + (monthly × exit_months − exit_used)`).

### #39 — `coverage_required` as an O(1) stored aggregate

The aggregate lives in the **registry** (the data layer — survives policy swaps, consistent
with the stateless-swappable-policy invariant; a policy-local aggregate would not survive a
`set_policy` swap). It is maintained **inside `registry::put`** by a uniform delta:

```
default_term(g) = g.monthly_amount * (g.months_covered - g.months_used)
exit_term(g)    = g.monthly_amount * g.exit_months - g.exit_used        // both ≥ 0 by invariant
contribution(g) = (g.active && g.id < next_id) ? default_term(g) + exit_term(g) : 0
raw_coverage   += contribution(new_g) - contribution(old_g)            // old_g contribution = 0 if first put
```

This is correct for every path — activation (old=0), `cover_default` (used++), `cover_exit`
(exit_used+=), settle/exhaust (active→false), with **no time dependence** (the time-gate is
gone). `policy::coverage_required`
becomes `mul_div_ceil(registry.raw_coverage(), ratio, BPS_DENOM)` — a single read, O(1), with
the same Ceil rounding and `c = ratio/10_000` knob as today (so `c < 1` actuarial mode and
`c > 1` over-collateralization remain available, just no longer the hot path).

`ActiveIds` is **retained** (for enumeration and the reconcile true-up) but is **no longer on
any hot path**; the cap check in its activation branch is deleted.

**Reliability** (the explicit concern): the aggregate is *exact at every write*; any lag errs
**conservative** (an un-processed lapse leaves coverage reserved → floor too high → safe, never
unsafe). Guards: a single chokepoint (the `put` delta is the only mutator), a **property test**
`raw_coverage == Σ contribution(g)` across randomized issue/pay/default/settle sequences, and an
admin **`reconcile()`** that recomputes the sum once and corrects any drift.

### #38 — structural solvency via a policy-attested witness

`interfaces::Vault::disburse` gains a fourth arg (free to change — hackathon, no audited
boundary): `disburse(env, to, amount, coverage_after: i128)`. The vault asserts, keeping the
existing overdraft guard:

```
let stable_pre = stable_assets_inner(&e);
assert!(stable_pre >= amount, "disburse overdraft");
assert!(stable_pre - amount >= coverage_after, "disburse breaches solvency");
```

`policy::cover_default` passes `coverage_after = coverage_required()` computed *after* it has
decremented the guarantee — so `stable_post = stable_pre − amount ≥ coverage_after` is the
maintained invariant, asserted **without the vault re-entering the policy** (the witness is
attested by the already-required `policy.require_auth()` on `disburse`). This deletes the
`TODO(solvency-oracle)`.

### #40 — capacity is solvency, not a count

Delete `MAX_ACTIVE_GUARANTEES` and `RegistryError::ActiveSetFull`. New issuance is bounded by
the `sign_guarantee` solvency assert (`coverage_required ≤ stable_assets`). The book grows
exactly as far as capital backs it.

### Naming alignment (fiança, not insurance)

| Now (insurance-coded) | → Fiança term | Location |
|---|---|---|
| `pay_premium` / `collect_premium` / `premium_of` / `monthly_premium` | `pay_fee` / `collect_fee` / `fee_of` / `monthly_fee` | `policy`, `interfaces` (`Vault::collect_premium`) |
| `PremiumIncome` (NAV bucket + getter) | `FeeIncome` | `vault` |
| event `PremiumPaid` | `FeePaid` | `policy` |
| `fee_bps` | unchanged (already neutral) | — |

`coverage_required`, `cover_default`, `disburse`, `GuaranteeSigned`, `DefaultCovered` stay.

## Code changes by contract

- **`interfaces`** — `Vault::disburse` add `coverage_after: i128` (+ update the 40-line drift
  guard doc to describe the witness, not the ordering convention); rename `collect_premium →
  collect_fee`; add `Registry::raw_coverage() -> i128`. `Guarantee` struct **gains two fields**:
  `exit_months: u32` (exit coverage as a multiple of monthly rent) and `exit_used: i128` (exit
  drawn so far). `months_covered` becomes the **default** (rent-arrears) coverage.
- **`registry`** — maintain `DataKey::RawCoverage(i128)` via the `put` delta (default + exit
  terms); delete `MAX_ACTIVE_GUARANTEES`, the activation-branch cap check, and `ActiveSetFull`;
  add `raw_coverage()` getter and an admin `reconcile()`. Storage layout change → redeploy.
- **`policy`** — `coverage_required` reads `registry.raw_coverage()` × ratio (drop the loop);
  move/extend the solvency assert into `sign_guarantee` (reserves default + exit); `cover_default`
  asserts the default condition (`paid_until + grace < now`), decrements, passes `coverage_after`
  witness; **add `cover_exit(id, amount)`** (admin, capped at `monthly × exit_months`, same
  witness pattern); add a `grace_secs` param (admin-settable, `DataKey::GraceSecs`); fee renames.
  `sign_guarantee` takes `exit_months` (pilot = 6) alongside `months_covered` (pilot = 3).
- **`vault`** — `disburse(.., coverage_after)` asserts the floor; `collect_premium → collect_fee`;
  `PremiumIncome → FeeIncome`. `stable_assets`, NAV, redemption-queue surplus gate unchanged
  (the surplus gate already reads `coverage_required`, now O(1)).
- **`mocks`** — `mock-policy` / `mock-defindex` updated for the new `disburse` arity and renames.

## Testing strategy (TDD)

1. **Property test** — `raw_coverage == Σ contribution` (default + exit terms) across randomized
   lifecycles (issue/pay/default/exit/settle/exhaust), including interleavings.
2. **Solvency-on-disburse** — both `cover_default` and `cover_exit` revert when `stable_pre −
   amount < coverage_after`; a multi-default + exit sequence cannot drain below the aggregate floor.
3. **Lapse-flip** — fee paid within grace ⇒ `cover_default` reverts (not yet in default); fee
   missed past grace ⇒ `cover_default` succeeds and pays the landlord.
4. **Exit cap** — `cover_exit` reverts when `exit_used + amount > monthly × exit_months`; partial
   draws accumulate to the 6× cap; releasing on settle subtracts the unused exit remainder.
5. **Capacity** — `sign_guarantee` reverts when it would push `coverage_required > stable_assets`;
   no count ceiling otherwise (issue well past 90).
6. **`reconcile()`** — after a forced drift, recompute corrects the aggregate.
7. Gates: `cargo test` (workspace) + `stellar contract build` green.

## Migration / redeploy

Storage layout changes (registry `RawCoverage`, policy `GraceSecs`) and the `interfaces` ABI
change (`disburse` arity, `collect_fee` rename) mean this is **not** an in-place `upgrade()`:
redeploy `registry` + `policy` + `vault` and re-wire via `bootstrap.sh` (setters:
`set_policy` / `set_vault` / `set_registry` / `set_writer`, `add_strategy`). The vault's
immutable `underlying` is unaffected.

## Simulations (`model/mutav_model.py`)

The economic model must reflect the two-leg coverage. Parameter changes:

- **Default coverage** `N = 3` (was 6) — the rent-arrears window; `cover_default` payout leg,
  driven by the existing `rho` monthly-default regime (expected default payout ≈ `rho · R` /mo,
  capped at `N` months).
- **Exit coverage** `E = 6` (new) — `monthly × E` cap drawn at lease end via `cover_exit`.
- **Capital locked** `= c · R · (N + E) = 9 · R` per guarantee at `c = 1.0` (was `6 · R`).
- **Exit-cost claim assumption** (the one new modelling input, since exit severity isn't in the
  current `rho` regime): model an exit-cost draw at lease termination with **frequency `p_exit`
  and mean severity `s_exit · (E · R)`**. Proposed conservative defaults to start:
  `p_exit = 1.0` (every lease incurs some exit cost) × `s_exit ≈ 0.15` (≈ 0.9× rent average
  draw, ~one month of restoration), with the **full 6× reserved** regardless (hard solvency).
  The Monte Carlo adds this to the payout stream; the deterministic APY/loss-ratio tables and
  `--selftest` assertions update accordingly. **`p_exit` / `s_exit` are the values to confirm.**

## Deferred / out of scope (Draau check-in)

- **30× LMI default coverage** — the seguro-fiança ceiling; our pilot uses 3× default + 6× exit
  (9× total). Revisit 30× with Draau; it would likely force a `c < 1` calibration.
- **Per-agency billing / correlated lapse / agency & tenant fields** — the real B2B2C billing
  unit is the agency; modelled here as independent per-guarantee fees (the pilot simplification).
- **Permissionless / landlord-triggered `cover_default` / `cover_exit`** — stay admin-gated.
