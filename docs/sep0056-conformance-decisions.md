# SEP-0056 Conformance — Decision Log

Decision-making record for making the `vault` contract conform to **SEP-0056**
(Tokenized Vault Standard). Companion to [`vault-method-surface.md`](./vault-method-surface.md)
(the resulting per-method surface). This file tracks *why* — the options weighed,
what we chose, and the positions that were superseded along the way.

Status: **design in progress** (brainstorming). No code written yet. Next step
after decisions settle: write the formal spec → implementation plan.

---

## Context

- **Origin:** open TODO in `HANDOFF.md` — "SEP-0056 (Tokenized Vault Standard)
  conformance for the vault (rename `query_asset`, add convert/preview/max +
  events; reconcile the async redemption queue via `max_withdraw`/`max_redeem`)."
- **What SEP-0056 is:** a Soroban port of ERC-4626. Defines a fixed function
  surface — `query_asset`, `total_assets`, `total_supply`, `convert_to_*`,
  `preview_*`, `max_*`, `deposit`/`mint`/`withdraw`/`redeem` — plus `Deposit` and
  `Withdraw` events. Requires SEP-41 compliance for the shares.
- **What we have today:** a solvency-gated reserve vault. Deposits mint OZ
  fungible shares; redemptions are **asynchronous** and surplus-gated
  (`request_redeem` → admin `process_redemptions` → `claim`), bounded by
  `free_capital = max(0, stable_assets − coverage_required)`.
- **The crux:** SEP-0056's `withdraw`/`redeem` are *synchronous and
  unconditional*; our redemptions are *async and solvency-gated*. A naive
  synchronous redeem would let capital leave below the coverage floor — defeating
  the vault's entire purpose. Reconciling these is the core design problem.

---

## Decisions

### D1 — Pursue the full SEP-0056 surface (not a partial subset)
**Status:** accepted.
The whole point of conformance is interop (DeFindex, aggregators, ERC-4626
tooling). We expose the complete standard surface, not a read-only subset.

### D2 — Queue reconciliation: queue-only (synchronous withdrawals disabled)
**Status:** accepted. **Chosen: Option B** (reverses an interim Option A choice).

Options weighed:
- **A — instant up to surplus + queue.** `max_withdraw`/`max_redeem` report the
  `free_capital` surplus cap; `withdraw`/`redeem` settle synchronously within that
  cap (reverting above it); the async queue handles the remainder.
- **B — queue-only, `withdraw`/`redeem` revert.** `max_withdraw`/`max_redeem`
  return 0; redemptions stay queue-only via `request_redeem → process_redemptions
  → claim`.

Evolution: A was chosen first for its interop value (a SEP-aware integrator could
redeem the liquid slice through the standard surface). **Reversed to B to reduce
attack surface.**

Rationale for B (attack-surface reduction):
- Option A introduces the **riskiest new code path** — a *synchronous*,
  *live-solvency-gated*, *strategy-divesting* money-out function callable by any
  investor/operator. B avoids it entirely.
- After B, the **only** ways funds leave the vault remain the existing,
  already-guarded paths: `process_redemptions`/`claim` (reentrancy-guarded,
  admin-batched, FIFO) and policy `disburse`. SEP adds only `deposit`/`mint`
  (money-*in*) as genuinely new fund-moving paths; `withdraw`/`redeem` revert and
  move nothing.
- It also eliminates the queue-jump fairness issue A carried (instant redeemers
  bypassing the FIFO queue).

**Conformance is preserved, not merely letter-of.** ERC-4626/SEP-0056 *explicitly*
contemplates this: "if withdrawals are entirely disabled (even temporarily) `max_*`
MUST return 0" and `withdraw`/`redeem` revert. So a "synchronous withdrawals
disabled, redeem via the queue" vault is a valid conformant configuration. The
deposit/mint side stays fully standard.

**Business-model alignment (to document in the spec):** the vault is a
solvency-gated rental-guarantee reserve — capital backing active guarantees is
contractually illiquid until released, and even the liquid surplus is released
through a controlled, batched queue rather than an open synchronous spigot. The
SEP "withdrawals disabled / async redemption" shape matches this exactly.

**Cost accepted:** integrators cannot auto-redeem through the standard
`withdraw`/`redeem` call (they must use our `request_redeem` extension). For a
security-conscious reserve holding real guarantees, smaller attack surface
outweighs synchronous-redeem interop.

### D3 — Breaking changes: full rename + new signatures
**Status:** accepted.
Rename `underlying()` → `query_asset()`; replace `deposit(from, amount)` →
`deposit(assets, receiver, from, operator)`. We update the ~1 frontend call site
(`lib/tx.ts`), regenerate `bindings/vault`, and update tests. Blast radius is
small: the frontend doesn't call `underlying()`, and `bootstrap.sh`'s
`--underlying` is a *constructor arg* (unaffected by the getter rename). True
conformance beats a non-canonical additive surface (e.g. two `deposit` shapes).

### D4 — Operator/allowance: full delegation semantics
**Status:** accepted.
- deposit/mint: `operator.require_auth()`; if `operator ≠ from`, pull assets via
  underlying-asset allowance (`transfer_from`).
- withdraw/redeem: `operator.require_auth()`; if `operator ≠ owner`,
  `spend_allowance(owner, operator, shares)` on the OZ fungible shares.
Fully conformant delegation; OZ `Base` already supports allowances.

### D5 — Implementation source: adopt OZ `FungibleVault`, override only the divergences
**Status:** accepted (supersedes the interim "hand-roll all 17" position).

Evolution of this decision:
1. **Interim position — hand-roll all 17 on OZ `Base`.** Initial reasoning: OZ's
   `FungibleVault` write-path and `max_*` are fixed and assume a vanilla
   ERC-4626; the convert/preview math is ~6 trivial formulas we already have; a
   hybrid would couple us to OZ vault storage. So hand-roll everything on the OZ
   `Base` shares token.
2. **Correction that flipped it.** Two findings:
   - The `total_assets` divergence **propagates**: OZ's convert/preview/deposit
     all compute share price from `total_assets` internally, so reusing them only
     works if we can override `total_assets`.
   - OZ's `FungibleVault` methods are **all overridable defaults** that delegate
     through `Self::ContractType::total_assets(e)`. So `total_assets` is a clean
     **injection point**, and `max_*` are overridable too. Once we inject our
     `total_assets` (cash + strategies), OZ's convert/preview/deposit/mint
     compute *correct* prices — the divergence stops propagating.

Therefore: **adopt OZ `FungibleVault`** for the share token + all pure math +
deposit/mint settlement; **override** `total_assets`, `max_withdraw` (→ 0),
`max_redeem` (→ 0), and `withdraw`/`redeem` (→ revert, per D2); add our
`operator.require_auth()`/allowance wrapper on deposit/mint. This shrinks our
hand-rolled surface from 17 methods to **4 overrides + the async queue**, with no
new synchronous money-out path, and inherits OZ's audited rounding.

> **Updated by D2 (queue-only):** with synchronous withdrawals disabled,
> `withdraw`/`redeem` are overridden to **revert** and `max_withdraw`/`max_redeem`
> to **0** — there is no gated synchronous settle path to wrap. This is strictly
> *less* code and *less* surface than the interim "wrap `withdraw`/`redeem` with
> the gate" plan.

**Caveat / to verify at implementation time:** the exact override ergonomics of
OZ's Rust port (customization via the `ContractType` bridge) are more ceremony
than a plain function and weren't fully confirmed from docs. Confirm against our
pinned `stellar-tokens` version before locking the plan. **Fallback:** if the OZ
override path proves painful, revert to the pure hand-roll (the surface is
identical either way, so conformance is unaffected).

---

## Key findings (line of thought)

- **SEP-0056 ≈ ERC-4626**, and **OZ's `FungibleVault` is itself a SEP-0056
  implementation** — same names, signatures, virtual offset, floor/ceil rounding.
  So "conformance" and "use OZ" converge on the same external surface.
- **Our contract already correctly mixes token + vault.** The single `Vault`
  contract is both the SEP-41 share token (`mtvR`, via OZ `Base`) and the vault
  (custody/NAV/queue/allocator). This is **by design** — ERC-4626 defines the
  vault as its own share token, and OZ's `FungibleVault` extends `FungibleToken`
  on the same contract. Not a smell.
- **The four divergences from a vanilla OZ vault**, and why each is forced:
  1. `total_assets` counts **deployed strategy capital** (not just idle balance)
     — else NAV craters whenever we deploy. This is the NAV anchor everything
     trusts.
  2. `max_withdraw`/`max_redeem` return **0** — synchronous withdrawals are
     disabled (D2); the standard says disabled withdrawals MUST report `max_* = 0`.
  3. `withdraw`/`redeem` **revert** (D2) — no synchronous money-out path; redeem
     via the queue.
  4. The **async queue is the redemption mechanism** and has no OZ analog.
- **Fail-closed by construction:** with `withdraw`/`redeem` reverting and `max_*`
  at 0, the standard write surface moves no funds at all — maximally
  fail-closed. The only money-out paths are the existing guarded ones
  (`process_redemptions`/`claim`, policy `disburse`), so solvency tests + asserts
  concentrate there and on the `total_assets` NAV anchor.

---

## Open items

- [ ] Confirm OZ `FungibleVault` override ergonomics against the pinned
      `stellar-tokens` version (D5 caveat).
- [ ] Write the formal design spec
      (`docs/specs/2026-06-23-mutav-pulse-sep0056-conformance-design.md`),
      folding in D1–D5 and the business-model alignment narrative.
- [ ] Implementation plan after spec review.

## 🧪 Test further on this hackathon

**The D2 queue-only conformance approach is provisional — validate it during the
hackathon before treating it as settled.** Specifically:

- [ ] **Override actually disables cleanly** — confirm overriding OZ's
      `withdraw`/`redeem` to revert and `max_withdraw`/`max_redeem` to `0` is
      supported by the OZ `FungibleVault` override surface (ties into the D5
      ergonomics caveat). If OZ's defaults can't be cleanly suppressed, revert to
      the pure hand-roll fallback.
- [ ] **Integrator behavior with `max_* = 0` + reverting `withdraw`/`redeem`** —
      test how ERC-4626/SEP-0056 tooling and DeFindex-style consumers react to a
      "withdrawals disabled" vault (graceful handling vs. hard failure). This is
      the main thing we traded away by dropping the synchronous path (D2 "cost
      accepted").
- [ ] **End-to-end redemption via the queue only** — verify the full investor
      redeem journey (`request_redeem → process_redemptions → claim`) is the sole
      money-out path exercised, and that the disabled SEP surface causes no
      confusion in the frontend/demo.
- [ ] **Revisit Option A if interop matters more than expected** — if hackathon
      feedback shows synchronous redeem is needed for integrations, D2 can be
      flipped back to Option A (instant-up-to-surplus + queue); the surface stays
      conformant either way.

## References

- [`vault-method-surface.md`](./vault-method-surface.md) — resulting per-method surface
- [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md)
- [OZ Fungible Vault docs](https://docs.openzeppelin.com/stellar-contracts/tokens/vault/vault)
- [OZ stellar-contracts (GitHub)](https://github.com/OpenZeppelin/stellar-contracts)
