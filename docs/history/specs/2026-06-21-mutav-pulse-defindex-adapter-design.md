> **⚠️ Historical — superseded.** This document predates the **2026-06-27 fiança redesign** and describes an earlier design (single-leg coverage, `premium`/`collect_premium` naming, and/or pre-modular `reserve` monolith / "TGA" branding). Kept as a build-evolution record — it does **not** reflect the shipped contracts. For the current design see [`docs/specs/`](../../specs/), [`docs/whitepaper.md`](../../whitepaper.md), and the contracts.

# mutav-pulse — DeFindex Yield Adapter (Design)

**Date:** 2026-06-21
**Context:** Plan 2 of the `mutav-pulse` build — replace the placeholder
`mock-strategy` with a real yield venue: an `adapter-defindex` that lets the
reserve vault earn on-chain yield by depositing its idle float into a DeFindex
vault, behind the existing `Strategy` trait.
**Status:** Approved design, pending implementation plan
**Builds on:** the modular architecture (`2026-06-21-mutav-pulse-modular-architecture-design.md`).

## Summary

The mutav `vault` already allocates idle reserve capital across `Strategy`
adapters via `rebalance()`. Today the only adapter is `mock-strategy` (capital
sits inert). This adds `adapter-defindex`: the same `Strategy` interface, but
`invest` deposits USDC into a DeFindex vault (earning real yield) and `balance`
reports the live USDC value of the position. Yield lifts `total_assets` →
`nav_per_share` → investor returns and free capital, with no change to the vault
or policy. The reserve stops being dead capital.

Scope: **DeFindex only.** Soroswap and Blend are separate later plans.

## How it's used (unchanged allocator)

```
investor → vault.deposit(USDC)
admin   → vault.rebalance()  ──transfers USDC──▶ adapter-defindex.invest(amount)
                                                      └─▶ DeFindex vault.deposit(invest=true)
yield accrues → adapter.balance() rises → vault.total_assets() rises → NAV ↑
default/redeem → vault.ensure_liquidity → adapter.divest(amount) ──▶ DeFindex withdraw → USDC back to vault
```

The vault calls `invest`/`divest`/`balance` exactly as it does for `mock-strategy`;
it never learns the venue is DeFindex. That is the point of the `Strategy` seam.

## Components

- **`defindex` client interface** — a `#[contractclient(name = "DefindexVaultClient")]`
  added to the shared `interfaces` crate, declaring only the DeFindex vault
  functions the adapter calls. We do NOT depend on DeFindex's crate or import its
  custom return structs; we declare minimal/raw return types (see below).
- **`adapter-defindex`** (cdylib) — implements the existing `strategy::Strategy`
  trait. Holds the DeFindex vault address (set via `set_vault`, per the
  address-wiring lesson) and `underlying` (USDC, from the constructor). Stateless
  beyond those two addresses — its "position" is the df-share balance held in the
  DeFindex vault's own token.
- **`mock-defindex`** (test double) — a minimal tokenized vault mimicking
  DeFindex's `deposit`/`withdraw`/`get_asset_amounts_per_shares`, plus an
  `accrue(amount)` knob to simulate yield. Lets the adapter's share-conversion
  logic be unit-tested in the Soroban test env (no DeFindex wasm there). Real
  DeFindex is exercised only in the testnet demo.

## The DeFindex client interface

Declared from DeFindex's published vault signatures. We need decoded values only
from `withdraw` and `get_asset_amounts_per_shares`; `deposit`'s rich return is
ignored (declared as raw `Val`), so we never import DeFindex's allocation structs.

```rust
use soroban_sdk::{contractclient, Address, Env, Val, Vec};

#[contractclient(name = "DefindexVaultClient")]
pub trait DefindexVault {
    // Returns (amounts, df_shares, allocations); we ignore it (read our share
    // balance from the df-token instead), so capture it as a raw Val.
    fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> Val;
    // Burns df_amount shares; returns the per-asset amounts withdrawn.
    fn withdraw(env: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128>;
    // Converts a df-share amount to per-asset underlying amounts.
    fn get_asset_amounts_per_shares(env: Env, vault_shares: i128) -> Vec<i128>;
}
```

DeFindex functions return `Result<_, ContractError>`; on the Ok path the client
decodes the value shown, and on the Err path the cross-contract call traps —
which correctly fails the adapter call (e.g. a failed deposit fails `invest`).

## Strategy mapping

The DeFindex vault is multi-asset and is itself a SEP-41 token (df-shares). For
a single-USDC vault we use 1-element vectors and asset index `0`.

- **`underlying() -> Address`** — returns the stored USDC address.
- **`invest(amount)`** — the mutav vault has already transferred `amount` USDC to
  this adapter. Call
  `DefindexVaultClient.deposit([amount], [0], adapter_address, true)` (invest=true
  so DeFindex deploys it to yield; `[0]` min = no slippage floor, acceptable for a
  single stablecoin in the demo). The adapter receives df-shares, held as its
  balance in the DeFindex vault's token.
- **`balance() -> i128`** — `let shares = TokenClient(defindex_vault).balance(adapter)`;
  if `shares == 0` return `0`; else `DefindexVaultClient.get_asset_amounts_per_shares(shares)`
  and return element `0` (USDC value, which grows as yield accrues).
- **`divest(amount, to) -> i128`** — convert the requested USDC `amount` to
  df-shares to burn:
  - `shares = TokenClient(defindex_vault).balance(adapter)`; `value = balance()`.
  - if `amount >= value` → `burn = shares` (withdraw everything); else
    `burn = (amount * shares + value - 1) / value` (**ceil** — deliver ≥ amount;
    any excess returns to the vault as available liquidity).
  - `let out = DefindexVaultClient.withdraw(burn, [0], adapter)` → `received = out[0]`.
  - transfer `received` USDC from the adapter to `to`; return `received`.

**Why ceil:** the mutav vault's `ensure_liquidity` asks for a USDC amount and
asserts it received enough. Rounding shares up guarantees the adapter returns at
least `amount`; the tiny excess lands in the vault as free cash, never a shortfall.

## Auth

`invest` calls `deposit` with `from = adapter`, so DeFindex pulls USDC from the
adapter — authorized implicitly because the adapter is the invoking contract in
its own call tree. `divest`/`balance` are reads + the adapter's own withdraw +
its own outbound transfer. No new admin surface; the adapter has only
`set_vault` (admin) + `upgrade`, matching the other contracts.

## Testnet vault sourcing (deploy-time, not adapter logic)

The adapter is vault-address-agnostic; the **bootstrap** supplies the DeFindex
vault address. The plan must resolve, against current DeFindex testnet docs,
either: (a) an existing public testnet USDC vault to point at, or (b) create a
single-USDC DeFindex vault via the DeFindex factory (`create_defindex_vault`
with a USDC asset + an underlying DeFindex strategy + manager = our admin). This
is a deployment/research step, isolated from the adapter contract. If neither is
quickly available on testnet, the demo can fall back to `mock-strategy` while the
adapter + its unit tests still land — the integration code is what matters for
the track.

## Testing

- **Adapter unit tests against `mock-defindex`** (Soroban test env): `invest`
  deposits and the adapter holds shares; `balance` reflects deposited value and
  rises after `mock-defindex.accrue` (yield); `divest` of a partial USDC amount
  burns the right shares and returns ≥ the requested amount; `divest` of the full
  value exits cleanly; `balance` is `0` before any invest.
- **Vault integration test**: register the mutav `vault` + `adapter-defindex` +
  `mock-defindex`, `add_strategy(adapter)`, deposit + `rebalance`, accrue yield,
  assert `vault.total_assets()` / `nav_per_share` rise, then `divest` via a
  redemption returns funds — proving the adapter drops into the allocator with no
  vault changes.
- **Testnet demo** (manual): point the adapter at a real DeFindex testnet vault,
  rebalance the reserve into it, observe yield, and pull funds back on a default.

## Non-goals

- Soroswap (XLM swap) and Blend adapters — separate plans.
- Multi-asset DeFindex vaults — we target a single-USDC vault (1-element vectors).
- Slippage/oracle hardening — `[0]` min amounts are acceptable for a single
  stablecoin in the demo; a production version would set real `amounts_min`.
- Auto-invest-on-deposit in the mutav vault — allocation stays admin-triggered via
  `rebalance()`.
