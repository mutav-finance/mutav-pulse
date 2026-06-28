# DeFindex testnet vault

`adapter-defindex` needs a DeFindex vault address (single USDC asset). Two ways:

1. **Create one via the DeFindex factory** (preferred, self-contained). Resolve the
   current testnet factory id from https://docs.defindex.io and call
   `create_defindex_vault` with: assets = [USDC], an underlying DeFindex strategy
   for USDC, manager = our admin, emergency_manager/fee_receiver = our admin. Record
   the returned vault id and export it as `DEFINDEX_VAULT`.
2. **Use an existing public testnet USDC vault** if DeFindex publishes one — export
   its id as `DEFINDEX_VAULT`.

If neither is available at demo time, set `DEFINDEX_VAULT` empty and the bootstrap
wires `mock-strategy` instead (the adapter + its tests still ship).

## Wiring the adapter

Bringing the adapter up needs **two** setters (both re-applied after any
`upgrade()`):

- `set_vault(defindex_vault)` — the DeFindex vault it invests into.
- `set_controller(vault)` — the reserve vault allowed to call `invest`/`divest`.
  Fail-closed: both methods `require_auth` the controller and trap
  (`controller not set`) until this is wired, so a third party can't force a
  withdrawal.

## Slippage floor

`invest`/`divest` enforce an admin-tunable floor (`max_slippage_bps`, default
**0.5%**) against the vault's own `get_asset_amounts_per_shares` preview — they do
**not** pass `min_amounts_out = [0]`. A withdrawal that prices below the floor
reverts (`DepositSlippageExceeded`/withdraw trap). On a real DeFindex vault this
default is conservative, not characterized — tune via `set_max_slippage_bps` once
real fee/rounding behavior is known.
