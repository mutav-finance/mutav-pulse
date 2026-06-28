# Vault method surface (SEP-0056 + custom)

The complete `vault` contract method surface after SEP-0056 conformance, with each
method's **standard origin** and **implementation source**. For *why* each choice
was made, see the [decision log](../../security/testing-and-audits.md).

**Impl approach:** the SEP-0056 surface is **hand-rolled on OZ `Base`** (the share
token) reusing OZ's audited `mul_div_with_rounding` for the convert/preview math —
OZ's `FungibleVault` is not used (its `total_assets` is hardcoded to the idle
balance, incompatible with our strategy allocator). Formulas match OZ's `Vault`
(`VIRTUAL_OFFSET = 1`); the only divergences are the `total_assets` source (cash +
strategies) and the disabled synchronous `withdraw`/`redeem` (D2). See the
[decision log](../../security/testing-and-audits.md) for the full rationale.

**Impl-source legend:** **OZ `Base`** = share-token layer used as-is; **audited
math** = our logic, but the arithmetic is OZ's audited `mul_div_with_rounding`;
**hand-rolled** = our logic on `Base`, no OZ analog.

| Method (signature) | Standard | Impl source | Auth | Notes |
|---|---|---|---|---|
| `query_asset() -> Address` | SEP-0056 | hand-rolled | — | reads `DataKey::Underlying`; replaces `underlying()` |
| `total_assets() -> i128` | SEP-0056 | hand-rolled | — | `cash + Σ strategy.balance()`; the NAV anchor (sole divergence from audited math) |
| `total_supply() -> i128` | SEP-0056 | **OZ `Base`** | — | shares token |
| `convert_to_shares(assets) -> i128` | SEP-0056 | audited math | — | floor |
| `convert_to_assets(shares) -> i128` | SEP-0056 | audited math | — | floor |
| `max_deposit(receiver) -> i128` | SEP-0056 | hand-rolled | — | `i128::MAX` |
| `max_mint(receiver) -> i128` | SEP-0056 | hand-rolled | — | `i128::MAX` |
| `max_withdraw(owner) -> i128` | SEP-0056 | hand-rolled | — | returns `0` — synchronous withdrawals disabled (D2) |
| `max_redeem(owner) -> i128` | SEP-0056 | hand-rolled | — | returns `0` — synchronous withdrawals disabled (D2) |
| `preview_deposit(assets) -> i128` | SEP-0056 | audited math | — | floor |
| `preview_mint(shares) -> i128` | SEP-0056 | audited math | — | ceil |
| `preview_withdraw(assets) -> i128` | SEP-0056 | audited math | — | ceil |
| `preview_redeem(shares) -> i128` | SEP-0056 | audited math | — | floor |
| `deposit(assets, receiver, from, operator) -> i128` | SEP-0056 | hand-rolled (audited math + `Base::mint`) | operator | replaces `deposit(from, amount)`; emits `Deposit` |
| `mint(shares, receiver, from, operator) -> i128` | SEP-0056 | hand-rolled (audited math + `Base::mint`) | operator | new; emits `Deposit` |
| `withdraw(assets, receiver, owner, operator) -> i128` | SEP-0056 | hand-rolled | — | **reverts** — synchronous withdrawals disabled; redeem via the queue (D2) |
| `redeem(shares, receiver, owner, operator) -> i128` | SEP-0056 | hand-rolled | — | **reverts** — synchronous withdrawals disabled; redeem via the queue (D2) |
| `balance(id)`, `transfer`, `transfer_from`, `approve`, `allowance`, `decimals`, `name`, `symbol` | SEP-41 (shares) | **OZ `Base`** | holder/spender | standard fungible-token surface for the shares |
| `request_redeem(owner, shares) -> u32` | Custom — queue | hand-rolled; `Base::update` escrow | owner | escrows shares, enqueues |
| `cancel_redeem(id)` | Custom — queue | hand-rolled; `Base::update` | owner | returns escrowed shares |
| `process_redemptions(max_batch)` | Custom — queue | hand-rolled | admin | FIFO from surplus, reentrancy-guarded |
| `claim(id)` | Custom — queue | hand-rolled | owner | transfers fulfilled payout |
| `request(id) -> RedeemRequest` | Custom — queue | hand-rolled | — | view |
| `pending_requests() -> Vec<u32>` | Custom — queue | hand-rolled | — | view |
| `free_capital() -> i128` | Custom — solvency | hand-rolled | — | `max(0, stable_assets − coverage_required)`; gates the redemption queue (`process_redemptions`) |
| `stable_assets() -> i128` | Custom — solvency | hand-rolled | — | cash + non-volatile strategies |
| `available_held() -> i128` | Custom — solvency | hand-rolled | — | cash − reserved-for-claims |
| `nav_per_share() -> i128` | Custom — solvency | hand-rolled | — | frontend convenience (≈ `convert_to_assets(1e7)`) |
| `fee_income() -> i128` | Custom — solvency | hand-rolled | — | cumulative fees collected |
| `disburse(to, amount, coverage_after)` | Custom — `interfaces::Vault` | hand-rolled | policy | default/exit payout; policy-gated. Asserts `stable_pre − amount ≥ coverage_after` (witness-asserted solvency, #38) |
| `collect_fee(from, amount)` | Custom — `interfaces::Vault` | hand-rolled | policy | fee intake; mints no shares (accrues to NAV) |
| `add_strategy(addr, weight_bps, volatile)` | Custom — allocator | hand-rolled | admin | |
| `remove_strategy(addr)` | Custom — allocator | hand-rolled | admin | divests first |
| `strategies() -> Vec<StrategyAlloc>` | Custom — allocator | hand-rolled | — | view |
| `rebalance()` | Custom — allocator | hand-rolled | admin | weight-proportional deploy, clamped to per-strategy caps |
| `min_liquid_buffer_bps() -> u32` / `set_min_liquid_buffer_bps(bps)` | Custom — allocator | hand-rolled | — / admin | liquid cash-buffer target (bps of total assets) |
| `target_idle() -> i128` | Custom — allocator | hand-rolled | — | `total_assets × buffer_bps`; the cash `rebalance` retains |
| `strategy_max_debt_bps(s) -> u32` / `set_strategy_max_debt_bps(s, bps)` | Custom — allocator | hand-rolled | — / admin | per-strategy concentration cap (bps of total) |
| `set_policy(addr)` / `policy() -> Address` | Custom — admin | hand-rolled | admin / — | |
| `set_token_metadata(name, symbol)` | Custom — admin | hand-rolled; `Base::set_metadata` | admin | re-label the share token (per-currency) without redeploy |
| `set_admin(new_admin)` | Custom — admin | hand-rolled | admin | |
| `upgrade(wasm_hash)` | Custom — admin | hand-rolled | admin | |
| `__constructor(admin, underlying, name, symbol)` | Custom — lifecycle | hand-rolled; `Base::set_metadata` | — | sets the per-reserve share name/symbol (e.g. `MUSD`); `underlying` is the one immutable |

## Notes

- **SEP-0056 standard surface** = `deposit`/`mint` (money-in) + the read/preview/
  convert/max functions + `Deposit`/`Withdraw` events. `withdraw`/`redeem` exist
  for conformance but are **disabled** (see below). Everything else is a custom
  extension.
- **Rounding:** conversions and "assets-out / shares-out" previews round **down**
  (floor); "assets-in / shares-in" previews (`preview_mint`, `preview_withdraw`)
  round **up** (ceil), favoring the vault.
- **Synchronous withdrawals are disabled (D2, attack-surface reduction).**
  `withdraw`/`redeem` revert and `max_withdraw`/`max_redeem` return `0` — the
  conformant signal for "withdrawals currently disabled." All redemptions go
  through the async queue (`request_redeem` → `process_redemptions` → `claim`),
  which is the only investor-facing money-out path (besides policy `disburse`).
- **Virtual offset** (`VIRTUAL_OFFSET = 1`) is preserved in every convert/preview
  formula (anti-inflation).
- **Witness-asserted solvency.** `disburse` takes a `coverage_after` floor the
  policy computes *after* it has reduced the guarantee's coverage, and asserts
  `stable_pre − amount ≥ coverage_after` — so the vault enforces solvency without
  re-entering the in-progress policy frame (#38). Both `cover_default` and
  `cover_exit` route through this single `disburse`.
- **Typed liquidity revert.** `ensure_liquidity` reverts with
  `VaultError::InsufficientLiquidity (600)` — not an opaque trap — when a lossy
  strategy can't realize the requested underlying.
- **Reentrancy lock** (`acquire_lock`/`release_lock`) guards every adapter-callout
  money path: `rebalance`, `process_redemptions`, `disburse`, `collect_fee`.
