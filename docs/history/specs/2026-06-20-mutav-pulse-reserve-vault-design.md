> **⚠️ Historical — superseded.** This document predates the **2026-06-27 fiança redesign** and describes an earlier design (single-leg coverage, `premium`/`collect_premium` naming, and/or pre-modular `reserve` monolith / "TGA" branding). Kept as a build-evolution record — it does **not** reflect the shipped contracts. For the current design see [`docs/specs/`](../../specs/), [`docs/whitepaper.md`](../../whitepaper.md), and the contracts.

# mutav-pulse — Solvency-Gated Reserve Vault (Design)

**Date:** 2026-06-20
**Context:** Stellar Pulso Hackathon (SCF Build Award — Integration Track)
**Status:** Approved design, pending implementation plan

## Summary

A standalone hackathon repo that prototypes the mutav SGR reserve/fund as a
**tokenized vault with a solvency gate**. Investors deposit a stablecoin and
receive transferable share tokens. The reserve backs a registry of rental
guarantees and must always hold enough capital to cover its outstanding
exposure — so capital can only leave (redemptions) or be committed (new
guarantees) from the *surplus* above that floor. While it sits backing
guarantees, the reserve float is diversified across yield venues, so yield
makes the reserve both more solvent and more liquid without ever touching the
coverage floor.

This is a throwaway testbed modeled on
[`stellar-album-2026`](https://github.com/jubscodes/stellar-album-2026) —
fresh, readable contracts, not coupled to the audited `mutav-stellar` Fund.

## Goals

- Showcase **three SCF integrations** in one coherent flow:
  - **DeFindex** (yield) — *fully wired* on testnet.
  - **Soroswap** (swap routing) — *fully wired*; powers an XLM-denominated slot
    that requires swapping in/out of the stablecoin.
  - **Blend v2** (lending) — *adapter stub*, same interface, mock balance.
- Demonstrate the core mutav thesis: a guarantee reserve that earns yield on
  its float yet can never be drained below the capital backing live guarantees.
- Wallet connection via **Stellar Wallets Kit** (existing mutav stack).

## Non-goals (explicit scope guardrails)

- No mainnet deployment.
- No BRL on/off-ramp.
- No tenant/agency modeling — guarantees are a light admin-managed registry.
- No audit hardening, no operator/key-custody runtime. Does **not** feed
  `mutav-stellar` directly; learnings transfer back informally.

## Repo layout

Album-style flat structure:

```
mutav-pulse/
  contracts/              # Soroban / Rust workspace
    reserve/              # tokenized vault + solvency gate + guarantee registry (hero)
    strategy/             # shared trait every adapter implements
    adapter-defindex/     # LIVE — wraps DeFindex testnet vault
    adapter-soroswap/     # LIVE — XLM slot, swaps via Soroswap on invest/divest
    adapter-blend/        # STUB — same trait, mock lending balance
  frontend/               # TypeScript + Stellar Wallets Kit
  tests/
  docs/
  Cargo.toml
  Makefile
  bootstrap.sh
  rust-toolchain.toml
```

Org: `mutav-finance`. Proposed repo name: `mutav-pulse`.

## Core contract: `reserve` (tokenized vault)

A tokenized vault (ERC-4626-style on Soroban): deposits mint a transferable
share token via the OpenZeppelin fungible-token standard; redemptions burn it.
Share value tracks the blended NAV of the whole position.

### State

- `underlying` — the deposit asset (testnet USDC). Constructor-baked, immutable by design.
- Share token (OpenZeppelin fungible standard) — e.g. `mtvUSDC`.
- `strategies: Vec<(address, weight_bps, volatile)>` — the diversified allocation
  set; `volatile` flags price-variable venues (e.g. the Soroswap/XLM slot).
- `coverage_ratio_bps` — multiplier applied to guarantee exposure. **Must be
  ≥ 10000 (100%)** for the hard solvency invariant; sub-100% is permitted only
  as explicitly labeled "actuarial mode."
- `max_volatile_bps` — cap on the share of assets allocated to volatile venues
  (enforced at `rebalance`).
- `VIRTUAL_OFFSET` — a constant added to supply and assets in share↔asset math
  (anti-inflation; see Design principles).
- `guarantees` — registry of `{ id, landlord, monthly_amount, months_covered, months_used, fee_bps, period_secs, paid_until, active }`. Agencies pay a monthly premium (`monthly_amount × fee_bps / 10000`) to keep coverage current.
- `redemption_queue` — FIFO of `{ id, owner, shares, requested_epoch, status }`.

### Derived quantities (the heart of the design)

- `total_assets()` = vault-held underlying + Σ `strategy.balance()` across
  **all** strategies. Drives **NAV only**.
- `stable_assets()` = vault-held underlying + Σ `strategy.balance()` across
  **stable (non-volatile)** strategies. Drives **solvency**.
- `nav_per_share()` = `total_assets() / total_shares` (counts volatile upside).
- `remaining_exposure(g)` = `g.monthly_amount × (g.months_covered − g.months_used)`.
- `is_current(g)` = `g.paid_until > now` — premiums paid through a future time.
- `coverage_required()` = Σ `remaining_exposure(g)` over active **and current** guarantees × `coverage_ratio_bps`. A lapsed (unpaid) guarantee locks **no** capital.
- `free_capital()` = `max(0, stable_assets() − coverage_required())` — the only
  capital that may exit or back new guarantees. **Stable-backed by construction:**
  volatile value never counts toward the floor.

### Entry points

| Function | Rule |
|---|---|
| `deposit(amount)` | **Instant.** Transfer underlying in, mint shares at current NAV, allocate per weights. Share math uses a **virtual offset** and asserts `shares > 0` (anti-inflation). |
| `sign_guarantee(landlord, monthly_amount, months_covered, fee_bps, period_secs)` | Admin. Registers the guarantee. **No capital is locked at sign time** — coverage is premium-gated and activates on the first `pay_premium`. |
| `pay_premium(payer, id)` | Agency. Pulls `monthly_amount × fee_bps / 10000` of underlying into the reserve (revenue → lifts NAV, **no shares minted**) and extends `paid_until` by one period. Solvency is checked **here** (activating coverage must keep `stable_assets ≥ coverage_required`), since the premium alone cannot back a full month of exposure. |
| `cover_default(id)` | Admin, **highest priority**. **Halted unless `is_current`** (premiums up to date). Pays **one** `monthly_amount` to the landlord, increments `months_used`. The guarantee **stays active** until `months_used == months_covered` or it is settled. Divests from strategies if vault-held underlying is short. |
| `settle_guarantee(id)` | Admin. Retires a guarantee (contract ended), releasing its remaining exposure back into `free_capital`. |
| `request_redeem(shares)` | Escrow the shares into a pending queue entry. No underlying leaves yet. |
| `cancel_redeem(request_id)` | Owner. Returns escrowed shares for an unfulfilled request and drops it from the queue. |
| `process_redemptions(max_batch)` | Admin/keeper. Walk **up to `max_batch`** queued requests **FIFO**, fulfilling each only while `free_capital()` covers it (divesting as needed); stop when surplus is exhausted. Bounded to avoid unbounded-loop DoS. |
| `claim(request_id)` | Owner collects underlying for a fulfilled request; burns the escrowed shares. |
| `set_weights(...)` / `add_strategy(addr, bps, volatile)` | Admin configures the diversified mix; `volatile` marks price-variable venues. |
| `remove_strategy(addr)` | Admin. Divests the venue fully, then drops it from the registry — lets a buggy adapter be swapped for a fixed one **without redeploying the vault**. |
| `rebalance()` | Admin moves capital between venues toward target weights. |
| `set_admin(new_admin)` | Admin. Rotates the admin authority (no constructor lock-in). |
| `upgrade(new_wasm_hash)` | Admin. In-place Wasm swap via `update_current_contract_wasm` — fix logic with **zero state loss**. |

**Anti-bank-run invariant (holds at `coverage_ratio_bps ≥ 10000`):** after any
sequence of inflows/outflows, `stable_assets() ≥ coverage_required()`.
Redemptions and new guarantees draw only from `free_capital()` (stable surplus);
`cover_default` is always served first and, at 100% ratio, consumes stable
assets and the floor in lockstep.

### Premium model (the reserve's primary revenue)

Each guaranteed rental contract pays a recurring monthly premium
(10–15% of rent, configurable per guarantee via `fee_bps`) to *remain*
guaranteed. This is the protocol's core income; DeFi yield on the float is
secondary. Mechanics:

- **Revenue → NAV.** `pay_premium` flows underlying into the reserve without
  minting shares, so premiums accrue directly to existing shareholders.
  **Investor return = premiums + yield**, not yield alone.
- **Premium-gated coverage.** A guarantee covers (and locks reserve capital)
  *only while its premiums are current*. Stop paying → coverage lapses, the
  floor releases that capital, and `cover_default` is halted until the agency
  catches up. This is the literal "pay to remain guaranteed" of seguro-fiança.
- **Actuarial core.** Premiums from the many non-defaulting contracts fund the
  occasional default; pooled investor capital is the buffer. A single premium
  (10–15%) cannot back a full month of exposure (100%), which is why
  `pay_premium` enforces the solvency invariant at activation.

### Design principles: upgradeability & address wiring

Two lessons carried in from the reference work, baked in from day one so the
system never has to be reset to acquire them:

- **Upgradeability over immutability (admin-gated).** Every deployable contract
  (`reserve` and each adapter) exposes `upgrade(new_wasm_hash)` guarded by
  `admin.require_auth()`, calling `e.deployer().update_current_contract_wasm(hash)`.
  Future fixes become in-place Wasm swaps that preserve all storage — no
  migration, no redeploy-and-repopulate. Retrofitting this onto a live
  immutable contract is impossible without a full reset, so it ships first, not last.
- **Wire dependencies through setters/registries, never constructor-baked
  immutables.** A constructor-baked address with no setter turns a one-contract
  bug into a whole-system redeploy. So: strategies live in a **registry**
  (`add_strategy` / `remove_strategy`) — a broken `adapter-defindex` is swapped
  in isolation; `admin` is rotatable via `set_admin`; and each adapter exposes a
  setter for its venue address (Plan 2). **The one deliberate exception is
  `underlying`** — it is constructor-baked and has no setter *on purpose*:
  changing the deposit asset would invalidate every outstanding share's claim,
  so it is immutable by design, and that immutability is the documented intent
  rather than an oversight.

### Design principles: solvency safety

Mitigations from the design-level security pass, baked into the model:

- **Stable-backed floor (H2).** The coverage floor is met only by stable
  (USDC-denominated) assets — `free_capital() = stable_assets() − coverage_required()`.
  Volatile venues (the Soroswap/XLM slot) lift NAV but never count toward the
  floor, and `max_volatile_bps` caps how much of the book can sit in them. A
  collapse in XLM price can reduce upside but cannot make the reserve insolvent
  against its guarantees.
- **Hard invariant requires ≥100% coverage (M1).** `cover_default` pays a full
  month while releasing `month × ratio` of the floor, so the invariant
  `stable_assets() ≥ coverage_required()` is only *provable* at
  `coverage_ratio_bps ≥ 10000`. The demo runs at 100%. Sub-100% is "actuarial
  mode" — permitted, but it accepts default-wave insolvency risk and is labeled
  as such, never presented as a hard guarantee.
- **Anti-inflation / first-depositor (H1).** Share↔asset conversion uses a
  **virtual offset** (`+VIRTUAL_OFFSET` on both supply and assets in every
  mint/redeem computation), and every deposit asserts `shares > 0`. This defeats
  the ERC-4626 donation/inflation attack (where a rounding-to-zero mint lets an
  early actor capture later deposits) while preserving 1:1 first-deposit and
  NAV semantics.
- **Reentrancy & trust boundary (M2).** Strategy adapters are admin-curated
  (semi-trusted) and `underlying` is a trusted asset; nonetheless
  `process_redemptions` carries a reentrancy guard and all value-moving paths
  follow effects-before-interactions, since `divest` calls out to adapters.
- **Bounded processing (M3).** `process_redemptions(max_batch)` is bounded so a
  large queue can never brick redemption processing.

## Strategy layer

### `strategy` trait

Uniform interface — the vault iterates a set of these and knows nothing about
the venue behind each:

- `invest(amount)` — deploy underlying into the venue.
- `divest(amount)` — pull underlying back out.
- `balance()` — current value of the position, denominated in the vault's underlying.
- `underlying()` — the asset this strategy accepts.

### Adapters

- **`adapter-defindex` (LIVE):** `invest`/`divest` call the DeFindex testnet
  vault; `balance()` reads the dfToken position. Real yield accrues, lifting NAV.
- **`adapter-soroswap` (LIVE):** denominated in XLM. `invest` swaps
  USDC→XLM via Soroswap and holds XLM; `divest` swaps XLM→USDC back. `balance()`
  values the XLM position in USDC via a Soroswap quote. This is the genuine
  swap integration inside the allocator.
- **`adapter-blend` (STUB):** implements the trait against a minimal/mock Blend
  supply position, clearly labeled as a stub. Demonstrates pluggability without
  the 1+ month real Blend integration.

## Frontend

TypeScript + Stellar Wallets Kit. Panels:

- **Wallet / connect** — Stellar Wallets Kit, show share-token balance.
- **Deposit / Redeem** — deposit mints shares; redeem creates a queued request
  and shows queue position + claimable status.
- **Reserve dashboard** — `total_assets`, `coverage_required`, `free_capital`,
  `nav_per_share`, and per-strategy `balance()` with target weights.
- **Guarantees** — list active guarantees with remaining exposure; admin
  controls to `sign_guarantee`, `cover_default`, `settle_guarantee`.

## Data flow (demo narrative)

1. Investor connects wallet, deposits USDC → vault mints `mtvUSDC` shares →
   underlying allocated across DeFindex / Soroswap(XLM) / Blend per weights.
2. Admin signs a batch of guarantees → `coverage_required` rises, `free_capital`
   shrinks (room to underwrite is visibly consumed).
3. A contract defaults → `cover_default(id)` pays one month to the landlord
   first, `months_used++`, contract stays active.
4. Investors `request_redeem` → enter the FIFO queue, but can only be fulfilled
   from `free_capital` — the coverage floor holds the line.
5. Yield accrues across the three venues → `total_assets` and `free_capital`
   recover → `process_redemptions()` drains more of the queue, and there is
   fresh room to sign new guarantees.

Every mutav thesis — diversified yield, full backing of live guarantees,
month-by-month default coverage, no bank runs — is visible in one flow.

## Testing

- **`reserve` unit tests:** NAV math; `free_capital` accounting; `sign_guarantee`
  rejection when surplus is insufficient; `cover_default` consuming one month and
  keeping the contract active until the cap; FIFO redemption fulfilled only from
  surplus; the `total_assets ≥ coverage_required` invariant across sequences.
- **DeFindex adapter:** integration test against testnet (invest, accrue, divest).
- **Soroswap adapter:** swap-in/swap-out round-trip and USDC valuation of the XLM position.
- **Blend stub:** trait-level test confirming interface conformance.

## Open questions for the plan

- Exact DeFindex + Soroswap testnet contract addresses / SDK entry points
  (resolve during planning against current docs).
- Whether `process_redemptions` is triggered manually in the demo or on a simple
  keeper loop in the frontend.
- Coverage-ratio default for the demo (e.g. 100% full-backing for legibility vs.
  a sub-100% actuarial ratio to show "room").
