# Spec — BRL-native `MBRL` reserve (testnet simulation) · Sub-project A

**Date:** 2026-06-27  ·  **Status:** approved design, pre-implementation
**Repo:** `mutav-pulse` (throwaway hackathon testbed)

## Context

The live `MBRL` reserve uses **TESOURO as the vault `underlying`**. But a rental
guarantee is a **BRL** liability, while TESOURO is a yield-bearing BRL *treasury
token* (≈ R$1.22, accruing) — so denominating obligations directly in TESOURO
freezes a R$→TESOURO conversion at signing and lets the BRL value of coverage
drift as TESOURO accrues (safe but leaky; the conversion is an off-chain admin
input with no oracle). The economically-correct shape is **BRL-native**: the
`underlying` is a BRL stablecoin, and TESOURO becomes a **yield strategy** the
vault allocates into, marked back to BRL on every read. Then `monthly_amount`,
`coverage_required`, NAV, premiums and `disburse` are all in one BRL unit — no
frozen conversion, no per-claim oracle, no FX leak.

Mainnet infra for this (a real BRL stable + an Etherfuse mint/redeem rail) is
**not ready**, so we **simulate the full BRL-native model on testnet** with mock
stand-ins, structured so the mocks swap for real contracts later with no change
to vault/policy/registry logic.

This builds on the merged-pending buffer fix (`fix/vault-liquidity-buffer`):
`rebalance` re-anchored to total assets + per-strategy `max_debt`. The exit-cost
the TESOURO adapter simulates is what finally makes that buffer load-bearing.

## Scope

**In (Sub-project A):** a *new* BRL-native `MBRL` reserve alongside the existing
one; rename the existing reserve `MBRL`→`MTESOURO`; on-chain **and** frontend.

**Out (Sub-project B, later cycle):** protocol-owned BRL/TESOURO liquidity (LP),
a rate-aware pool, an external arbiter/keeper, the real Etherfuse adapter, a real
mainnet BRL stable. Noted here only so reviewers know where this stops.

## Components

### 1. `cBRL` test asset + faucet
A new testnet classic-asset SAC (`cBRL`, a mock BRL stablecoin) plus a faucet to
mint it — reusing the existing demo-USDC faucet pattern (`contracts/mocks/faucet`,
`lib/onramp.ts`). `cBRL` is the new reserve's immutable `underlying`.

### 2. Rename legacy reserve `MBRL` → `MTESOURO`
The existing TESOURO-underlying reserve is renamed to be honest:
- **Contract:** admin invoke `vault.set_token_metadata("Mutav TESOURO Reserve", "MTESOURO")` — in-place, no redeploy, preserves balances/NAV/seeded state (the existing vault address is unchanged).
- **Frontend:** `lib/reserves.ts` entry → `currency: "MTESOURO"`, `name: "Mutav TESOURO Reserve"`; `depositToken` stays `TESOURO`, `fiatSymbol` `R$`, `unitPriceFiat` `1.22107`, address/contracts unchanged. Update per-currency symbol surfaces (`CurrencyLogo`, etc.).

### 3. `mock-tesouro` strategy adapter (new `contracts/mocks/mock-tesouro` crate)
Implements the `Strategy` trait (`invest`/`divest`/`balance`/`underlying`),
modelled on `contracts/mocks/mock-strategy`. Represents a TESOURO position whose
BRL value is **pushed by a keeper to mirror the real instrument** (not an APY
estimate), with a configurable exit cost.

State: `underlying: Address` (= `cBRL`), `admin: Address`, `value: i128` (BRL
value of the position), `exit_bps: u32` (default 0).

- `invest(amount)` — underlying already transferred in by the vault (trait
  convention); `value += amount`.
- `balance() -> i128` — returns `value` (BRL-denominated position value).
- `accrue(amount)` — admin-gated; `amount` of `cBRL` already transferred into the
  adapter by the keeper (same convention as `invest`); `value += amount`. This is
  the testnet stand-in for "TESOURO NAV rose": the keeper funds + accrues to
  mirror the real value. On mainnet, `balance()` reads the real Etherfuse NAV and
  this manual path goes away.
- `divest(amount, to) -> i128` — `amt = min(amount, value)`;
  `out = amt − amt × exit_bps / 10_000`; transfer `out` `cBRL` to `to`;
  `value −= amt`; return `out`. The withheld `amt − out` stays stranded in the
  adapter (models the spread captured by the market on a forced exit) — so a
  forced unwind costs the reserve real value, which is the point.
- `set_exit_bps(bps)` — admin-gated, `assert bps <= 10_000`.
- `volatile = false` when added to the vault → counts toward the solvency floor
  (TESOURO is a low-risk treasury; the volatile LP comes in Sub-project B).

`ensure_liquidity` already loops on `available_held` and ignores `divest`'s return,
so a haircut simply makes it divest a bit more to cover the shortfall — no vault
change needed.

### 4. New `MBRL` reserve + `bootstrap.sh` wiring
A fresh deploy (the `underlying` is immutable, so this can't be an upgrade):
deploy `registry`, `vault(underlying=cBRL, name="Mutav BRL Reserve", symbol="MBRL")`,
`policy`; wire `set_policy`/`set_vault`/`set_registry`; deploy
`mock-tesouro(underlying=cBRL)`; `vault.add_strategy(mock_tesouro, 10_000, false)`;
`vault.set_min_liquid_buffer_bps(<e.g. 1_000 = 10%>)`; optionally
`vault.set_strategy_max_debt_bps(...)`. Add `cBRL` SAC + faucet deploy and a
`cBRL` faucet drip. `bootstrap.sh` gains env knobs (e.g. `BRL_SAC`,
`MIN_LIQUID_BUFFER_BPS`) following the existing `SHARE_NAME`/`SHARE_SYMBOL` pattern.
Include the legacy `MTESOURO` rename invoke (or document it as a one-off).

### 5. Tests
Add a BRL-native money-path test (vault `test.rs` with a `mock-tesouro`
dev-dependency, mirroring how it uses `mock-strategy`), covering:
deposit `cBRL` → shares at NAV 1.0 → `rebalance` deploys surplus to `mock-tesouro`
(buffer retained) → `accrue` (push yield) → `nav_per_share` rises **in cBRL** →
`request_redeem`/`process_redemptions`/`claim` pays out with the exit haircut
applied via `ensure_liquidity` → buffer holds across repeated rebalances. Plus a
solvency assertion (`stable_assets ≥ coverage_required`, all cBRL) since the
adapter is `volatile=false`. `mock-tesouro` gets its own unit tests
(invest/accrue/divest-haircut/exit-bps bounds).

### 6. Frontend
- `lib/reserves.ts`: rename legacy → `MTESOURO` (see §2); **add** the BRL-native
  `MBRL` entry — `currency: "MBRL"`, `name: "Mutav BRL Reserve"`,
  `depositToken: "cBRL"`, `fiatSymbol: "R$"`, `unitPriceFiat: 1.0`,
  `status: "live"`, `address`/`contracts` = new deploy.
- `lib/config.ts`: add the `cBRL` asset (code/issuer) + faucet config if surfaced.
- Cockpit/earn/reserves pages pick up the new reserve via existing per-reserve
  config (multi-reserve plumbing already exists). Update `CurrencyLogo` / symbol
  maps for `MTESOURO` and `MBRL`. Regenerate bindings only if a surfaced signature
  changed (the new adapter is not called from the frontend).

### 7. Verification
`cargo test` (workspace) · `stellar contract build` · `bun run build` + `bun test`
in `frontend/` · `bootstrap.sh` on testnet (deploy the new reserve + run the
`MTESOURO` rename) · manual smoke: deposit → rebalance → accrue → redeem-with-haircut,
confirming NAV rises in cBRL and the buffer holds.

## Implementation mechanism

Built as a **background dynamic Workflow** (to keep the main session lean and
drift-free), phased and **sequential** (each phase shares the working tree and
builds on the prior):
1. Contracts — `cBRL` faucet asset + `mock-tesouro` crate + workspace `Cargo.toml`.
2. Tests — `mock-tesouro` unit tests + vault BRL-native money-path test; run `cargo test`.
3. `bootstrap.sh` wiring + `MTESOURO` rename invoke.
4. Frontend — `reserves.ts` rename + new `MBRL`, config, symbol surfaces.
5. Verify — `cargo test` + `stellar contract build` + `bun build`/test; report.

Each phase commits; the result lands as a PR. Branch: `feat/mbrl-brl-native-reserve`
(stacked on `fix/vault-liquidity-buffer`).

## Risks / notes
- **Mock fidelity:** `mock-tesouro` is a stand-in; its `accrue`/`exit_bps` are
  keeper-set to mirror reality, not modelled — same trait shape as the real adapter.
- **No FX on-chain:** the `R$`/`unitPriceFiat 1.0` for `cBRL` is display-only; the
  contract stays single-unit (cBRL). The reserve is genuinely BRL-native.
- **Legacy untouched economically:** the `MTESOURO` rename is metadata-only; its
  address, balances, and the shipped demo keep working.
- **Two BRL-flavored reserves** in the list (`MTESOURO`, `MBRL`) is intentional for
  the A/B comparison.
