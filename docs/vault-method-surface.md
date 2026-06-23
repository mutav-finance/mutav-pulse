# Vault method surface (SEP-0056 + custom)

The complete `vault` contract method surface after SEP-0056 conformance, with each
method's **standard origin** and **implementation source**. For *why* each choice
was made, see the [decision log](./sep0056-conformance-decisions.md).

**Decision (D5 verified + D2):** OZ's `FungibleVault` extension is **NOT used** —
verification of `stellar-tokens 0.7.2` showed its `total_assets` is hardcoded to
the vault's *idle* balance with no injection point, incompatible with our strategy
allocator (see the decision log's D5 verification outcome). We **hand-roll** the
SEP-0056 surface on OZ `Base` (the share token, already in use), **reusing OZ's
audited arithmetic** `mul_div_with_rounding` + `Rounding` from
`stellar-contract-utils 0.7.2` for the convert/preview math. The formulas are
identical to OZ's `Vault` with `decimals_offset = 0` (our `VIRTUAL_OFFSET = 1`);
the only divergence from the audited reference is the `total_assets` source
(cash + strategies) and the disabled `withdraw`/`redeem` (D2 — synchronous
withdrawals disabled for attack-surface reduction; redeem via the async queue).

**Impl-source legend:** **OZ `Base`** = the share-token layer, used as-is;
**audited math** = hand-rolled, but the arithmetic is OZ's audited
`mul_div_with_rounding`; **hand-rolled** = our logic on `Base` (auth/pull,
`total_assets`, disabled paths, or fully custom — no OZ analog).

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
| `free_capital() -> i128` | Custom — solvency | hand-rolled | — | `max(0, stable_assets − coverage_required)`; gates both redemption paths |
| `stable_assets() -> i128` | Custom — solvency | hand-rolled | — | cash + non-volatile strategies |
| `available_held() -> i128` | Custom — solvency | hand-rolled | — | cash − reserved-for-claims |
| `nav_per_share() -> i128` | Custom — solvency | hand-rolled | — | frontend convenience (≈ `convert_to_assets(1e7)`) |
| `premium_income() -> i128` | Custom — solvency | hand-rolled | — | cumulative premiums |
| `disburse(to, amount)` | Custom — `interfaces::Vault` | hand-rolled | policy | default payout; policy-gated |
| `collect_premium(from, amount)` | Custom — `interfaces::Vault` | hand-rolled | policy | premium intake; mints no shares |
| `add_strategy(addr, weight_bps, volatile)` | Custom — allocator | hand-rolled | admin | |
| `remove_strategy(addr)` | Custom — allocator | hand-rolled | admin | divests first |
| `strategies() -> Vec<StrategyAlloc>` | Custom — allocator | hand-rolled | — | view |
| `rebalance()` | Custom — allocator | hand-rolled | admin | weight-proportional deploy |
| `set_policy(addr)` / `policy() -> Address` | Custom — admin | hand-rolled | admin / — | |
| `set_admin(new_admin)` | Custom — admin | hand-rolled | admin | |
| `upgrade(wasm_hash)` | Custom — admin | hand-rolled | admin | |
| `__constructor(admin, underlying)` | Custom — lifecycle | hand-rolled; `Base::set_metadata` | — | constructor param stays named `underlying` |

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
