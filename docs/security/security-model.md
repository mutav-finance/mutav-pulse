# Security model

The authority rules, invariants, and structural defenses that let mutav-pulse enforce solvency trust-minimized on Soroban.

## The safety spine — three authority rules

All custody and underwriting authority reduces to three rules, each enforced on-chain:

1. **Money moves only through the `vault`.** `disburse` and `collect_fee` are callable only by the registered `policy` contract (`policy.require_auth()` inside each). No other contract or account can move reserve funds.
2. **Guarantee data is written only by the `policy`.** The `registry` is writer-gated — `put` requires the registered writer (`set_writer` → the policy). The registry is data-only; it never moves money.
3. **Solvency is enforced at the `vault`.** Every payout and every redemption is checked against `stable_assets ≥ coverage_required` (see [solvency & coverage](../concepts/solvency-and-coverage.md)).

Cross-contract wiring is **setter-based**, never constructor-baked (`set_policy` / `set_vault` / `set_registry` / `set_writer`, plus `add_strategy`). The one immutable is the vault's `underlying` asset. This is what lets the underwriting model be swapped without moving funds.

## Re-entrancy-safe solvency (the witness)

The core technical problem: the vault must enforce the solvency floor on `disburse`, but the floor (`coverage_required`) is computed by the `policy` — and during a default the `policy` is already on the call stack, so the vault **cannot** call back into it (Soroban forbids the re-entrant `vault → policy` call).

The protocol resolves this with a **policy-attested witness** instead of a callback:

```rust
// vault::disburse(to, amount, coverage_after)
let stable_pre = stable_assets_inner(&e);
assert!(stable_pre >= amount, "disburse overdraft");
assert!(stable_pre - amount >= coverage_after, "disburse breaches solvency");
```

The `policy` decrements the guarantee's coverage in the registry **first**, recomputes `coverage_required()` *after* the decrement, and passes that value as `coverage_after`. The vault enforces the floor against `stable_pre` — a value it already holds — so it never re-enters the in-progress policy frame. The witness is trustworthy because `disburse` requires `policy.require_auth()`: only the admin-wired policy can produce a `coverage_after`.

**Residual (accepted):** the vault trusts `coverage_after` blindly — a buggy-but-honest policy could understate it. This is the documented tradeoff of avoiding the re-entrant read. Exercised by the full default-path system test (`contracts/policy/src/test_system.rs`).

## Fail-closed by construction

- **Synchronous withdrawals are disabled.** SEP-0056 `withdraw`/`redeem` revert and `max_withdraw`/`max_redeem` return `0`. The standard write surface moves no funds at all — redemptions go only through the surplus-gated async queue.
- **Adapter auth is fail-closed.** The DeFindex adapter's `invest`/`divest` require the registered controller and trap (`controller not set`) until wired, so a third party cannot force a withdrawal or realize slippage.
- **Reserved claims are netted.** `available_held` subtracts escrowed claim funds, so deploy/rebalance never spend claim escrow.

## Re-entrancy lock

A shared lock (`acquire_lock` / `release_lock`, on `DataKey::Locked`) guards **every** adapter-callout money path — `rebalance`, `process_redemptions`, `disburse`, `collect_fee` — so a malicious or buggy strategy reached mid-payout cannot re-enter another vault money path. Centralized in one helper so a new money path cannot silently omit it.

## Share-token integrity

The share token uses a **virtual offset** (`VIRTUAL_OFFSET = 1`) on all convert/preview math — the standard ERC-4626 anti-inflation (donation-attack) defense, so a first depositor cannot be front-run by a direct token donation that skews NAV. Shares are per-currency (`MUSD` for the USD reserve); NAV anchors to `total_assets = cash + Σ strategy.balance()`, not idle balance. See [vault & shares](../concepts/vault-and-shares.md).

## Upgrade authority

Every deployed contract (`vault` / `policy` / `registry` / `adapter-defindex`) has an admin-gated `upgrade(wasm_hash)`. In-place upgrade requires a preserved storage layout; layout-changing edits require redeploy + re-wire via `bootstrap.sh`. Admin authority is a single key for the pilot.

## What this is not

mutav-pulse is a hackathon **proof of concept** on testnet — **not audited**, and **not** the production `mutav-stellar` Fund (which is separately audited). See [testing & audits](./testing-and-audits.md) for coverage and the hardening that remains before any mainnet path, and the [threat model](./threat-model.md) for the attack-surface analysis.
