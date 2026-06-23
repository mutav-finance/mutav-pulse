# Vault method surface (SEP-0056 + custom)

The complete `vault` contract method surface after SEP-0056 conformance, with each
method's **standard origin** and **implementation source**. For *why* each choice
was made, see the [decision log](./sep0056-conformance-decisions.md).

**Decision (D5 + D2):** adopt OZ's `FungibleVault` extension for the share token +
all pure math + deposit/mint settlement, and **override the divergences** —
`total_assets` (→ cash + strategies), `max_withdraw`/`max_redeem` (→ 0), and
`withdraw`/`redeem` (→ revert). Synchronous withdrawals are **disabled** (D2,
attack-surface reduction); redemptions go through the async queue. OZ's vault
methods are overridable defaults that delegate share-price math through
`Self::ContractType::total_assets`, so injecting our `total_assets` keeps
convert/preview/deposit/mint correct. This shrinks our hand-rolled surface to 4
overrides + the async queue, with **no new synchronous money-out path**.
*(Caveat: confirm OZ override ergonomics against the pinned `stellar-tokens`
version; fallback is a pure hand-roll on `Base` — identical external surface.)*

**Impl-source legend:** **OZ** = used as-is from OZ `FungibleVault`/`Base`;
**OZ override** = OZ default replaced with our implementation via the override hook;
**OZ + auth** = OZ settlement wrapped with our `operator.require_auth()`/allowance;
**hand-rolled** = wraps OZ settle with our gate, or fully custom (no OZ analog).

| Method (signature) | Standard | Impl source | Auth | Notes |
|---|---|---|---|---|
| `query_asset() -> Address` | SEP-0056 | **OZ** | — | returns OZ-stored asset; replaces `underlying()` |
| `total_assets() -> i128` | SEP-0056 | **OZ override** | — | → `cash + Σ strategy.balance()`; the NAV anchor |
| `total_supply() -> i128` | SEP-0056 | **OZ `Base`** | — | shares token |
| `convert_to_shares(assets) -> i128` | SEP-0056 | **OZ** | — | floor; correct once `total_assets` injected |
| `convert_to_assets(shares) -> i128` | SEP-0056 | **OZ** | — | floor |
| `max_deposit(receiver) -> i128` | SEP-0056 | **OZ** | — | `i128::MAX` |
| `max_mint(receiver) -> i128` | SEP-0056 | **OZ** | — | `i128::MAX` |
| `max_withdraw(owner) -> i128` | SEP-0056 | **OZ override** | — | returns `0` — synchronous withdrawals disabled (D2) |
| `max_redeem(owner) -> i128` | SEP-0056 | **OZ override** | — | returns `0` — synchronous withdrawals disabled (D2) |
| `preview_deposit(assets) -> i128` | SEP-0056 | **OZ** | — | floor |
| `preview_mint(shares) -> i128` | SEP-0056 | **OZ** | — | ceil |
| `preview_withdraw(assets) -> i128` | SEP-0056 | **OZ** | — | ceil |
| `preview_redeem(shares) -> i128` | SEP-0056 | **OZ** | — | floor |
| `deposit(assets, receiver, from, operator) -> i128` | SEP-0056 | **OZ + auth** | operator | replaces `deposit(from, amount)`; emits `Deposit` |
| `mint(shares, receiver, from, operator) -> i128` | SEP-0056 | **OZ + auth** | operator | new; emits `Deposit` |
| `withdraw(assets, receiver, owner, operator) -> i128` | SEP-0056 | **OZ override** | — | **reverts** — synchronous withdrawals disabled; redeem via the queue (D2) |
| `redeem(shares, receiver, owner, operator) -> i128` | SEP-0056 | **OZ override** | — | **reverts** — synchronous withdrawals disabled; redeem via the queue (D2) |
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
