# mutav-pulse — Modular Vault / Policy / Registry Architecture (Design)

**Date:** 2026-06-21
**Context:** Refactor of the `mutav-pulse` reserve from a single monolithic
`reserve` contract into composed single-responsibility contracts, so the
monetary/underwriting model can churn constantly without re-touching custody.
**Status:** Approved design, pending implementation plan
**Supersedes:** the single-contract structure in
`2026-06-20-mutav-pulse-reserve-vault-design.md` (the *mechanics* — solvency
gate, premium model, redemption queue, strategies — carry over unchanged; only
the packaging into contracts changes).

## Summary

The working monolith puts custody (funds, shares, NAV, redemption queue) and
the volatile underwriting model (guarantees, premiums, coverage math) in one
contract. Those have opposite change rates, and evolving the model means
re-touching the contract that holds the money. This design splits them into
composed contracts — mirroring `stellar-album-2026`'s "many single-purpose
contracts wired by bootstrap, interacting through authority boundaries rather
than shared mutable state" — so the monetary model can be swapped or upgraded
while custody and data stay put.

## Module boundaries (split by change-rate and reuse)

| Contract | One responsibility | Change rate | Holds |
|---|---|---|---|
| `vault` | Custody: funds, shares (OZ fungible), NAV, deposit/redeem queue, strategy allocation | Stable / audited | **The money + shares** |
| `registry` | Typed storage of guarantee records | Stable storage | Data only |
| `policy` | Underwriting brain: premium model, coverage math, fee/period params, default decisions | **Churns constantly** | Logic + model-specific params |
| `strategy` + adapters | Yield venues (unchanged from the existing build) | Per-venue | Deployed positions |
| `interfaces` | Shared rlib: cross-contract client traits + the shared `Guarantee` type | Rare | Nothing (lib) |
| `bootstrap` | Wires the contracts together via setters | — | — |

**Share token stays inside `vault`** (not its own contract like album's `Coin`):
album separates `Coin` because it is independently reused by many contracts; the
share token has exactly one consumer (the vault mints/burns it per
deposit/redeem and reads its supply for NAV). Splitting it would be coupling
disguised as modularity. We split only what genuinely churns or composes
independently: `policy`, `registry`, `strategy`.

## The authority graph

```
 agency   ──pay_premium──▶ policy ──put/extend──▶ registry
 admin    ──sign/cover───▶ policy ──disburse─────▶ vault ──pays──▶ landlord
 agency   ──pay_premium──▶ policy ──collect_premium▶ vault   (revenue, no shares)
 investor ──deposit/redeem▶ vault  ──coverage_required▶ policy ──active_ids/get▶ registry
                            vault  ──invest/divest───▶ strategies
```

**Three authority rules (the safety spine):**
1. **Money moves only through `vault`** — `disburse` and `collect_premium` are
   callable only by the registered `policy`.
2. **Guarantee data is written only by `policy`** — the registry's mutators are
   writer-gated to the registered policy address.
3. **Solvency `stable_assets ≥ coverage_required` is enforced at the vault** —
   on every `disburse`, and on every redemption via `free_capital`.

## Shared `interfaces` crate (avoids circular crate deps)

An rlib (like the existing `strategy` crate) defining the cross-contract client
traits and the shared type. `vault`, `policy`, `registry` all depend on it;
none depend on each other's crates.

```rust
#![no_std]
use soroban_sdk::{contractclient, contracttype, Address, Env};

/// Stable core of a guarantee. Model-specific extras live in the policy's own
/// storage, keyed by id — never here.
#[contracttype]
#[derive(Clone)]
pub struct Guarantee {
    pub id: u32,
    pub landlord: Address,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub months_used: u32,
    pub fee_bps: u32,
    pub period_secs: u64,
    pub paid_until: u64,
    pub active: bool,
}

#[contractclient(name = "VaultClient")]
pub trait Vault {
    fn disburse(env: Env, to: Address, amount: i128);
    fn collect_premium(env: Env, from: Address, amount: i128);
    fn stable_assets(env: Env) -> i128;
}

#[contractclient(name = "PolicyClient")]
pub trait Policy {
    fn coverage_required(env: Env) -> i128;
}

#[contractclient(name = "RegistryClient")]
pub trait Registry {
    fn next_id(env: Env) -> u32;
    fn put(env: Env, g: Guarantee);
    fn get(env: Env, id: u32) -> Guarantee;
    fn active_ids(env: Env) -> soroban_sdk::Vec<u32>;
}
```

## `registry` contract

Dumb typed store. The `Guarantee` shape is the stable core; the registry knows
nothing about premium math.

- `__constructor(admin)`
- `set_writer(policy)` / `writer() -> Address` — admin; the only address allowed to mutate.
- `next_id() -> u32` — writer-only; increments and returns the id counter.
- `put(g: Guarantee)` — writer-only; stores `g` at `g.id` and keeps `active_ids` in sync with `g.active`.
- `get(id) -> Guarantee`, `active_ids() -> Vec<u32>` — public reads.
- `set_admin`, `upgrade`.

## `vault` contract

Custody core. Carries over the existing mechanics (tokenized shares with the
virtual-offset anti-inflation, stable/total split, redemption queue, strategy
allocator), minus the guarantee/premium logic.

- `__constructor(admin, underlying)` — note: **no coverage ratio here** (that is a policy parameter).
- Investor: `deposit(from, amount) -> i128`, `request_redeem(owner, shares) -> u32`, `cancel_redeem(id)`, `claim(id)`.
- `process_redemptions(max_batch)` — admin; FIFO from surplus, reentrancy-guarded.
- Views: `total_assets()`, `stable_assets()`, `available_held()`, `nav_per_share()`, `premium_income()` (cumulative), `free_capital()`.
- `free_capital()` = `max(0, stable_assets() − PolicyClient(policy).coverage_required())`.
- **`disburse(to, amount)`** — `policy().require_auth()`; pre-transfer overdraft guard (`stable_pre ≥ amount`); `ensure_liquidity`; transfer. (It cannot assert against `coverage_required()` — that would re-enter the policy; see "Cross-contract solvency" below.)
- **`collect_premium(from, amount)`** — `policy().require_auth()`; transfer `from → vault`; `premium_income += amount`; emit event. **Mints no shares** → premium accrues to existing holders via NAV.
- Allocator: `add_strategy(addr, weight_bps, volatile)`, `remove_strategy(addr)`, `strategies()`, `rebalance()`.
- `set_policy(addr)` / `policy() -> Address` — admin.
- `set_admin`, `upgrade`.

## `policy` contract

The volatile brain. Premium-gated coverage exactly as in the monolith, now
reading/writing the registry and moving money through the vault.

- `__constructor(admin)`; setters `set_vault(addr)`, `set_registry(addr)`, `set_coverage_ratio_bps(u32)` (default 10000). **No dependency is constructor-baked** — per the address-wiring lesson, all swappable deps go through setters.
- `coverage_required() -> i128` — iterate `registry.active_ids()`; for each `is_current` guarantee add `monthly_amount × (months_covered − months_used)`; × `coverage_ratio_bps / 10000`.
- `is_current(id) -> bool` = `registry.get(id).paid_until > now`. `monthly_premium(id) -> i128`.
- `sign_guarantee(landlord, monthly_amount, months_covered, fee_bps, period_secs) -> u32` — admin; `registry.next_id` + `registry.put` (paid_until = 0). No capital locked.
- `pay_premium(payer, id)` — `payer.require_auth()`; `vault.collect_premium(payer, premium)`; extend `paid_until` and `registry.put`; assert `vault.stable_assets() ≥ coverage_required()` (activation solvency check).
- `cover_default(id)` — admin; require `active`, `months_used < months_covered`, `is_current`; bump `months_used` (deactivate if cap reached) via `registry.put`; `vault.disburse(landlord, monthly_amount)`.
- `settle_guarantee(id)` — admin; mark inactive via `registry.put`.
- `set_admin`, `upgrade`.

## Cross-contract solvency (the subtle part)

The invariant spans two contracts; ordering matters:

- **Default payout:** `policy.cover_default` updates the registry (`months_used++`)
  **before** calling `vault.disburse`, lowering the obligation. At
  `coverage_ratio = 100%` assets and floor drop in lockstep, so the invariant is
  preserved **by construction (call ordering), not by an assert inside `disburse`.**
  > ⚠️ **Soroban re-entrancy constraint (implementation finding):** `vault.disburse`
  > **cannot** call back into `policy.coverage_required()` — the policy is already
  > on the call stack (`policy.cover_default → vault.disburse`), and Soroban traps
  > re-entry into a contract already on the stack. So the originally-specified
  > "disburse asserts `stable_assets ≥ coverage_required` after payout" is
  > **impossible**. The vault instead keeps a pre-transfer overdraft guard
  > (`stable_pre ≥ amount`), which prevents the vault paying out more than it
  > holds but does **not** itself prove the coverage floor. Coverage-breach
  > prevention therefore relies entirely on the policy reducing coverage before
  > disbursing at `ratio ≥ 100%`. A future stronger guarantee would need an
  > on-chain solvency oracle or having the policy pass the post-state coverage
  > into `disburse` as an argument.
- **Premium activation:** `policy.pay_premium` collects funds into the vault
  **and** extends `paid_until` in the registry **before** asserting
  `vault.stable_assets() ≥ coverage_required()`. A premium (10–15%) cannot back
  a full month of exposure (100%), so activation requires pre-existing free
  capital; the assert reverts (rolling back the transfer) if it would breach.
- **Redemptions:** `vault.free_capital()` reads `policy.coverage_required()` live,
  so the surplus gate always reflects current obligations.

## Wiring (bootstrap, setters not constructor-baked)

```
deploy interfaces (lib, no deploy)
deploy registry(admin)
deploy vault(admin, underlying)
deploy policy(admin)
deploy strategy adapters
registry.set_writer(policy)
policy.set_vault(vault); policy.set_registry(registry); policy.set_coverage_ratio_bps(10000)
vault.set_policy(policy)
vault.add_strategy(adapter, weight, volatile)…
```

## Migration story (the payoff)

Swapping the monetary model (`policy-v1 → policy-v2`):

1. Deploy `policy-v2`; `policy-v2.set_vault(vault)`, `set_registry(registry)`, `set_coverage_ratio_bps(…)`.
2. `registry.set_writer(policy-v2)` — v2 may now write guarantee data.
3. `vault.set_policy(policy-v2)` — vault now reads coverage from and disburses only to v2.

Guarantee data persists untouched in the registry; funds and shares never move;
custody is never re-audited. Model-specific extras held in v1's own storage are
abandoned (acceptable — they are model-specific; v2 starts fresh or re-derives).
In-place tweaks that preserve storage layout use each contract's own `upgrade()`.

## Error handling

Assert-with-message (the existing style) for the hackathon; a `#[contracterror]`
enum per contract is the production upgrade. Auth: policy-gated vault functions
use `policy().require_auth()` (cross-contract auth); registry mutators use
`writer().require_auth()`; admin functions `admin().require_auth()`; investor
functions take the holder's auth.

## Testing

Mechanics already covered by the monolith's 16 tests carry over, re-expressed as
**integration tests over the composed system**: a test harness deploys
`registry` + `vault` + `policy` + `mock-strategy`, wires them via setters, and
runs the flows (deposit, premium lifts NAV without minting, premium-gated
coverage, cover_default via disburse, surplus-gated redemption, solvency
invariant across a full narrative). Plus unit tests per contract: registry
writer-gating; vault `disburse`/`collect_premium` rejecting non-policy callers;
policy coverage math. A dedicated **migration test** deploys `policy-v2`,
re-points writer + policy, and asserts guarantee data and balances survive.

## Non-goals

- No new monetary model in this refactor — behavior is preserved, only repackaged.
- No `#[contracterror]` enums, events beyond the premium event, or frontend work (separate efforts).
- Mainnet, audit hardening, and the live DeFindex/Soroswap adapters remain out of scope (Plan 2 / later).
