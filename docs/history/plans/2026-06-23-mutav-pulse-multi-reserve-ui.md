> **⚠️ Historical — superseded.** This document predates the **2026-06-27 fiança redesign** and describes an earlier design (single-leg coverage, `premium`/`collect_premium` naming, and/or pre-modular `reserve` monolith / "TGA" branding). Kept as a build-evolution record — it does **not** reflect the shipped contracts. For the current design see [`docs/specs/`](../../specs/), [`docs/whitepaper.md`](../../whitepaper.md), and the contracts.

# Multi-Reserve Product Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the mutav-pulse frontend around reserves as the core primitive — a yield-forward onboarding homepage, address-keyed reserve-scoped routes with verified/unverified handling, a per-reserve hub (Invest / Transparency / Cockpit), all behind a reserve-aware data layer and a discovery seam.

**Architecture:** A discovery seam (`lib/discovery.ts`) is the only place reserves are enumerated (static registry today, factory-backed later). Reads are parameterized per reserve via `reserveReads(contracts)`. Routes key on the vault **contract address**: in-registry → verified (full hub); valid-but-unknown → read-only unverified notice; invalid → 404. Writes stay bound to the single live (primary) reserve — the only investable one today.

**Tech Stack:** Next.js 16 (Turbopack, App Router), React, TypeScript, `@stellar/stellar-sdk`, generated contract bindings (`vault`/`policy`/`registry`), Vitest.

## Global Constraints

- **Next.js 16, modified build** — before writing route/page code, read the relevant guide in `node_modules/next/dist/docs/` (per `frontend/AGENTS.md`). Heed deprecation notices.
- **Design system** — Precision Brutalism / Investidor front: Geist (display), Inter (`font-body`), JetBrains Mono (`font-mono`). No rounded corners, no shadows; depth via `--color-canvas`/`--color-surface`/`--color-surface-2`. Amber (`--color-accent`) on <5% of pixels. Use brand CSS vars only — never hardcode colors.
- **Money formatting** — values are i128 stroops (1 unit = 1e7); use `fromStroops`/`fmtUsd` from `lib/format.ts`.
- **Honesty rule** — the live USDC reserve (~24.9% modeled) is the actionable APY; planned-reserve numbers (BRL ~33.4%, ARS illustrative) must be labeled planned and never presented as currently investable.
- **Reserve identity** — a reserve is identified by its **vault contract address**, not a name slug. Friendly name is display-only.
- **Writes scope** — deposit/redeem/admin writes remain bound to `config.contracts` (the primary live reserve). Only reads are reserve-parameterized. The Invest tab renders only for the verified primary reserve.
- **Commands:** test `npx vitest run`; typecheck/build `npx next build`. Run from `mutav-pulse/frontend/`.

---

### Task 1: Reserve identity + discovery seam

**Files:**
- Modify: `frontend/lib/reserves.ts` (add `address` to the `Reserve` interface and the live reserve)
- Create: `frontend/lib/discovery.ts`
- Test: `frontend/lib/discovery.test.ts`

**Interfaces:**
- Consumes: `RESERVES`, `Reserve` from `lib/reserves.ts`; `config.contracts.vault`.
- Produces:
  - `Reserve.address?: string` (vault contract address; present only on live reserves)
  - `getReserves(): Reserve[]`
  - `getReserve(vaultAddr: string): Reserve | undefined`
  - `isVerified(vaultAddr: string): boolean`
  - `type AddressResolution = "verified" | "unverified" | "invalid"`
  - `resolveAddress(addr: string): AddressResolution`

- [ ] **Step 1: Add `address` to the Reserve type and the live reserve**

In `frontend/lib/reserves.ts`, add to the `Reserve` interface (after `status`):

```ts
  /** Vault contract address — the canonical reserve ID. Present on live reserves only. */
  address?: string;
```

In the `usdc` reserve object (it already sets `contracts`), add:

```ts
    address: config.contracts.vault,
```

- [ ] **Step 2: Write the failing test for the discovery seam**

Create `frontend/lib/discovery.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getReserves, getReserve, isVerified, resolveAddress } from "./discovery";
import { config } from "./config";

const LIVE = config.contracts.vault;

describe("discovery seam", () => {
  it("getReserves returns the registry", () => {
    expect(getReserves().length).toBeGreaterThan(0);
  });
  it("resolves the live reserve by its vault address", () => {
    const r = getReserve(LIVE);
    expect(r?.currency).toBe("USDC");
    expect(isVerified(LIVE)).toBe(true);
  });
  it("an unknown but valid contract address is unverified, not found", () => {
    const unknown = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    expect(getReserve(unknown)).toBeUndefined();
    expect(isVerified(unknown)).toBe(false);
    expect(resolveAddress(unknown)).toBe("unverified");
  });
  it("classifies addresses", () => {
    expect(resolveAddress(LIVE)).toBe("verified");
    expect(resolveAddress("not-an-address")).toBe("invalid");
    expect(resolveAddress("GBADDRESSNOTACONTRACT")).toBe("invalid");
  });
  it("planned reserves (no address) are never resolvable by address", () => {
    const planned = getReserves().filter((r) => r.status === "planned");
    for (const p of planned) expect(p.address).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/discovery.test.ts`
Expected: FAIL — `Cannot find module './discovery'`.

- [ ] **Step 4: Implement the discovery seam**

Create `frontend/lib/discovery.ts`:

```ts
/**
 * Discovery seam — the ONLY place reserves are enumerated. Today it reads the
 * static registry (lib/reserves.ts); when the on-chain reserve factory lands,
 * only this file changes (read the factory's registry) — no UI churn.
 */
import { StrKey } from "@stellar/stellar-sdk";
import { RESERVES, type Reserve } from "./reserves";

export function getReserves(): Reserve[] {
  return RESERVES;
}

/** Resolve a reserve by its vault contract address (the canonical ID). */
export function getReserve(vaultAddr: string): Reserve | undefined {
  return RESERVES.find((r) => r.address === vaultAddr);
}

/** A reserve is verified iff its vault address is in the (canonical) registry. */
export function isVerified(vaultAddr: string): boolean {
  return getReserve(vaultAddr) !== undefined;
}

export type AddressResolution = "verified" | "unverified" | "invalid";

/**
 * Classify a route address param:
 *  - "verified"   — a real contract address in the registry
 *  - "unverified" — a syntactically valid contract address we don't recognize
 *  - "invalid"    — not a Stellar contract address at all
 */
export function resolveAddress(addr: string): AddressResolution {
  if (!StrKey.isValidContract(addr)) return "invalid";
  return isVerified(addr) ? "verified" : "unverified";
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/discovery.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/reserves.ts frontend/lib/discovery.ts frontend/lib/discovery.test.ts
git commit -m "feat(frontend): reserve discovery seam + address-keyed identity"
```

---

### Task 2: Reserve-aware data layer

**Files:**
- Modify: `frontend/lib/contracts.ts` (parameterize reads by contract set; keep default `reads`)
- Test: `frontend/lib/contracts.test.ts`

**Interfaces:**
- Consumes: generated `vault`/`policy`/`registry` clients; `config`.
- Produces:
  - `interface ReserveContracts { vault: string; policy: string; registry: string }`
  - `reserveReads(c: ReserveContracts): Reads` — same shape as today's `reads`
  - `type Reads = ReturnType<typeof reserveReads>`
  - `export const reads: Reads` (bound to `config.contracts` — the primary reserve; unchanged call sites keep working)

- [ ] **Step 1: Refactor `lib/contracts.ts` to build reads from a contract set**

Wrap the three `*Client()` factories and the `reads` object in a `reserveReads(c)` function. The client factories take addresses from `c` instead of `config.contracts`; the network fields still come from `config`. Keep every existing read method name and signature identical. At the bottom, export the primary-bound default:

```ts
export interface ReserveContracts {
  vault: string;
  policy: string;
  registry: string;
}

export function reserveReads(c: ReserveContracts) {
  const vaultClient = () =>
    new VaultClient({ rpcUrl: config.rpcUrl, contractId: c.vault, networkPassphrase: config.networkPassphrase });
  const policyClient = () =>
    new PolicyClient({ rpcUrl: config.rpcUrl, contractId: c.policy, networkPassphrase: config.networkPassphrase });
  const registryClient = () =>
    new RegistryClient({ rpcUrl: config.rpcUrl, contractId: c.registry, networkPassphrase: config.networkPassphrase });

  return {
    // ... move EVERY existing read method here verbatim (vaultTotalAssets,
    // vaultStableAssets, vaultNavPerShare, vaultFreeCapital, vaultPremiumIncome,
    // vaultTotalSupply, vaultBalance, vaultStrategies, vaultPendingRequests,
    // vaultRequest, vaultAdmin, policyCoverageRequired, policyAdmin,
    // policyGuarantee, policyIsCurrent, registryActiveIds) ...
  };
}

export type Reads = ReturnType<typeof reserveReads>;

/** Default reads bound to the primary (live) reserve. Existing call sites unchanged. */
export const reads: Reads = reserveReads({
  vault: config.contracts.vault,
  policy: config.contracts.policy,
  registry: config.contracts.registry,
});
```

Delete the old standalone `vaultClient`/`policyClient`/`registryClient`/`reads` definitions (now inside `reserveReads`). The exported `reads` keeps the same shape, so `app/earn`, `app/protocol`, `app/earn/transparency` keep importing `{ reads }` unchanged.

- [ ] **Step 2: Write a smoke test**

Create `frontend/lib/contracts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reserveReads, reads } from "./contracts";

describe("reserveReads", () => {
  it("returns an object exposing the expected read methods", () => {
    const r = reserveReads({ vault: "CA".padEnd(56, "A"), policy: "CB".padEnd(56, "B"), registry: "CC".padEnd(56, "C") });
    for (const m of ["vaultTotalAssets", "policyCoverageRequired", "registryActiveIds", "vaultNavPerShare"]) {
      expect(typeof (r as Record<string, unknown>)[m]).toBe("function");
    }
  });
  it("the default `reads` exposes the same surface", () => {
    expect(typeof reads.vaultTotalAssets).toBe("function");
  });
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npx vitest run lib/contracts.test.ts` → Expected: PASS (2 tests).
Run: `npx next build` → Expected: "Compiled successfully", no TypeScript errors. (Existing pages still import `{ reads }`.)

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/contracts.ts frontend/lib/contracts.test.ts
git commit -m "feat(frontend): parameterize reads per reserve (reserveReads)"
```

---

### Task 3: UnverifiedReserve notice component

**Files:**
- Create: `frontend/components/UnverifiedReserve.tsx`

**Interfaces:**
- Produces: `UnverifiedReserve({ address }: { address: string })` — a full-screen read-only notice. No reads, no invest. This is the honeypot defense: an unknown contract is visibly refused, never rendered as a legitimate reserve.

- [ ] **Step 1: Implement the component**

Create `frontend/components/UnverifiedReserve.tsx`:

```tsx
"use client";

import Link from "next/link";
import { config } from "@/lib/config";

/**
 * Shown for a /earn/[vaultAddr] route whose address is a valid contract but NOT
 * in the verified registry. Refuses to present it as a MUTAV reserve.
 */
export function UnverifiedReserve({ address }: { address: string }) {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "64px 32px" }}>
        <p className="font-body" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--color-error)", textTransform: "uppercase", margin: "0 0 8px" }}>
          UNVERIFIED RESERVE
        </p>
        <h1 className="font-display" style={{ fontSize: "24px", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
          This contract is not a recognized MUTAV reserve
        </h1>
        <p className="font-body" style={{ fontSize: "14px", color: "var(--color-text-2)", lineHeight: 1.6, margin: "0 0 16px" }}>
          The address below is a valid Stellar contract but is not in MUTAV&apos;s verified
          reserve registry. It may be an impersonation. <strong>Do not deposit.</strong>
        </p>
        <p className="font-mono" style={{ fontSize: "12px", color: "var(--color-text-3)", wordBreak: "break-all", border: "1px solid var(--color-border)", padding: "12px", margin: "0 0 24px" }}>
          {address}
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link href="/" className="font-mono" style={{ fontSize: "13px", color: "var(--color-accent)", textDecoration: "none" }}>
            ← Verified reserves
          </Link>
          <a href={`${config.explorerBase}/contract/${address}`} target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: "13px", color: "var(--color-text-3)", textDecoration: "none" }}>
            Inspect on explorer ↗
          </a>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx next build`
Expected: Compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/UnverifiedReserve.tsx
git commit -m "feat(frontend): unverified-reserve notice (honeypot defense)"
```

---

### Task 4: Extract InvestPanel from /earn

**Files:**
- Create: `frontend/components/InvestPanel.tsx` (the deposit/redeem/position body of today's `app/earn/page.tsx`)
- Modify: `frontend/app/earn/page.tsx` → becomes a redirect to `/`

**Interfaces:**
- Consumes: `Reads` from `lib/contracts.ts`; `Reserve` from `lib/reserves.ts`; existing write helpers (deposit/redeem) and components (`DepositWidget`, `RedeemPanel`, `TestnetOnramp`, `ConnectButton`).
- Produces: `InvestPanel({ reads, reserve }: { reads: Reads; reserve: Reserve })` — the connected-user invest surface. Reads via the passed `reads`; **writes stay bound to `config` (primary reserve)** per the Global Constraints.

- [ ] **Step 1: Create InvestPanel from the existing /earn body**

Move the body of `app/earn/page.tsx` (state, `fetchAll`, deposit/redeem/position JSX — everything inside the `EarnPage` component) into `components/InvestPanel.tsx` as `InvestPanel({ reads, reserve })`. Changes:
- Replace the module-level `import { reads } from "@/lib/contracts"` with the `reads` **prop**.
- Add `reserve` to the heading copy where the asset is named (e.g. show `reserve.currency`).
- Keep all write/tx wiring (DepositWidget etc.) exactly as-is — writes target the primary reserve.

- [ ] **Step 2: Turn `app/earn/page.tsx` into a redirect**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";

export default function EarnIndex() {
  redirect("/");
}
```

- [ ] **Step 3: Typecheck**

Run: `npx next build`
Expected: Compiled successfully. (InvestPanel is not yet routed — that's Task 6.)

- [ ] **Step 4: Commit**

```bash
git add frontend/components/InvestPanel.tsx frontend/app/earn/page.tsx
git commit -m "refactor(frontend): extract InvestPanel; /earn redirects to /"
```

---

### Task 5: Extract ReserveTransparency from the transparency page

**Files:**
- Create: `frontend/components/ReserveTransparency.tsx` (the live-detail body of today's `app/earn/transparency/page.tsx`: solvency chip → verification panel)
- Modify: `frontend/app/earn/transparency/page.tsx` → redirect to `/`

**Interfaces:**
- Consumes: `Reads`, `Reserve`; existing `SolvencyChip`, `MetricCard`, `GuaranteeTable`, `VenueDirectory`, `VerificationPanel`; `computeEconomics` from `lib/economics.ts`.
- Produces: `ReserveTransparency({ reads, reserve }: { reads: Reads; reserve: Reserve })` — solvency chip, metric grid, underwriting economics, guarantee table, venues, verification, for one reserve.

- [ ] **Step 1: Create ReserveTransparency**

Move the transparency page body into `components/ReserveTransparency.tsx` as `ReserveTransparency({ reads, reserve })`, with these changes:
- Replace `import { reads }` with the `reads` prop.
- **Drop the multi-currency overview block** (the `RESERVES` strip + `ReserveCard` grid) — it moves to the homepage (Task 8). Keep from the live-detail header downward.
- Replace `PRIMARY_RESERVE.assumptions` / `PRIMARY_RESERVE.currency` references with `reserve.assumptions` / `reserve.currency`.
- Keep the underwriting-economics panel and assumptions caption.

- [ ] **Step 2: Turn `app/earn/transparency/page.tsx` into a redirect**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";

export default function TransparencyIndex() {
  redirect("/");
}
```

- [ ] **Step 3: Typecheck + run existing economics tests**

Run: `npx vitest run` → Expected: all green (economics tests unaffected).
Run: `npx next build` → Expected: Compiled successfully.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ReserveTransparency.tsx frontend/app/earn/transparency/page.tsx
git commit -m "refactor(frontend): extract ReserveTransparency; /earn/transparency redirects to /"
```

---

### Task 6: Per-reserve hub `/earn/[vault]`

**Files:**
- Create: `frontend/app/earn/[vault]/page.tsx`

**Interfaces:**
- Consumes: `resolveAddress`, `getReserve` (`lib/discovery.ts`); `reserveReads` (`lib/contracts.ts`); `InvestPanel`, `ReserveTransparency`, `UnverifiedReserve`.
- Produces: the reserve hub route. Tab state via `?tab=invest|transparency` (default `invest`).

- [ ] **Step 1: Implement the hub page**

Create `frontend/app/earn/[vault]/page.tsx`:

```tsx
"use client";

import { useParams, useSearchParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { resolveAddress, getReserve } from "@/lib/discovery";
import { reserveReads } from "@/lib/contracts";
import { InvestPanel } from "@/components/InvestPanel";
import { ReserveTransparency } from "@/components/ReserveTransparency";
import { UnverifiedReserve } from "@/components/UnverifiedReserve";

type Tab = "invest" | "transparency";

export default function ReserveHub() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const vault = String(params.vault);

  const resolution = resolveAddress(vault);
  if (resolution === "invalid") notFound();
  if (resolution === "unverified") return <UnverifiedReserve address={vault} />;

  const reserve = getReserve(vault)!; // verified ⇒ present
  const reads = reserveReads(reserve.contracts!);
  const tab: Tab = search.get("tab") === "transparency" ? "transparency" : "invest";

  const setTab = (t: Tab) => router.replace(`/earn/${vault}?tab=${t}`);

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}>
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "32px 32px 80px" }}>
        {/* Reserve header + verified marker */}
        <div style={{ marginBottom: "20px" }}>
          <p className="font-body" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--color-text-2)", textTransform: "uppercase", margin: "0 0 6px" }}>
            {reserve.name} · <span style={{ color: "var(--color-accent)" }}>VERIFIED</span>
          </p>
          <h1 className="font-display" style={{ fontSize: "24px", letterSpacing: "-0.02em", margin: 0 }}>
            {reserve.currency} Reserve
          </h1>
        </div>

        {/* Tabs */}
        <div role="tablist" style={{ display: "flex", gap: "24px", borderBottom: "1px solid var(--color-border)", marginBottom: "24px" }}>
          {(["invest", "transparency"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="font-mono"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em",
                color: tab === t ? "var(--color-text)" : "var(--color-text-2)",
                borderBottom: tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
                padding: "0 0 10px",
              }}
            >
              {t}
            </button>
          ))}
          <Link href={`/protocol/${vault}`} className="font-mono" style={{ marginLeft: "auto", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-3)", textDecoration: "none", paddingBottom: "10px" }}>
            Cockpit ↗
          </Link>
        </div>

        {tab === "invest" ? (
          <InvestPanel reads={reads} reserve={reserve} />
        ) : (
          <ReserveTransparency reads={reads} reserve={reserve} />
        )}
      </div>
    </main>
  );
}
```

> Next 16 note: confirm `useParams()`/`useSearchParams()` client behavior against `node_modules/next/dist/docs/` before finalizing; if the project pins async route params, adapt accordingly.

- [ ] **Step 2: Manual verification (browser)**

Run: `npx next build` → Expected: Compiled successfully, route `/earn/[vault]` listed.
Start dev (`npx next dev`) and check:
- `/earn/<live vault address>` → hub renders, Invest tab works, Transparency tab loads reserve metrics.
- `/earn/<some other valid C-address>` → `UnverifiedReserve` notice.
- `/earn/not-an-address` → 404.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/earn/\[vault\]/page.tsx
git commit -m "feat(frontend): per-reserve hub /earn/[vault] with Invest/Transparency tabs"
```

---

### Task 7: Move cockpit to `/protocol/[vault]`

**Files:**
- Create: `frontend/app/protocol/[vault]/page.tsx` (today's `app/protocol/page.tsx`, reserve-parameterized reads)
- Modify: `frontend/app/protocol/page.tsx` → redirect to the primary reserve cockpit

**Interfaces:**
- Consumes: `resolveAddress`, `getReserve`; `reserveReads`; existing admin-tx write helpers; `PRIMARY_RESERVE` (`lib/reserves.ts`).
- Produces: `/protocol/[vault]` cockpit route; `/protocol` redirect.

- [ ] **Step 1: Create the parameterized cockpit**

Copy `app/protocol/page.tsx` to `app/protocol/[vault]/page.tsx`. Changes:
- Read `vault` via `useParams()`; `resolveAddress` → `invalid` ⇒ `notFound()`, `unverified` ⇒ `UnverifiedReserve`.
- Build reads via `reserveReads(getReserve(vault)!.contracts!)` instead of the global `reads`.
- Keep all admin write wiring (`admin-tx.ts`) bound to `config` (primary). The admin gate already compares the connected wallet to the on-chain `vaultAdmin`/`policyAdmin` from reads, so it stays correct.

- [ ] **Step 2: Turn `app/protocol/page.tsx` into a redirect**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";
import { PRIMARY_RESERVE } from "@/lib/reserves";

export default function ProtocolIndex() {
  redirect(`/protocol/${PRIMARY_RESERVE.address}`);
}
```

- [ ] **Step 3: Typecheck + browser check**

Run: `npx next build` → Expected: Compiled successfully; routes `/protocol` and `/protocol/[vault]` present.
Browser: `/protocol` redirects to `/protocol/<primary addr>`; cockpit ADMIN badge lights for the admin wallet; actions still submit.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/protocol/\[vault\]/page.tsx frontend/app/protocol/page.tsx
git commit -m "feat(frontend): per-reserve cockpit /protocol/[vault]; /protocol redirects to primary"
```

---

### Task 8: Homepage `/` — yield-forward onboarding

**Files:**
- Modify: `frontend/app/page.tsx` (replace the `redirect("/earn")`)
- Modify: `frontend/components/ReserveCard.tsx` (link to `/earn/[address]` when live)

**Interfaces:**
- Consumes: `getReserves` (`lib/discovery.ts`); `reserveReads` for the live AUM read; `ReserveCard`; `PRIMARY_RESERVE`; `standardProductEconomics` (already in `lib/economics.ts`); `fmtUsd`.
- Produces: the markets/onboarding homepage; `ReserveCard` becomes click-through for live reserves.

- [ ] **Step 1: Make ReserveCard click-through for live reserves**

In `frontend/components/ReserveCard.tsx`, wrap the card in a `next/link` `<Link href={`/earn/${reserve.address}`}>` **only when** `reserve.status === "live" && reserve.address`; otherwise render the current non-interactive card. Keep all existing styles; add `cursor: pointer` and remove underline on the link.

- [ ] **Step 2: Implement the homepage**

Replace `frontend/app/page.tsx` with a client component containing four sections (Precision Brutalism, brand vars only):

1. **Hero** — Geist headline "Earn yield backing Brazil&apos;s rental guarantees"; sub-line in `font-body`: live reserve modeled APY as the actionable number (`standardProductEconomics(PRIMARY_RESERVE.assumptions).modeledApy`, formatted) + "premiums + DeFi yield, solvency-gated". Two CTAs: `Start earning →` → `/earn/${PRIMARY_RESERVE.address}`; `How it works ↓` → anchor.
2. **How it works** — three `font-body` steps (deposit → reserve backs fianças/earns premiums → idle float earns DeFi yield, redeem from surplus) + a `font-mono` line: "solvency-gated: stable assets ≥ guarantee coverage, always".
3. **Reserves showcase** — a `RESERVES` grid of `ReserveCard` (live = click-through, planned = static). Above it a one-line `font-mono` summary: live/planned counts + "total AUM {fmtUsd(liveAum)} (USD-equiv)", where `liveAum` is fetched once via `reserveReads(PRIMARY_RESERVE.contracts!).vaultTotalAssets()` in a `useEffect` (show "…" while loading).
4. **Onboard** — `font-body` "Connect wallet → get testnet USDC → deposit" + `ConnectButton` + a footer row of `font-mono` links: verification (explorer), contracts, whitepaper.

Honesty rule: the hero APY is the **live** reserve's; planned cards keep their "Planned" badge.

- [ ] **Step 3: Typecheck + browser check**

Run: `npx next build` → Expected: Compiled successfully; `/` is the homepage (no redirect).
Browser: `/` shows hero/how-it-works/reserves/onboard; clicking the USDC card → `/earn/<addr>`; planned cards are non-clickable; AUM number populates.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/page.tsx frontend/components/ReserveCard.tsx
git commit -m "feat(frontend): yield-forward onboarding homepage; reserve cards link to hubs"
```

---

### Task 9: Navigation update

**Files:**
- Modify: `frontend/components/NavShell.tsx`

**Interfaces:**
- Consumes: `PRIMARY_RESERVE` (`lib/reserves.ts`).
- Produces: nav links matching the new IA (no `/earn`, no `/earn/transparency`).

- [ ] **Step 1: Update nav links**

In `frontend/components/NavShell.tsx`, replace `NAV_LINKS` with reserves + protocol, importing `PRIMARY_RESERVE`:

```ts
import { PRIMARY_RESERVE } from "@/lib/reserves";

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "reserves", match: "exact" },
  { href: `/protocol/${PRIMARY_RESERVE.address}`, label: "protocol", match: "prefix" },
];
```

The `isTerminalFront`/`pathname.startsWith("/protocol")` logic stays correct. The logo already links to `/`.

- [ ] **Step 2: Typecheck + browser check**

Run: `npx next build` → Expected: Compiled successfully.
Browser: nav shows "reserves" (active on `/`) and "protocol" (copper-active on `/protocol/*`); no dead `/earn` or `/earn/transparency` links.

- [ ] **Step 3: Full regression**

Run: `npx vitest run` → Expected: all suites green (discovery, contracts, economics).
Run: `npx next build` → Expected: Compiled successfully; routes: `/`, `/earn/[vault]`, `/protocol`, `/protocol/[vault]` (plus `/earn`, `/earn/transparency` redirects).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/NavShell.tsx
git commit -m "feat(frontend): nav for multi-reserve IA (reserves + protocol)"
```

---

## Self-Review

**Spec coverage:**
- Decomposition (UI first) → whole plan, factory out of scope ✓
- Address-keyed reserve-scoped routes → Tasks 1, 6, 7 ✓
- Verified/unverified/invalid → Tasks 1 (`resolveAddress`), 3 (`UnverifiedReserve`), 6/7 (wiring) ✓
- Yield-forward onboarding homepage → Task 8 ✓
- Per-reserve hub (Invest/Transparency/Cockpit) → Tasks 4, 5, 6 ✓
- Reserve-aware data layer + discovery seam → Tasks 1, 2 ✓
- Redirects (`/earn`, `/earn/transparency`, `/protocol`) → Tasks 4, 5, 7 ✓
- Planned reserves non-routable/non-clickable → Tasks 1 (no address), 8 (card link gating) ✓
- Nav update → Task 9 ✓
- Testing (discovery, reserveReads, economics reuse, build) → Tasks 1, 2, 5, 9 ✓

**Placeholder scan:** Extraction tasks (4, 5, 7) reference existing in-repo file bodies with exact transformation instructions and new prop signatures rather than re-printing hundreds of lines — the source files are present in the repo. All genuinely new logic (discovery, reserveReads, UnverifiedReserve, hub, homepage, nav) is shown in full.

**Type consistency:** `Reads`, `ReserveContracts`, `reserveReads`, `getReserve`, `resolveAddress`, `Reserve.address`, `PRIMARY_RESERVE.address` are defined in Tasks 1–2 and consumed with matching names/types in Tasks 4–9. `InvestPanel`/`ReserveTransparency` props `{ reads: Reads; reserve: Reserve }` match their call sites in Task 6.

**Out of scope (carried to other sub-projects):** reserve factory contract; on-chain discovery; cross-currency FX AUM; per-reserve writes; unverified-mode deep reads.
