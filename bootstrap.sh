#!/usr/bin/env bash
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"
ADMIN=$(stellar keys address "$SOURCE")
: "${USDC_SAC:?set USDC_SAC to the underlying token contract id}"
# Share-token metadata — per-reserve. Each fiat-pegged vault mints a share symboled
# for its currency: SHARE_SYMBOL=MUSD|MBRL|MARS, SHARE_NAME="Mutav <Fiat> Reserve".
SHARE_NAME="${SHARE_NAME:-Mutav Reserve}"
SHARE_SYMBOL="${SHARE_SYMBOL:-mtvR}"

make build
dep(){ stellar contract deploy --wasm "target/wasm32v1-none/release/$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }
inv(){ stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }

REGISTRY=$(dep registry.wasm --admin "$ADMIN")
VAULT=$(dep vault.wasm --admin "$ADMIN" --underlying "$USDC_SAC" --name "$SHARE_NAME" --symbol "$SHARE_SYMBOL")
POLICY=$(dep policy.wasm --admin "$ADMIN")
MOCK=$(dep mock_strategy.wasm --underlying "$USDC_SAC")

inv "$REGISTRY" set_writer --writer "$POLICY"
inv "$POLICY" set_vault --addr "$VAULT"
inv "$POLICY" set_registry --addr "$REGISTRY"
inv "$POLICY" set_coverage_ratio_bps --bps 10000
inv "$VAULT" set_policy --policy "$POLICY"

# --- Strategy slot (mutually exclusive) ---
# When DEFINDEX_VAULT is set the reserve flows entirely to the DeFindex adapter at
# weight 10000.  When it is unset the mock-strategy fills that slot instead.
# Never add both: their weights would sum to 20000 and split the reserve 50/50.
if [ -n "${DEFINDEX_VAULT:-}" ]; then
  ADAPTER=$(dep adapter_defindex.wasm --admin "$ADMIN" --underlying "$USDC_SAC")
  inv "$ADAPTER" set_vault --addr "$DEFINDEX_VAULT"
  inv "$VAULT" add_strategy --address "$ADAPTER" --weight_bps 10000 --volatile false
  echo "ADAPTER_DEFINDEX=$ADAPTER (DeFindex vault $DEFINDEX_VAULT)"
else
  # DEFINDEX_VAULT unset -> fall back to the mock-strategy for local/testnet runs.
  inv "$VAULT" add_strategy --address "$MOCK" --weight_bps 10000 --volatile false
  echo "DEFINDEX_VAULT unset -> using mock-strategy slot only"
fi

echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"; echo "MOCK=$MOCK"
