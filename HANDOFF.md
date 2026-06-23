# mutav-pulse — Handoff

Stellar Pulso hackathon testbed for the **mutav SGR** reserve/fund (onchain
rental-guarantee infrastructure). Status as of 2026-06-22: **three plans
complete and on `main`** (modular contracts, DeFindex yield adapter, frontend),
deployed + seeded on testnet, frontend demo-ready.

Read `CLAUDE.md` first (contracts, brand setup, conventions). Design history is
in `docs/specs/` and `docs/plans/` (one spec + plan per phase).

## What's done

1. **Modular contracts** (`contracts/`, Soroban/Rust) — `interfaces` (shared
   `Guarantee` + cross-contract client traits), `registry` (writer-gated store),
   `vault` (custody: OZ-fungible shares, NAV w/ virtual-offset anti-inflation,
   surplus-gated redemption queue, strategy allocator, policy-gated
   `disburse`/`collect_premium`), `policy` (swappable premium-gated underwriting
   brain), `strategy` trait + `adapter-defindex` (real DeFindex yield) +
   `mock-strategy`/`mock-policy`/`mock-defindex` test doubles. ~31 tests pass.
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
