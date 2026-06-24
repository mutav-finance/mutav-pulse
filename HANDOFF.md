# mutav-pulse — Handoff

Stellar Pulso hackathon testbed for the **mutav SGR** reserve/fund (onchain
rental-guarantee infrastructure). Status as of 2026-06-22: **three plans
complete and on `main`** (modular contracts, DeFindex yield adapter, frontend),
deployed + seeded on testnet, frontend demo-ready.

Read `CLAUDE.md` first (contracts, brand setup, conventions). Design history is
in `docs/specs/` and `docs/plans/` (one spec + plan per phase).

---

## ⚡ CURRENT STATE — 2026-06-24 — branch `refactor/multi-reserve-ui` (PR #17)

> The frontend was substantially restructured into a **multi-reserve "Mutav Pulse" landing**. The `/earn`, `/earn/transparency`, `/earn/defi`, `/`→`/earn` structure under "What's done" below is **SUPERSEDED** — use the route map here. All work is committed + pushed on `refactor/multi-reserve-ui` (PR #17 *"Multi-reserve UI + Mutav Pulse Protocol landing"*). Verified: `next build` clean (8 routes), `vitest` **22/22**, ESLint clean. Contracts unchanged.

### What changed this session
- **Multi-reserve refactor** (9-task plan, executed subagent-driven — spec `docs/specs/2026-06-23-mutav-pulse-multi-reserve-ui-design.md`, plan `docs/plans/2026-06-23-mutav-pulse-multi-reserve-ui.md`): a **discovery seam** (`lib/discovery.ts`: `getReserves`/`getReserve`/`isVerified`/`resolveAddress`) + **address-keyed reserve identity**; **reserve-aware reads** (`reserveReads(contracts)` in `lib/contracts.ts`, default `reads` = primary); **per-reserve hub** `/earn/[vault]` (Deposit / Transparency / Cockpit tabs) + **cockpit** `/protocol/[vault]`; honeypot defense (verified / unverified / invalid → `UnverifiedReserve`). Extracted `InvestPanel` + `ReserveTransparency`. **Reads are reserve-parameterized; writes stay config-bound to the primary reserve.**
- **Mutav Pulse landing**: React Flow protocol-flow diagram (`components/ProtocolDiagram.tsx` — gates, reserve-internal strategy adapters, EIP-7540 async-redeem framing) + fiat flag logos (`components/CurrencyLogo.tsx`); homepage repositioned as the **testnet PoC of Mutav's Pulse Protocol** (not a yield app); a 13-surface **copy review** (38 edits); reserves named **MUSD/MBRL/MARS**; **discoverability** nav (`HOME · RESERVES · PROTOCOL`) + a `/reserves` comparison table with clickable rows.
- **Economic model + whitepaper** (`model/mutav_model.py`, `docs/whitepaper.md`): guarantees/coverage/premiums/yield/risk grounded in real southern-Brazil delinquency. Key result: **APY = currency risk-free yield + ~19% currency-independent underwriting spread.**

### Route map (current)
- `/` — landing (hero · reserves strip · how-it-works · protocol diagram · onboard)
- `/reserves` — reserve **comparison table** (clickable rows → hub)
- `/earn/[vaultAddr]` — per-reserve **hub** (Deposit / Transparency / Cockpit). `/earn` & `/earn/transparency` → redirect `/`
- `/protocol/[vaultAddr]` — operator **cockpit**. `/protocol` → primary reserve cockpit

### Naming / framing conventions (NEW — do not relearn)
- Reserves are **MUSD / MBRL / MARS** = the Mutav vault for each fiat (`M` prefix). The **vault is named for the fiat (USD)**; **USDC is ONLY the underlying stablecoin token** it holds. Full names: "Mutav USD/BRL/ARS Reserve". Registry: `lib/reserves.ts`.
- **Two PoC vaults**: MUSD (live testnet), MBRL (next). **NOT investable.** Production **pilot Q3 2026** with BRL. **APYs are MODELED** (peg-derived) — never "live returns".
- UI verb is **deposit**, never invest/earn. Standards cited in copy: SEP-0056, SEP-0041, EIP-7540 (async redeem).

### ⚠️ Admin rotated (testnet)
The **vault + policy admin is now the user's Freighter** `GBGRCDMLN6NV7W64DUMCOOCRH3WEFU6PC5LIFCXSQQDDC7Q3MQAZK5O5` (set via `set_admin`). `pulse-admin` is **demoted** on vault+policy → CLI seed scripts that act as vault/policy admin will fail; demo-USDC minting still works (separate SAC admin). The cockpit has **no `set_admin` UI yet** — to rotate back, sign from the Freighter via CLI.

### Run
`cd frontend && npm run dev` → localhost:3000. Package manager is **bun** (`bun add`/`bun install`); `npm run dev|build|test` also work. Tests: `npx vitest run`. Build: `npx next build`. Testnet contract IDs in `frontend/.env.local` / `.env.example` (live vault `CAJ2L2JB…PBMR`).

### 👉 IMMEDIATE NEXT STEP — apply the 2026-06-24 deep code-review fixes
A high-effort `/code-review` ran on the landing diff. **No critical bugs.** To-do, in order:
1. **(latent)** Parameterize the hardcoded **"USDC"** in `InvestPanel` (`deposit demo USDC`), `DepositWidget`, `RedeemPanel` by `reserve` — correct for MUSD today (USDC is the deposited token), wrong for MBRL.
2. **(latent)** `/reserves` + the home strip render **PRIMARY reserve's AUM for every `live` row** (only `PRIMARY_RESERVE.vaultTotalAssets()` is fetched). Guard to the primary, or fetch per-reserve — before a 2nd reserve goes live.
3. `ReserveTransparency.tsx` Modeled-APY card unit still says `u/w` → `underwriting` (consistency; ReserveCard was fixed).
4. `lib/reserves.ts` JSDoc still says `"USDC" | "BRL" | "ARS"` / `"USDC Reserve"` → MUSD/MBRL/MARS.
5. Homepage footer **"Cockpit ↗"** (`app/page.tsx`) sends public users to admin `/protocol/[vault]`; repoint to `/earn/[vault]?tab=transparency`.
6. **Cleanup** (one-liners): drop the no-op `useMemo` on `NODES`/`EDGES` in `ProtocolDiagram`; `NavShell` `match:"home"` is identical to `"exact"`; extract `fmtPct` to `lib/format` (`pct()` is triplicated); extract a `useLiveAum` hook (home + `/reserves` duplicate the AUM fetch); drop the dead old keys (USD/BRL/ARS) in `CurrencyLogo.CURRENCY_COUNTRY`; compute `/reserves` `href` inside the `clickable` branch.

### Open follow-ups (backlog / issues)
- GH **#19** — review redemption-queue contracts vs EIP-7540 (request → surplus-gated process → claim). #18 (testnet onramp/faucet) is **merged to main**; #17 is this branch.
- Realized-loss-ratio **event indexing** (`pay_premium`/`cover_default` — no events/counters today) + a **solvency/risk panel** on `/protocol`; **on-chain reserve factory** + **AUM service** (multi-reserve, cross-currency); **govern the `coverage_ratio` dial**; **DeFindex slippage floor** (`min_amounts_out=[0]`); add **set_admin/upgrade** lifecycle UI to the cockpit.

---

## What's done

1. **Modular contracts** (`contracts/`, Soroban/Rust) — `interfaces` (shared
   `Guarantee` + cross-contract client traits), `registry` (writer-gated store),
   `vault` (custody: OZ-fungible shares, NAV w/ virtual-offset anti-inflation,
   surplus-gated redemption queue, strategy allocator, policy-gated
   `disburse`/`collect_premium`), `policy` (swappable premium-gated underwriting
   brain), `strategy` trait + `adapter-defindex` (real DeFindex yield) +
   `mock-strategy`/`mock-policy`/`mock-defindex` test doubles. 23 unit tests pass.
2. **Frontend** (`frontend/`, Next.js 16) — investor app (`/earn`,
   `/earn/transparency`, `/earn/defi`) + admin-gated `/protocol` cockpit. TGA
   brand, Stellar Wallets Kit, typed bindings from the deployed contracts. Build
   + 10 vitest tests green. `/` redirects to `/earn`.

## Invariants / gotchas (don't relearn these)

- **Build wasm with `stellar contract build`**, NOT `cargo build --release`
  (soroban-sdk 26.1 spec-shaking needs the CLI). Unit tests: `cargo test`.
- Tests use `e.mock_all_auths_allowing_non_root_auth()` (SAC mint nests auth).
- `FungibleToken` impls need `MuxedAddress` imported; burn/escrow shares via
  internal `Base::update` (public `transfer` wants a `MuxedAddress`).
- **Solvency by call-ordering:** `vault.disburse` CANNOT call
  `policy.coverage_required()` — the policy is already on the stack via
  `cover_default` (Soroban re-entrancy trap). The policy reduces coverage in the
  registry BEFORE disbursing; invariant `stable_assets ≥ coverage_required` holds
  at `coverage_ratio_bps ≥ 10000`. The vault keeps only a pre-transfer overdraft
  guard. See the `// TODO(solvency-oracle)` in `vault/src/lib.rs`.
- **Premiums mint no shares** (accrue to NAV). Premium-gated coverage: only
  paid-up (current) guarantees lock capital; `cover_default` halts when not
  current.
- **Money is i128 in 7-decimal units** — frontend divides by 1e7 for display;
  `nav_per_share` is itself 1e7-scaled.
- **Brand is vendored** at `.design/branding/tga/` (copy-vendor, `bun brand:import
  mutav-pulse` to update; never edit vendored files). Use the **`impeccable`**
  skill (`.claude/skills/impeccable`) for UI. Amber `#E8A020` scarce; copper for
  `/protocol`.
- `adapter-defindex` uses `min_amounts_out=[0]` (no slippage floor) — fine for
  the demo, set a real floor before mainnet (flagged in code).

## Testnet deploy (live, SEP-0056 + realistic-seed — 2026-06-23)

Network: testnet. RPC `https://soroban-testnet.stellar.org`. Underlying USDC SAC:
`CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6` (admin = `pulse-admin`,
so it mints the demo USDC). This deploy runs the **SEP-0056-conformant vault**.

| Contract | ID |
| --- | --- |
| vault | `CAJ2L2JBV3B5JZDOQNAKU6SZSIDB354VFCPRAAXHD5FD73WFXSRWPBMR` |
| policy | `CA7SROLJVJXMPCUG7DLI5EUOWFMYCT2SJSKHXG35PV2I36KXSNA3BTHO` |
| registry | `CCFYHEAI5SBPAE44ZGV5QNDHIMCLZSIMTBT26NBYQDEDMJGPRMB2PAZ6` |
| mock-strategy | `CDULHUYDOO7W3FKHACBC4ER7EMDJMBKZJRKXGT4XTCXGFWMHJKW5RXPJ` |

These are in `frontend/.env.example` (copy to `.env.local`). Admin wallet
(`/protocol` actions): `GBE3QZQSNKZQU7ESFUXFYT5ECZYRM5QM72QW2VKTPHH7TAHFEEPTWED3`
(local key alias `pulse-admin` — keys live in the local `stellar keys` keychain,
not in the repo). Seeded state: ~$50.4k reserve, NAV 1.0084, 4 guarantees
(3 active, 1 lapsed), $420 premiums.

Redeploy + reseed from scratch:
```bash
SOURCE=pulse-admin USDC_SAC=CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6 ./bootstrap.sh
VAULT=<id> POLICY=<id> USDC=CALOXSNQ… ./seed.sh   # restores the realistic demo state
```
After a redeploy, regenerate the vault TS binding (its method surface is baked in):
`stellar contract bindings typescript --network testnet --contract-id <VAULT> --output-dir frontend/bindings/vault --overwrite && (cd frontend/bindings/vault && bun install && bun run build)`, then update `frontend/.env.example` IDs. (policy/registry bindings are unchanged — only the IDs.)

## Run it

```bash
# contracts
cargo test && stellar contract build
# frontend
cd frontend && cp .env.example .env.local && bun install && bun dev   # → /earn
```

Deploy: Vercel team `mutav` (see `frontend/README.md`). Repo:
`mutav-finance/mutav-pulse` (private; collaborators jubscodes + draaujpeg, admin).

## Open TODOs / next

- **Deploy `adapter-defindex` to testnet** against a real DeFindex vault (create
  via their factory — see `docs/defindex-testnet.md`) so `/earn/defi` links to it
  and real yield shows on the dashboard (today the slot uses `mock-strategy`).
- **Live `/protocol` demo polish** — drive sign-guarantee/pay-premium/cover-default
  from the UI and confirm the dashboard moves.
- **Soroswap (XLM swap) + Blend adapters** — same `Strategy` trait; `/earn/defi`
  already lists them as Planned. Add the `max_volatile_bps` cap when the first
  volatile adapter lands.
- **SEP-0056 (Tokenized Vault Standard) conformance** for the vault (rename
  `query_asset`, add convert/preview/max + events; reconcile the async redemption
  queue via `max_withdraw`/`max_redeem`). Design decisions captured in
  `docs/sep0056-conformance-decisions.md` (+ method table in
  `docs/vault-method-surface.md`). **🧪 Provisional — test further this hackathon:**
  the queue-only choice (D2: `withdraw`/`redeem` revert, `max_* = 0`) and the OZ
  `FungibleVault` override ergonomics both need validation — see that doc's
  "Test further on this hackathon" section before locking the spec.
- **Deferred minor cleanups** (non-blocking): `fmtUsd` ICU note; consolidate the
  remaining duplicated inline `Mono` components; client-side queue owner filter;
  document the USDC SAC provenance.
