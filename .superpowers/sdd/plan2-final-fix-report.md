# Plan-2 Final-Review Fix Wave — Report

Date: 2026-06-22

## Items applied

### 1 — Slippage comment on `divest` withdraw call (adapter-defindex/src/lib.rs)
Added the required `// min_out=0:` comment block with `TODO(testnet)` on the `withdraw` call inside `divest`. No behavior change.

### 2 — Fold redundant cross-contract read in `divest` (adapter-defindex/src/lib.rs)
Replaced the two-read pattern (`df_shares()` + `balance()` which re-called `df_shares()` internally) with a single read of `shares`, then inline derivation of `value` via `get_asset_amounts_per_shares`. The early-return ordering is now `shares <= 0` then `value <= 0`. Behavior unchanged; saves one cross-contract call per `divest` invocation.

### 3 — Overflow comment on `burn` line (adapter-defindex/src/lib.rs)
Added one-line comment noting `amount * shares` is i128 and overflows only above ~1e19 raw units — unreachable at USDC 7-decimal scale.

### 4 — `supply == 0` guard in mock `withdraw` (mock-defindex/src/lib.rs)
Added `if supply == 0 { return vec![&e, 0]; }` before the division. Defensive; currently unreachable after any deposit.

### 5 — Doc comment + MuxedAddress comment in mock-defindex (mock-defindex/src/lib.rs)
Added top-of-file `//!` module doc stating it is a TEST DOUBLE, never deployed, and intentionally omits `require_auth()`. Added inline comment on integer-truncation share math in `withdraw`. Added comment on the `MuxedAddress` import explaining it is required by the FungibleToken macro.

### 6 — bootstrap.sh single-strategy fix
Restructured so `mock-strategy` is added with `add_strategy` ONLY when `DEFINDEX_VAULT` is unset. When `DEFINDEX_VAULT` is set, only the adapter is added at weight 10000. Added explanatory comment about the mutual exclusivity and the 50/50 split risk. No contract code changed.

### 7 — `balance()` idle-underlying comment (adapter-defindex/src/lib.rs)
Added one-line comment noting that `balance()` reads only df-shares, so the adapter assumes it holds no idle underlying between calls.

## Test results

```
cargo test -p adapter-defindex -p mock-defindex
```

- adapter-defindex: 3 passed (invest_balance_accrue_divest, divest_full_value_exits_cleanly, adapter_drops_into_vault_allocator_and_earns_yield)
- mock-defindex: 1 passed (deposit_accrue_withdraw_share_math)
- Total: 4 tests, 0 failed

## Files changed

- `contracts/adapter-defindex/src/lib.rs` — items 1, 2, 3, 7
- `contracts/mock-defindex/src/lib.rs` — items 4, 5
- `bootstrap.sh` — item 6
- `.superpowers/sdd/plan2-final-fix-report.md` — this file

## Items not completed

None. All 7 items were applied as specified.
