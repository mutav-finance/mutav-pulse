# Deploying and wiring

Redeploy and setter-wire every contract from scratch, then restore the demo state.

The only immutable is the vault's `underlying` asset. Every cross-contract link is setter-wired (`set_policy` / `set_vault` / `set_registry` / `set_writer`, plus `add_strategy` / `remove_strategy`), never constructor-baked — this is what lets the monetary model be swapped without moving funds. An in-place `upgrade(wasm_hash)` requires a preserved storage layout; a layout-changing edit needs a fresh redeploy + re-wire.

## Prerequisites

- **Stellar CLI** (`stellar`) configured with a funded testnet key.
- A deployer key registered with `stellar keys` (the scripts default to `SOURCE=deployer`).
- The underlying token SAC id (`USDC_SAC` for the default reserve).

## 1. Deploy and wire — `bootstrap.sh`

`bootstrap.sh` runs `make build`, deploys every contract, and setter-wires them together. The default mode deploys the USDC-underlying reserve.

```bash
USDC_SAC=<usdc-sac-id> bash bootstrap.sh
```

What it wires, in order:

1. Deploys `registry`, `vault` (with `--underlying $USDC_SAC`), `policy`, and the strategy.
2. `registry.set_writer(policy)` — only the policy may write guarantee data.
3. `policy.set_vault(vault)`, `policy.set_registry(registry)`, `policy.set_coverage_ratio_bps(10000)`.
4. `vault.set_policy(policy)` — the policy is the only contract that may move money.
5. Strategy slot: `set_controller(vault)` on the strategy **before** `vault.add_strategy(...)`, then `add_strategy` at weight `10000`, `volatile false`.

The strategy slot is mutually exclusive: when `DEFINDEX_VAULT` is set the reserve flows entirely to the DeFindex adapter; otherwise `mock-strategy` fills the slot. Never wire both — their weights would sum to `20000` and split the reserve 50/50.

On success it prints the deployed ids:

```
REGISTRY=…
VAULT=…
POLICY=…
MOCK=…           # or ADAPTER_DEFINDEX=… when DEFINDEX_VAULT is set
```

Tunable env vars: `NETWORK` (default `testnet`), `SOURCE` (default `deployer`), `SHARE_NAME`, `SHARE_SYMBOL`, `SETTLE_SECS`, `MAX_TRIES`.

> The BRL-native reserve (cBRL underlying + mock-tesouro strategy + faucet) is deployed with `BRL_NATIVE=1 bash bootstrap.sh`. It seeds its own demo book inline (`SEED_DEMO=1` by default).

## 2. Restore demo state — `seed.sh`

`seed.sh` seeds a realistic two-leg demo book against a freshly bootstrapped reserve: an investor deposit, several signed guarantees (each reserving the DEFAULT + EXIT legs, 9× rent), fees paid on most, one left fee-pending. Pass the ids from the bootstrap output.

```bash
VAULT=… POLICY=… BRL_SAC=… [REGISTRY=…] ./seed.sh
```

It is verify-guarded and idempotent — re-run after every redeploy. Optional `CLAIM_DEMO=1` runs a `cover_exit` payout (needs a funded, trustlined landlord). On completion it prints NAV/share, total/stable assets, and coverage required.

## Wiring the DeFindex adapter

The `adapter-defindex` contract invests the reserve surplus into a real DeFindex yield vault. To use it instead of the mock strategy, provide a DeFindex vault address and let `bootstrap.sh` wire the adapter slot.

```bash
DEFINDEX_VAULT=<defindex-vault-id> USDC_SAC=<usdc-sac-id> bash bootstrap.sh
```

### Obtaining a `DEFINDEX_VAULT`

The adapter needs a single-asset (USDC) DeFindex vault. Either:

1. Create one via the DeFindex factory — resolve the current testnet factory id from <https://docs.defindex.io> and call `create_defindex_vault` with `assets = [USDC]`, an underlying USDC strategy, and `manager` / `emergency_manager` / `fee_receiver` set to our admin. Export the returned id as `DEFINDEX_VAULT`.
2. Use an existing public testnet USDC vault if DeFindex publishes one.

If neither is available, leave `DEFINDEX_VAULT` empty and `bootstrap.sh` wires `mock-strategy` instead (the adapter and its tests still ship).

### The two required setters (fail-closed)

`bootstrap.sh` applies both automatically, but they must be **re-applied after any `upgrade()`**:

- `set_vault(defindex_vault)` — the DeFindex vault the adapter invests into.
- `set_controller(vault)` — the reserve vault allowed to call `invest` / `divest`.

Both `invest` and `divest` `require_auth` the controller and trap (`controller not set`) until `set_controller` is wired — fail-closed, so a third party cannot force a withdrawal. The controller must be set **before** `vault.add_strategy`, since a subsequent `rebalance` / `remove_strategy` / `ensure_liquidity` triggers `invest` / `divest`.

### Slippage floor

`invest` / `divest` enforce an admin-tunable floor against the DeFindex vault's own `get_asset_amounts_per_shares` preview — they do **not** pass `min_amounts_out = [0]`. A withdrawal that prices below the floor reverts (`DepositSlippageExceeded` / withdraw trap).

```bash
stellar contract invoke --id <adapter-id> --source deployer --network testnet \
  -- set_max_slippage_bps --bps 50    # 0.5% (the default)
```

The `0.5%` default is conservative, not characterized against real DeFindex fee/rounding behavior — tune it via `set_max_slippage_bps` once that behavior is known.
