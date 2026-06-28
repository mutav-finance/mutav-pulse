# Strategy trait + DeFindex adapter

The `Strategy` trait is the uniform interface every yield-venue adapter implements;
`adapter-defindex` is the concrete adapter that deploys idle underlying into a real
DeFindex vault.

The [vault](./vault.md)'s allocator deploys idle underlying into one or more
strategies and reads their value back through this trait. Each strategy settles in
a single underlying asset and is controlled by exactly one reserve/vault. The
DeFindex adapter holds no idle underlying between calls — its position is the
df-shares it holds in the external DeFindex vault, valued via that vault's own
`get_asset_amounts_per_shares` preview. See the [security model](../../security/security-model.md).

## The `Strategy` trait (`contracts/strategy/src/lib.rs`)

| Method (signature) | Access | Notes |
|---|---|---|
| `invest(amount)` | controller | Caller has already transferred `amount` underlying to the strategy; deploy it into the venue. Implementations MUST `require_auth()` the stored controller |
| `divest(amount, to) -> i128` | controller | Withdraw up to `amount` (underlying terms) and transfer it to `to`; returns the amount actually returned. MUST `require_auth()` the controller (an equality-only `to == vault` check is insufficient — it would let a third party force liquidation) |
| `balance() -> i128` | — | Current position value, denominated in the underlying |
| `underlying() -> Address` | — | The underlying asset this strategy settles in |

## DeFindex adapter (`contracts/adapter-defindex/src/lib.rs`)

| Method (signature) | Access | Notes |
|---|---|---|
| `invest(amount)` | controller | `require_auth()`s `controller`. No-op (no cross-contract calls) if `amount <= 0`. Deposits into DeFindex with `amounts_min = [slippage_floor(amount)]` (NOT `[0]`); reads minted df-shares from the token balance, values them via `get_asset_amounts_per_shares`, and traps `DepositSlippageExceeded = 502` if the value is below the floor (audit H5) |
| `divest(amount, to) -> i128` | controller | `require_auth()`s `controller` (audit H1). Computes `burn` shares, requires at least `slippage_floor(expected_out)` out (`min_amounts_out`, NOT `[0]`), withdraws, and transfers the received underlying to `to` |
| `balance() -> i128` | — | df-share balance valued via `get_asset_amounts_per_shares`; `0` if no shares. Assumes no idle underlying held between calls |
| `underlying() -> Address` | — | Reads `DataKey::Underlying` (the one immutable) |
| `controller() -> Address` | — | The controlling Mutav reserve/vault authorized to `invest`/`divest`. FAIL-CLOSED: traps "controller not set" if unset |
| `set_controller(addr)` | admin | Wire the controller (audit H1/H4). MUST be re-invoked after every in-place `upgrade()` (until then `invest`/`divest` trap — safe). Emits a `ctrl_set` event |
| `vault() -> Address` | — | The EXTERNAL DeFindex vault address (distinct from `controller`) |
| `set_vault(addr)` | admin | Wire the external DeFindex vault |
| `max_slippage_bps() -> u32` | — | Withdrawal/deposit slippage tolerance; defaults to `DEFAULT_MAX_SLIPPAGE_BPS` (50 = 0.5%) |
| `set_max_slippage_bps(bps)` | admin | Tune the floor; rejects `> 10_000` (`InvalidSlippageBps = 501`) |
| `set_admin(new_admin)` | admin | Rotate admin |
| `upgrade(wasm_hash)` | admin | In-place wasm swap; layout-preserving |
| `__constructor(admin, underlying)` | — | Seeds `Admin`, the immutable `Underlying`, and `MaxSlippageBps = 50`. Vault/controller are setter-wired after deploy |

### Slippage floor

`slippage_floor(expected) = expected * (10_000 - max_slippage_bps) / 10_000`
(floored), with `expected <= 0` returning `0` and saturating subtraction guarding
an at/over-100% bps value. Both legs share this single admin-tunable mechanism:
`invest` floors the value of the minted df-shares, `divest` floors the realized
withdraw proceeds. This replaces the prior unconditional `[0]` (no floor) on both
sides. The default 0.5% is a conservative SAFETY DEFAULT — real-vault fee/rounding
behavior between the preview and the settled withdraw is unverified; tune via
`set_max_slippage_bps` once characterized.

## Invariants / access

- **Controller-gated money paths (fail-closed).** `invest`/`divest` `require_auth()`
  the stored `controller`, which traps if unset — an upgraded-but-not-yet-wired
  adapter bricks investing rather than allowing any caller (no funds lost). Re-wire
  with `set_controller` after every `upgrade()`.
- **`volatile` is a vault-side flag, not an adapter property.** Whether a strategy
  counts toward `stable_assets` is set per-strategy on the vault at `add_strategy`
  (see [vault](./vault.md)), not in the adapter.
- **Typed external-response errors.** A malformed (empty) DeFindex per-asset vector
  traps `MalformedVaultResponse = 500` instead of an opaque host trap, since the
  `Strategy` trait returns plain `i128` (no `Result`). Adapter errors occupy the
  `5xx` band, clear of registry `2xx` and policy `3xx`.
- **Single immutable.** The adapter's `underlying` is constructor-baked; every
  other connection (`vault`, `controller`) is setter-wired.
