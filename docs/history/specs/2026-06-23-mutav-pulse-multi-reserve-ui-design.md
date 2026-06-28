> **⚠️ Historical — superseded.** This document predates the **2026-06-27 fiança redesign** and describes an earlier design (single-leg coverage, `premium`/`collect_premium` naming, and/or pre-modular `reserve` monolith / "TGA" branding). Kept as a build-evolution record — it does **not** reflect the shipped contracts. For the current design see [`docs/specs/`](../../specs/), [`docs/whitepaper.md`](../../whitepaper.md), and the contracts.

# mutav-pulse — Multi-Reserve Product Surface (Design)

**Date:** 2026-06-23
**Status:** Approved design, pending implementation plan
**Scope:** Frontend only (`mutav-pulse/frontend/`). The on-chain reserve **factory**
is a separate sub-project (see Non-goals).

## Summary

Reframe the mutav-pulse frontend around **reserves as the core primitive** — the way
liquidity pools are a DEX's primitive and lending markets are Aave's. Each reserve is a
currency-pegged set of contracts (vault + policy + registry + strategies); the currency
defines the underlying asset *and* the default-payout currency. Today one reserve is
deployed (USDC, Stellar testnet); BRL and ARS are declared as planned.

**Thesis.** A reserve is a *replicable* unit: the same primitive (currency-pegged vault
+ policy + registry + strategies) instantiated per market. New market → new reserve, same
contracts, same UI. The factory mints them; this UI surfaces them. Everything below is in
service of making that replication legible and verifiable from day one.

The frontend becomes:

- a **yield-forward onboarding homepage** (`/`) that showcases the yield, explains the
  protocol, and helps users start;
- **address-keyed, reserve-scoped routes** so each reserve is uniquely and verifiably
  identified (honeypot defense);
- a **per-reserve hub** (`/earn/[vaultAddr]`) with Invest / Transparency / Cockpit tabs;
- a **reserve-aware data layer** behind a small **discovery seam** so the static reserve
  registry can later be swapped for the factory's on-chain registry with no UI change.

## Decisions (from brainstorming)

1. **Decomposition — UI first.** The full vision spans three subsystems: (a) a reserve
   factory contract, (b) reserve discovery, (c) this multi-reserve UI. We build the UI
   first (highest demo value, no contract risk), driven by the static registry; the
   factory and on-chain discovery follow as their own sub-projects.
2. **Routing — address-keyed, reserve-scoped.** Routes key on the reserve's **vault
   contract address**, not a friendly slug. A look-alike "USDC Reserve" at a different
   address gets a different URL and is marked **unverified**. Friendly name for display,
   address for identity.
3. **Homepage — yield-forward onboarding**, not a dashboard. Hero (yield) + how-it-works
   + light reserve showcase + onboard CTA. The dense transparency detail lives on the
   per-reserve Transparency tab, never on `/`.
4. **Per-reserve hub with tabs** — one destination per reserve: Invest, Transparency,
   and a link to the operator Cockpit.
5. **Data layer — Approach A + discovery seam.** Reserve-aware reads parameterized by a
   reserve's contract set, with `getReserves()` / `isVerified()` as the only enumeration
   entry points (today static, later factory-backed).

## Goals

- Make reserves first-class: list them, identify each by address, interact per reserve.
- Onboard investors from a lean, conversion-focused homepage.
- Real, working **verification** (verified vs unverified reserve) — not cosmetic routing.
- Zero-rework path to the future factory: only the discovery seam changes.

## Non-goals (explicit scope guardrails)

- **No factory contract** and no on-chain reserve registry — separate sub-project. The
  discovery seam reads the static registry for now.
- **No cross-currency FX aggregation.** Only one reserve is live, so total AUM = its
  assets (labeled USD-equiv). True multi-currency AUM needs the AUM service.
- **No investing in planned reserves** (BRL/ARS) — they are not deployed.
- **Unverified mode is read-only display + warning**, not a full audit tool.
- **Not a marketing site.** The app homepage stays lean (yield + how-it-works + onboard)
  to complement, not duplicate, `mutav-website` (www.mutav.finance).

## Architecture

### Data layer — reserve-aware reads + discovery seam

Today `lib/contracts.ts` closes over `config.contracts` (one hard-wired contract set).
We parameterize reads by reserve and introduce a discovery seam.

- **`lib/discovery.ts`** — the only place reserve enumeration lives. Swapping the static
  registry for the factory's on-chain registry later touches only this file.
  - `getReserves(): Reserve[]` — today returns the static registry (`lib/reserves.ts`).
  - `getReserve(vaultAddr: string): Reserve | undefined` — resolve by vault address.
  - `isVerified(vaultAddr: string): boolean` — `address ∈ getReserves()`.
- **`lib/contracts.ts`** → `reserveReads(contracts: ReserveContracts)` returns the
  existing `reads` object bound to that `{ vault, policy, registry }` set. The current
  default `reads` (primary reserve) remains for back-compat. `vaultClient` /
  `policyClient` / `registryClient` take addresses as arguments.
- **`lib/reserves.ts`** — `Reserve` gains `address` (the vault contract address = the
  canonical reserve ID). The live reserve's `address` = `config.contracts.vault`. The
  registry is the **verified set**.

### Reserve identity & verification (honeypot defense)

`getReserve(addr)` on a `[vaultAddr]` route resolves to one of three states:

- **Verified** — address in the registry → render the full hub with its contract set and
  a verified marker.
- **Unverified** — a syntactically valid Stellar contract address (`C…`) not in the
  registry → render **read-only** with a prominent `UnverifiedBanner`, no invest CTA.
  Public reads still work (any vault address exposes its data), but the UI never silently
  treats an unknown address as canonical.
- **Invalid** — not a valid contract address → `notFound()` (404).

"Verified" sources from the static registry today; via the discovery seam it sources from
the factory registry later, unchanged at the call sites.

### Planned reserves

Planned reserves (BRL, ARS) have no `address`/contracts. They render on the homepage
showcase as non-clickable "Planned" cards with modeled APY from their currency peg
(`standardProductEconomics`), and have **no** `[vaultAddr]` route until deployed.

## Routes & pages

| Route | Purpose |
|---|---|
| `/` | **Homepage** — yield-forward onboarding (hero · how-it-works · reserve showcase · onboard). |
| `/earn/[vaultAddr]` | **Per-reserve hub** — tabs: Invest · Transparency · Cockpit↗. Verified or unverified per resolution above. |
| `/protocol/[vaultAddr]` | **Operator cockpit** for the reserve (today's `/protocol`, param-bound). |

**Redirects (migration):**

- `/earn` → `/`
- `/earn/transparency` → `/` (its multi-currency overview content is superseded by the
  homepage showcase; the live per-reserve detail moves to the Transparency tab)
- `/protocol` → `/protocol/[primaryLiveAddr]`

### Homepage `/` layout

```
HERO              MUTAV — earn yield backing Brazil's rental guarantees
                  Up to ~33% APY · premiums + DeFi yield, solvency-gated
                  [ Start earning → ]   [ How it works ↓ ]

HOW IT WORKS      1 · Deposit stablecoin → receive mtvR shares
                  2 · The reserve backs rental fianças → earns monthly premiums
                  3 · Idle float earns DeFi yield · redeem from surplus anytime
                  └ solvency-gated: stable assets ≥ guarantee coverage, always

RESERVES          USDC Testnet 24.9% →   BRL Planned 33.4% →   ARS Planned 41% →
                  (light cards; click a live reserve → its hub)

ONBOARD           Connect wallet → get testnet USDC → deposit
                  [ Connect wallet ]   footer: verification · contracts · whitepaper
```

No solvency chip, metric grid, underwriting panel, or guarantee table on `/`.

### Per-reserve hub `/earn/[vaultAddr]`

- **Invest tab** — deposit / redeem / connected-user position (today's `/earn` body),
  bound to the reserve's contracts.
- **Transparency tab** — solvency chip, metric grid, underwriting economics, guarantee
  table, venues, verification (today's `/earn/transparency` live-detail section), bound
  to the reserve.
- **Cockpit↗** — link to `/protocol/[vaultAddr]`.
- Tab state via query param (`?tab=`) so tabs are linkable/shareable.

## Components & migration

**New**

- `app/page.tsx` — homepage (replaces the `redirect("/earn")`).
- `app/earn/[vault]/page.tsx` — per-reserve hub with tabs.
- `app/protocol/[vault]/page.tsx` — cockpit (moved from `app/protocol/page.tsx`).
- `lib/discovery.ts` — the seam.
- `components/UnverifiedBanner.tsx` — unverified-reserve warning.

**Refactor / extract**

- `lib/contracts.ts` → `reserveReads(contracts)` factory; keep default `reads`.
- `lib/reserves.ts` → add `address`; provide it for the live reserve.
- Today's `/earn` body → `components/InvestPanel.tsx` (reserve-parameterized).
- Today's `/earn/transparency` live-detail → `components/ReserveTransparency.tsx`
  (reserve-parameterized). The multi-currency overview it currently renders is dropped
  (superseded by the homepage showcase).
- `components/ReserveCard.tsx` → links to `/earn/[address]` when the reserve is live.
- Nav (`NavShell`) → "Earn"/"Markets" points to `/`; reserve-scoped nav within the hub.

## Error handling

- Unknown but valid `C…` address → unverified read-only mode (banner, no invest).
- Invalid address → `notFound()`.
- Read failures → existing per-panel error banners.
- Planned reserves → non-clickable; no route.

## Testing

- **`lib/discovery.ts`** — unit tests: resolve by address, `isVerified` true/false,
  planned reserves excluded from routable set, unknown vs invalid address handling.
- **`lib/economics.ts`** — already covered; reused per reserve (no change).
- **`reserveReads`** — light test that clients bind to the provided addresses.
- Full `next build` + `vitest` green; browser-verify the live reserve's Invest and
  Transparency flows and an unverified-address route.

## Future (separate sub-projects)

- **Reserve factory (contracts)** — a Soroban factory that deploys + wires a reserve set
  per currency and records it in an enumerable on-chain registry; the discovery seam then
  reads that registry. Reserves listed there render as verified.
- **AUM service** — cross-currency, denomination-equivalent AUM once multiple reserves
  are live (FX conversion for the homepage aggregate).
