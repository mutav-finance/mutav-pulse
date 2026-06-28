> **⚠️ Historical — superseded.** This document predates the **2026-06-27 fiança redesign** and describes an earlier design (single-leg coverage, `premium`/`collect_premium` naming, and/or pre-modular `reserve` monolith / "TGA" branding). Kept as a build-evolution record — it does **not** reflect the shipped contracts. For the current design see [`docs/specs/`](../../specs/), [`docs/whitepaper.md`](../../whitepaper.md), and the contracts.

# mutav-pulse Frontend — Investor App + Protocol Panel (Design)

**Date:** 2026-06-22
**Context:** Plan 3 — the `mutav-pulse` frontend. An investor-facing reserve app
(modeled on OnRe's information architecture) plus a custom reserve-manager
protocol panel, in the TGA brand, wired to the testnet contracts.
**Status:** Approved design, pending implementation plan
**Reference captures:** `mutav-pulse/.design/onre-ref/{earn,transparency,defi}.png`

## Summary

A single Next.js app, one TGA theme (dark + scarce amber; copper "terminal"
accent for the ops surface). Two areas sharing one data/wallet layer:

- **Investor area** — mirrors OnRe's IA: `/earn` (deposit/redeem), `/earn/transparency`
  (the reserve dashboard), `/earn/defi` (a "coming soon" venue directory).
- **Protocol panel** — `/protocol`, a bespoke reserve-manager cockpit (wallet-gated
  to the admin key) that drives the live demo and the protocol's day-to-day ops.

All on-chain state is read from the deployed testnet contracts; all writes are
wallet-signed (no keys in the app).

## Stack

- **Next.js 16 App Router + TypeScript**, Tailwind CSS v4.
- **Fonts** via `next/font`: **Geist Bold** (headings, NAV, hero numbers), **Inter**
  (body), **JetBrains Mono** (ALL numeric values + data labels).
- **Brand tokens** from `.design/branding/tga/identity/palettes.json` → CSS custom
  properties (OKLCH). Amber `#E8A020` scarce (<5% of pixels); copper accent for `/protocol`.
  Never invent colors/type — read the vendored tokens. Use the **`impeccable`** skill during build.
- **Wallet:** `@creit.tech/stellar-wallets-kit` (StellarWalletsKit) — connect, sign, submit.
- **Chain reads:** `@stellar/stellar-sdk` against Soroban testnet RPC, via **typed
  client bindings generated from the deployed contracts** (`stellar contract bindings
  typescript` for `vault`, `policy`, `registry`).
- **Config:** contract ids + RPC + network passphrase in `.env.local` (seeded from the
  testnet deploy; `NEXT_PUBLIC_*` for client reads).
- **Deploy:** Vercel (team `mutav`).

## Routes & file structure

```
app/
  layout.tsx              # theme, fonts, WalletProvider, nav shell
  globals.css             # TGA tokens → CSS vars; base type scale
  earn/
    page.tsx              # deposit/redeem widget + your position
    transparency/page.tsx # the reserve dashboard (metric cards + guarantee book + verification)
    defi/page.tsx         # "coming soon" venue directory
  protocol/page.tsx       # reserve-manager cockpit (admin-gated)
lib/
  contracts.ts           # generated bindings clients + RPC server, typed reads
  wallet.ts              # StellarWalletsKit singleton + connect/sign/submit
  format.ts              # i128 ↔ display (7-decimals), bps, OKLCH helpers
  config.ts              # env: contract ids, rpc, passphrase, explorer base
bindings/                # generated: vault/, policy/, registry/ typed clients
components/
  MetricCard, NavHero, DepositWidget, RedeemWidget, PositionPanel,
  GuaranteeTable, VerificationPanel, VenueDirectory, ConnectButton,
  ProtocolActionForm, ReserveHealthHeader, TxButton, AmountInput
```

## Data layer (`lib/contracts.ts`)

Typed reads from the deployed contracts (all return `i128` in 7-decimal units;
`lib/format.ts` converts). The reads each screen needs:

- **vault:** `total_assets`, `stable_assets`, `available_held`, `nav_per_share`,
  `free_capital`, `premium_income`, `total_supply`, `balance(account)`,
  `strategies`, `pending_requests`, `request(id)`.
- **policy:** `coverage_required`, `is_current(id)`, `monthly_premium(id)`, `guarantee(id)`.
- **registry:** `active_ids` (→ iterate `policy.guarantee(id)` for the book).

Writes (assembled, simulated, signed via the wallet, submitted):
- investor: `vault.deposit(from, amount)`, `vault.request_redeem(owner, shares)`,
  `vault.claim(id)`, `vault.cancel_redeem(id)`.
- manager: `policy.sign_guarantee/pay_premium/cover_default/settle_guarantee`,
  `vault.rebalance/process_redemptions/add_strategy/remove_strategy`.

Reads refresh on an interval and after any successful write.

## Investor area

### `/earn` — deposit / redeem (OnRe earn widget)
- **Connect** (StellarWalletsKit). Before connect: a clean hero with the headline
  APY + "Earn on the mutav rental-guarantee reserve."
- **Deposit widget** — amount input (USDC), shows shares to receive at current NAV,
  `deposit`. **Redeem** — shares input, `request_redeem` → shows the **queue status**
  (pending / claimable), `claim` when fulfillable, `cancel_redeem`.
- **Your position** — `mtvR` balance, current USDC value (`balance × nav_per_share`),
  gain vs cost basis (best-effort from deposit history; or just current value).

### `/earn/transparency` — the reserve dashboard (OnRe metric layout)
Metric cards (Geist Bold values, JetBrains Mono units), each mapped to a read:

| Card | Read | Label |
|---|---|---|
| Reserve size | `total_assets` | "Reserve Value" (+ growth sparkline) |
| NAV / share | `nav_per_share` | "NAV per mtvR" (hero) |
| APY | derived | "Net APY" (see note) |
| Committed | `coverage_required` | "Committed to Guarantees" |
| Buffer | `free_capital` | **"Liquidity Buffer"** (tooltip: "surplus above guarantee coverage — backs redemptions and new guarantees") |
| Premiums | `premium_income` | "Premiums Collected" |
| Holders | `total_supply` (+ note) | "Shares Outstanding" (true holder count needs indexing — out of scope; show shares outstanding instead) |

- **Guarantee book** (OnRe "Active Deals" table) — rows from `registry.active_ids()` +
  `policy.guarantee(id)`: landlord (truncated), monthly amount, months used / cap,
  `is_current` (paid badge), remaining exposure, status.
- **Solvency proof** — live `stable_assets ≥ coverage_required` shown as a pass/fail
  invariant chip, with the two numbers.
- **Verification** — stellar.expert testnet links to `vault` / `policy` / `registry`
  (+ the USDC SAC), labeled by role.

**APY note:** computed as an annualized figure from `nav_per_share` growth over a
tracked window (client-stored snapshots), labeled "estimated / since launch." Not a
guaranteed rate. Flagged in a tooltip. (No oracle/history contract in scope.)

### `/earn/defi` — venue directory ("coming soon")
OnRe-style table of yield venues the reserve allocates to: **DeFindex** (Live —
links to the adapter), **Soroswap** / **Blend** (Planned). Columns: venue, role
(yield / swap / lending), status, action (disabled "Soon" except DeFindex). Frames
the diversified-allocator expansion.

## Protocol panel — `/protocol` (custom, reserve managers)

Wallet-gated: only renders the actions when the connected wallet == the vault/policy
admin (read `vault.admin` / `policy.admin`); otherwise a read-only notice. Copper
"terminal" accent, dense, utilitarian — same brand, ops register.

- **Reserve health header** — `total_assets`, `free_capital`, `coverage_required`,
  pending-redemption count, strategy balances. Action affordances inline.
- **Underwriting** — `sign_guarantee` (landlord, monthly_amount, months_covered,
  fee_bps, period_secs), `settle_guarantee(id)`.
- **Premiums** — `pay_premium(payer, id)` (manager can pay on behalf for the demo).
- **Claims** — `cover_default(id)` (select an active guarantee, pay the landlord).
- **Liquidity** — `rebalance()` (push reserve → DeFindex), `process_redemptions(max_batch)`.
- **Strategies** — `add_strategy(addr, weight_bps, volatile)`, `remove_strategy(addr)`,
  list with balances.

Each action: a small form → `TxButton` (assemble → simulate → wallet-sign → submit →
toast + refresh). Errors surfaced from simulation (e.g. "premiums not up to date",
"insufficient free capital").

## Error handling & states

- Every read panel has loading / empty / error states (skeletons in brand style).
- Writes: optimistic disabled state during sign+submit; simulation errors shown
  verbatim (the contract's assert messages are meaningful); success toast + refresh.
- Wallet not connected → connect prompts on action; no silent failures.

## Testing

- Component-level: `format.ts` (i128↔display, bps), metric mapping, the queue-status
  state machine. (Vitest + React Testing Library.)
- The real validation is the **live testnet flow in the browser**: connect → deposit →
  see NAV/buffer on transparency → (protocol) sign guarantee + cover default →
  watch the dashboard move → redeem. Captured as the demo script.

## Non-goals

- The agency (imobiliárias / light) front — deferred.
- True holder count (needs an indexer) — show shares outstanding.
- Historical charts beyond a client-side NAV snapshot sparkline (no history contract).
- KYC/onboarding gate (OnRe's "Institutional" path) — single open-access flow.
- Soroswap/Blend live integration — `/earn/defi` shows them as Planned.
