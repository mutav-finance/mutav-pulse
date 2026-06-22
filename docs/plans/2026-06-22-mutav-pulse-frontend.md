# mutav-pulse Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **UI-code policy:** Logic/data tasks (config, format, contracts, wallet, queue) carry complete code + unit tests. UI tasks specify the scaffold, the data contract (reads/writes + props), the exact copy/labels, and acceptance criteria — the implementer MUST use the **`impeccable` skill** (`.claude/skills/impeccable`) and the **vendored TGA brand tokens** (`.design/branding/tga/`) for the actual JSX/CSS. Do not invent colors/type; read the tokens.

**Goal:** Build the `mutav-pulse` frontend — an investor reserve app (OnRe-modeled) + a custom reserve-manager protocol panel — in the TGA brand, wired to the testnet contracts.

**Architecture:** Next.js 16 App Router, one TGA theme. A shared data layer reads the deployed `vault`/`policy`/`registry` via generated typed bindings over Soroban testnet RPC; writes are wallet-signed via Stellar Wallets Kit. Routes: `/earn`, `/earn/transparency`, `/earn/defi`, `/protocol`.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, `@stellar/stellar-sdk`, `@creit.tech/stellar-wallets-kit`, Vitest, generated contract bindings.

## Global Constraints

- The app lives in `mutav-pulse/frontend/`. Package manager: `bun` (matches the org). Node/Bun available.
- Next.js 16 App Router + TypeScript; Tailwind CSS v4.
- Fonts (next/font): **Geist Bold** headings/NAV; **Inter** body; **JetBrains Mono** ALL numbers + data labels.
- Brand tokens from `.design/branding/tga/identity/palettes.json` (OKLCH) → CSS custom properties. Amber `#E8A020` scarce (<5% of pixels); copper accent for `/protocol`. Use the **`impeccable`** skill for every UI surface.
- Investor-facing label for `free_capital` is **"Liquidity Buffer"**; internal/protocol/code keeps **`free_capital`**.
- All on-chain amounts are `i128` in 7-decimal units → divide by 1e7 for display; `JetBrains Mono` for the rendered value.
- No private keys in the app. Writes: assemble → simulate → wallet-sign → submit.
- Testnet config (seed `.env.local`): RPC `https://soroban-testnet.stellar.org`, passphrase `Test SDF Network ; September 2015`, explorer `https://stellar.expert/explorer/testnet`. Contract ids: VAULT `CDWNA4N4C6CTJL2KHKZASDNKKH3YPXX3TP5JX5GKHNVMRF5V5CCNFGST`, POLICY `CCS7FPL7FRB3JPW2C3HEXCPKL24BXNXKY22KEAXVSRNCLXIDONDIPDJF`, REGISTRY `CC4OTABORWK7OBQY5JY5NOSJQ4YSP3IRLR7P2VTNIZBKQCTJEJ5Z5TRS`, USDC `CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6`.
- Work directly on `main` (first-draft mode).

---

### Task 1: Scaffold Next.js + Tailwind + TGA theme

**Files:**
- Create: `frontend/` (Next.js app), `frontend/app/layout.tsx`, `frontend/app/globals.css`, `frontend/app/page.tsx`, `frontend/lib/config.ts`, `frontend/.env.local`, `frontend/.env.example`.

**Interfaces:**
- Produces: `config` object (`{ rpcUrl, networkPassphrase, explorerBase, contracts: { vault, policy, registry, usdc } }`) from env.

- [ ] **Step 1: Scaffold the app**

```bash
cd mutav-pulse
bunx create-next-app@latest frontend --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-bun --yes
```

- [ ] **Step 2: Brand tokens + fonts**

Replace `frontend/app/globals.css` with the TGA token layer. Read `.design/branding/tga/identity/palettes.json` and `patterns/STYLE.md`; emit the amber/copper/neutral OKLCH scales as CSS custom properties under `@theme`, set the dark canvas, and wire the three fonts. In `app/layout.tsx`, load Geist (bold), Inter, JetBrains Mono via `next/font` and expose them as CSS variables. **Use the `impeccable` skill** to get the base type scale, spacing, and dark-surface treatment right. Acceptance: `bun run dev` renders a dark page using the brand canvas + Geist heading.

- [ ] **Step 3: Config**

Create `frontend/lib/config.ts`:

```ts
export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  explorerBase: process.env.NEXT_PUBLIC_EXPLORER_BASE!,
  contracts: {
    vault: process.env.NEXT_PUBLIC_VAULT_ID!,
    policy: process.env.NEXT_PUBLIC_POLICY_ID!,
    registry: process.env.NEXT_PUBLIC_REGISTRY_ID!,
    usdc: process.env.NEXT_PUBLIC_USDC_ID!,
  },
} as const;
```

Create `frontend/.env.local` and `.env.example` with the `NEXT_PUBLIC_*` values from Global Constraints.

- [ ] **Step 4: Verify build + run**

Run: `cd frontend && bun run build`
Expected: builds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: scaffold Next.js frontend with TGA brand theme + config"
```

---

### Task 2: Format helpers (unit-tested) + contract bindings

**Files:**
- Create: `frontend/lib/format.ts`, `frontend/lib/format.test.ts`, `frontend/bindings/` (generated), `frontend/lib/contracts.ts`, `frontend/vitest.config.ts`.

**Interfaces:**
- Produces: `fromStroops(i128: bigint): number`, `fmtUsd(i128: bigint): string`, `fmtNav(i128: bigint): string`, `fmtBps(bps: number): string`, `truncAddr(a: string): string`; `reads` object in `contracts.ts` with typed async reads (see list).

- [ ] **Step 1: Write failing format tests**

Create `frontend/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fromStroops, fmtUsd, fmtNav, fmtBps, truncAddr } from "./format";

describe("format", () => {
  it("fromStroops divides by 1e7", () => {
    expect(fromStroops(10_000_000n)).toBe(1);
    expect(fromStroops(15_000_000n)).toBe(1.5);
  });
  it("fmtUsd renders 2dp with $", () => {
    expect(fmtUsd(1_012_0000000n)).toBe("$1,012.00");
  });
  it("fmtNav renders NAV_SCALE 1e7 as 1.0000", () => {
    expect(fmtNav(10_100_000n)).toBe("1.0100"); // nav_per_share scaled 1e7
  });
  it("fmtBps renders percent", () => {
    expect(fmtBps(1200)).toBe("12.00%");
  });
  it("truncAddr shortens", () => {
    expect(truncAddr("GBE3QZQSNKZQU7ESFUXFYT5ECZYRM5QM72QW2VKTPHH7TAHFEEPTWED3")).toBe("GBE3…WED3");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd frontend && bunx vitest run lib/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement format helpers**

Create `frontend/lib/format.ts`:

```ts
const SCALE = 10_000_000n; // 1e7 (7 decimals / NAV_SCALE)

export function fromStroops(v: bigint): number {
  return Number(v) / 1e7;
}
export function fmtUsd(v: bigint): string {
  return "$" + fromStroops(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtNav(v: bigint): string {
  // nav_per_share is scaled 1e7; show 4dp.
  return (Number(v) / 1e7).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
export function fmtBps(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}
export function truncAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
```

(`SCALE` is exported-by-use; if lint flags it unused, inline `10_000_000n`.)

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && bunx vitest run lib/format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Generate typed bindings**

Run from `mutav-pulse/`, using the explicit ids from Global Constraints (one command per contract):

```bash
stellar contract bindings typescript --network testnet \
  --contract-id CDWNA4N4C6CTJL2KHKZASDNKKH3YPXX3TP5JX5GKHNVMRF5V5CCNFGST \
  --output-dir frontend/bindings/vault
stellar contract bindings typescript --network testnet \
  --contract-id CCS7FPL7FRB3JPW2C3HEXCPKL24BXNXKY22KEAXVSRNCLXIDONDIPDJF \
  --output-dir frontend/bindings/policy
stellar contract bindings typescript --network testnet \
  --contract-id CC4OTABORWK7OBQY5JY5NOSJQ4YSP3IRLR7P2VTNIZBKQCTJEJ5Z5TRS \
  --output-dir frontend/bindings/registry
```
Then in each `frontend/bindings/<c>` run `bun install && bun run build` if the generated package needs building (follow the generator's README). If the generator emits a package, add it to `frontend/package.json` as a file: dependency.

- [ ] **Step 6: Implement `lib/contracts.ts` reads**

Create `frontend/lib/contracts.ts` exposing a `reads` object. Each method constructs the binding `Client` (from `frontend/bindings/<c>`) with `{ rpcUrl, contractId, networkPassphrase, publicKey? }` and calls the read, returning the typed result. Provide exactly:
`vaultTotalAssets()`, `vaultStableAssets()`, `vaultNavPerShare()`, `vaultFreeCapital()`, `vaultPremiumIncome()`, `vaultTotalSupply()`, `vaultBalance(addr)`, `vaultStrategies()`, `vaultPendingRequests()`, `vaultRequest(id)`, `vaultAdmin()`, `policyCoverageRequired()`, `policyAdmin()`, `policyGuarantee(id)`, `policyIsCurrent(id)`, `registryActiveIds()`.
Each returns the binding's native type (`bigint` for i128, etc.). Reads are simulation-only (no signing). Acceptance: a temporary `app/page.tsx` logs `vaultTotalAssets()` from testnet without error.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib frontend/bindings frontend/vitest.config.ts frontend/package.json
git commit -m "feat: format helpers (tested) + generated bindings + contract reads"
```

---

### Task 3: Wallet (Stellar Wallets Kit) + connect

**Files:**
- Create: `frontend/lib/wallet.ts`, `frontend/components/WalletProvider.tsx`, `frontend/components/ConnectButton.tsx`. Modify: `frontend/app/layout.tsx`.

**Interfaces:**
- Produces: `useWallet()` hook → `{ address: string | null, connect(): Promise<void>, disconnect(): void, signAndSubmit(xdr): Promise<string> }`.

- [ ] **Step 1: Implement the kit singleton + provider**

Create `frontend/lib/wallet.ts` with a `StellarWalletsKit` singleton (network = TESTNET, modules = the standard set incl. Freighter). Expose `getKit()`, `connect()` (opens the modal, stores address), `signTx(xdr)`. Create `frontend/components/WalletProvider.tsx` (React context holding `address` + the actions) and `useWallet()`. `signAndSubmit(xdr)` signs via the kit then submits through an `@stellar/stellar-sdk` `rpc.Server` and waits for success, returning the tx hash. Wrap the app in `WalletProvider` in `layout.tsx`.

- [ ] **Step 2: ConnectButton**

Create `frontend/components/ConnectButton.tsx` — shows "Connect Wallet" (brand button) or the truncated address + disconnect. Use the `impeccable` skill + brand tokens. Acceptance: clicking connects via Freighter on testnet and shows the address.

- [ ] **Step 3: Manual verify + commit**

Run: `cd frontend && bun run dev` → connect a testnet wallet, confirm the address renders.

```bash
git add frontend/lib/wallet.ts frontend/components frontend/app/layout.tsx
git commit -m "feat: Stellar Wallets Kit integration + connect button"
```

---

### Task 4: `/earn` — deposit / redeem widget + queue

**Files:**
- Create: `frontend/app/earn/page.tsx`, `frontend/components/DepositWidget.tsx`, `frontend/components/RedeemPanel.tsx`, `frontend/components/PositionPanel.tsx`, `frontend/lib/queue.ts`, `frontend/lib/queue.test.ts`, `frontend/lib/tx.ts`.

**Interfaces:**
- Consumes: `reads` (Task 2), `useWallet` (Task 3).
- Produces: `lib/tx.ts` write helpers (`deposit`, `requestRedeem`, `claim`, `cancelRedeem`) returning assembled+signed tx hashes; `classifyRequest(req, navScaled)` in `queue.ts` → `"pending" | "claimable" | "claimed"`.

- [ ] **Step 1: Write the queue-state test**

Create `frontend/lib/queue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifyRequest } from "./queue";

describe("classifyRequest", () => {
  it("claimed when claimed flag set", () => {
    expect(classifyRequest({ fulfilled: true, claimed: true, claimable: 100n } as any)).toBe("claimed");
  });
  it("claimable when fulfilled and not claimed", () => {
    expect(classifyRequest({ fulfilled: true, claimed: false, claimable: 100n } as any)).toBe("claimable");
  });
  it("pending when not fulfilled", () => {
    expect(classifyRequest({ fulfilled: false, claimed: false, claimable: 0n } as any)).toBe("pending");
  });
});
```

- [ ] **Step 2: Run to verify fail, then implement**

Run: `cd frontend && bunx vitest run lib/queue.test.ts` → FAIL. Then create `frontend/lib/queue.ts`:

```ts
import type { RedeemRequest } from "@/bindings/vault"; // adjust to the generated type path

export function classifyRequest(r: { fulfilled: boolean; claimed: boolean; claimable: bigint }): "pending" | "claimable" | "claimed" {
  if (r.claimed) return "claimed";
  if (r.fulfilled) return "claimable";
  return "pending";
}
```

Run again → PASS.

- [ ] **Step 3: Write helpers**

Create `frontend/lib/tx.ts`: each write builds the binding client with the connected `publicKey`, calls the method to get an assembled tx, then `signAndSubmit` (Task 3). Implement `deposit(from, amount)`, `requestRedeem(owner, shares)`, `claim(id)`, `cancelRedeem(id)` — amounts are `bigint` stroops.

- [ ] **Step 4: Build the `/earn` UI**

Create `app/earn/page.tsx` composing: a **NAV/APY hero**, **DepositWidget** (USDC amount → "you receive N mtvR at NAV" → `deposit`), **RedeemPanel** (shares amount → `requestRedeem`; list the user's requests with `classifyRequest` status + `claim`/`cancelRedeem` buttons), **PositionPanel** (mtvR balance, USDC value = `balance × nav/1e7`). Copy + labels per spec. Refresh reads after each successful tx. **Use the `impeccable` skill + brand tokens.** Acceptance criteria: on testnet, connect → deposit 100 USDC → position shows shares; request redeem → status reflects queue; claim works when fulfilled.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/earn frontend/components frontend/lib/queue.ts frontend/lib/queue.test.ts frontend/lib/tx.ts
git commit -m "feat: /earn deposit + redeem widget with queue status"
```

---

### Task 5: `/earn/transparency` — reserve dashboard

**Files:**
- Create: `frontend/app/earn/transparency/page.tsx`, `frontend/components/MetricCard.tsx`, `frontend/components/GuaranteeTable.tsx`, `frontend/components/SolvencyChip.tsx`, `frontend/components/VerificationPanel.tsx`, `frontend/lib/apy.ts`, `frontend/lib/apy.test.ts`.

**Interfaces:**
- Consumes: `reads` (Task 2).
- Produces: `estimateApy(snapshots)` in `apy.ts`.

- [ ] **Step 1: APY estimate test + impl**

Create `frontend/lib/apy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { estimateApy } from "./apy";

describe("estimateApy", () => {
  it("annualizes nav growth over elapsed days", () => {
    // nav 1.00 -> 1.01 over 30 days ~ (0.01/1)*(365/30) ≈ 0.1217
    const apy = estimateApy([
      { navScaled: 10_000_000n, t: 0 },
      { navScaled: 10_100_000n, t: 30 * 86400 * 1000 },
    ]);
    expect(apy).toBeGreaterThan(0.11);
    expect(apy).toBeLessThan(0.13);
  });
  it("returns 0 with <2 snapshots", () => {
    expect(estimateApy([])).toBe(0);
  });
});
```

Implement `frontend/lib/apy.ts`:

```ts
export type NavSnap = { navScaled: bigint; t: number };
export function estimateApy(snaps: NavSnap[]): number {
  if (snaps.length < 2) return 0;
  const a = snaps[0], b = snaps[snaps.length - 1];
  const days = (b.t - a.t) / 86_400_000;
  if (days <= 0) return 0;
  const growth = Number(b.navScaled - a.navScaled) / Number(a.navScaled);
  return growth * (365 / days);
}
```

Run: `cd frontend && bunx vitest run lib/apy.test.ts` → PASS.

- [ ] **Step 2: Build the dashboard**

Create `app/earn/transparency/page.tsx` with the metric grid + table + verification, per the spec's mapping table. **MetricCard** (label, big value in Geist Bold, JetBrains Mono unit, optional sparkline). The seven cards: Reserve Value (`total_assets`), NAV per mtvR (`nav_per_share`), Net APY (`estimateApy` over client-stored snapshots, tooltip "estimated since launch"), Committed to Guarantees (`coverage_required`), **Liquidity Buffer** (`free_capital`, tooltip per spec), Premiums Collected (`premium_income`), Shares Outstanding (`total_supply`). **GuaranteeTable** from `registryActiveIds()` → `policyGuarantee(id)` + `policyIsCurrent(id)`: landlord (`truncAddr`), monthly, months used/cap, paid badge, remaining exposure, status. **SolvencyChip**: `stable_assets >= coverage_required` pass/fail + the two values. **VerificationPanel**: `explorerBase/contract/<id>` links for vault/policy/registry/usdc. Persist NAV snapshots to `localStorage` for the sparkline/APY. **Use `impeccable` + brand tokens.** Acceptance: dashboard renders live testnet values; after a protocol action (Task 7) the numbers move.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/earn/transparency frontend/components frontend/lib/apy.ts frontend/lib/apy.test.ts
git commit -m "feat: /earn/transparency reserve dashboard"
```

---

### Task 6: `/earn/defi` — venue directory

**Files:**
- Create: `frontend/app/earn/defi/page.tsx`, `frontend/components/VenueDirectory.tsx`.

- [ ] **Step 1: Build the directory**

Create `app/earn/defi/page.tsx` rendering a brand-styled table of venues: **DeFindex** (role: Yield, status: **Live**, links to the DeFindex adapter on the explorer), **Soroswap** (Swap, Planned), **Blend** (Lending, Planned). Disabled "Soon" actions except DeFindex. Header copy frames the diversified allocator. **Use `impeccable` + brand tokens.** Acceptance: renders the three venues with correct status badges.

- [ ] **Step 2: Commit**

```bash
git add frontend/app/earn/defi frontend/components/VenueDirectory.tsx
git commit -m "feat: /earn/defi venue directory (coming soon)"
```

---

### Task 7: `/protocol` — reserve-manager cockpit

**Files:**
- Create: `frontend/app/protocol/page.tsx`, `frontend/components/ProtocolActionForm.tsx`, `frontend/components/ReserveHealthHeader.tsx`, `frontend/lib/admin-tx.ts`.

**Interfaces:**
- Consumes: `reads`, `useWallet`, `signAndSubmit`.
- Produces: `admin-tx.ts`: `signGuarantee`, `payPremium`, `coverDefault`, `settleGuarantee`, `rebalance`, `processRedemptions`, `addStrategy`, `removeStrategy`.

- [ ] **Step 1: Admin write helpers**

Create `frontend/lib/admin-tx.ts` — same assemble→sign→submit pattern as `lib/tx.ts`, one fn per protocol action with typed args (e.g. `signGuarantee(landlord, monthlyAmount, monthsCovered, feeBps, periodSecs)`).

- [ ] **Step 2: Build the cockpit (admin-gated)**

Create `app/protocol/page.tsx`. On load read `vaultAdmin()`/`policyAdmin()`; if the connected wallet ≠ admin, render a read-only notice (still show the health header). Otherwise render the action forms grouped: **Underwriting** (sign_guarantee, settle_guarantee), **Premiums** (pay_premium), **Claims** (cover_default — pick an active guarantee), **Liquidity** (rebalance, process_redemptions), **Strategies** (add/remove + list with balances). **ReserveHealthHeader**: total_assets, free_capital, coverage_required, pending count, strategy balances. Each form → `ProtocolActionForm` → admin-tx fn → toast + refresh; surface simulation errors verbatim (the contract assert strings). Copper/terminal accent, dense layout. **Use `impeccable` + brand tokens.** Acceptance: as the admin wallet, sign a guarantee → it appears on `/earn/transparency`; cover a default → buffer/NAV move.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/protocol frontend/components frontend/lib/admin-tx.ts
git commit -m "feat: /protocol reserve-manager cockpit (admin-gated)"
```

---

### Task 8: Nav shell, polish pass, deploy config

**Files:**
- Create: `frontend/components/NavShell.tsx`, `frontend/vercel.json` (if needed), `frontend/README.md`. Modify: `frontend/app/layout.tsx`.

- [ ] **Step 1: Nav + shell**

Create `NavShell.tsx` — top nav (Earn · Transparency · DeFi · Protocol) + ConnectButton, in the brand. Wire into `layout.tsx`. Active-route styling.

- [ ] **Step 2: Impeccable polish pass**

Run the **`impeccable` skill** across `/earn`, `/earn/transparency`, `/earn/defi`, `/protocol` for spacing, contrast (amber scarcity, copper for ops), type hierarchy, motion, and the dark-surface treatment. Fix what it flags.

- [ ] **Step 3: Build + deploy config**

Run: `cd frontend && bun run build` → must pass. Document the Vercel env vars (the `NEXT_PUBLIC_*` from Global Constraints) in `frontend/README.md`; note deploy to team `mutav`.

- [ ] **Step 4: Commit**

```bash
git add frontend
git commit -m "feat: nav shell, impeccable polish pass, deploy docs"
```

---

## Self-Review

**Spec coverage:**
- Stack (Next.js 16, Tailwind v4, fonts, tokens, wallet, bindings) → Tasks 1–3. ✓
- `/earn` deposit/redeem + queue → Task 4. ✓
- `/earn/transparency` metric cards + guarantee book + solvency + verification (+ Liquidity Buffer label, APY estimate, Shares Outstanding) → Task 5. ✓
- `/earn/defi` venue directory → Task 6. ✓
- `/protocol` admin-gated cockpit → Task 7. ✓
- Data layer reads/writes, error states, nav shell, deploy → Tasks 2/3/8. ✓
- Brand + impeccable application → every UI task + Task 8 polish. ✓

**Placeholder scan:** Logic tasks (1–5 helpers, queue, apy) carry complete code + tests. UI tasks carry scaffold + data contract + copy + acceptance, with the `impeccable`/tokens directive (per the UI-code policy in the header) — not vague "build the UI." The bindings step gives exact `stellar contract bindings typescript` commands with real ids. No TBDs.

**Type consistency:** `reads.*` names (Task 2) are consumed verbatim in Tasks 4/5/7. `useWallet`/`signAndSubmit` (Task 3) used in Tasks 4/7. `classifyRequest`/`estimateApy`/`fromStroops`/`fmtUsd`/`fmtNav`/`fmtBps`/`truncAddr` defined with the signatures their consumers use. `free_capital` read → "Liquidity Buffer" label only on investor surfaces (Task 5), `free_capital` in `/protocol` (Task 7).

## Out of scope (later)
- Agency (light) front; KYC/institutional path; historical charts beyond the localStorage NAV sparkline; true holder count; live Soroswap/Blend.
