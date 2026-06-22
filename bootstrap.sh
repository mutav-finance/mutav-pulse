#!/usr/bin/env bash
set -euo pipefail
NETWORK=testnet
SOURCE=deployer
ADMIN=$(stellar keys address "$SOURCE")
: "${USDC_SAC:?set USDC_SAC to the underlying token contract id}"

make build
dep(){ stellar contract deploy --wasm "target/wasm32v1-none/release/$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }
inv(){ stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }

REGISTRY=$(dep registry.wasm --admin "$ADMIN")
VAULT=$(dep vault.wasm --admin "$ADMIN" --underlying "$USDC_SAC")
POLICY=$(dep policy.wasm --admin "$ADMIN")
MOCK=$(dep mock_strategy.wasm --underlying "$USDC_SAC")

inv "$REGISTRY" set_writer --policy "$POLICY"
inv "$POLICY" set_vault --addr "$VAULT"
inv "$POLICY" set_registry --addr "$REGISTRY"
inv "$POLICY" set_coverage_ratio_bps --bps 10000
inv "$VAULT" set_policy --policy "$POLICY"
inv "$VAULT" add_strategy --address "$MOCK" --weight_bps 10000 --volatile false

# --- DeFindex yield adapter (optional) ---
# export DEFINDEX_VAULT=<a DeFindex testnet vault id> to use real yield.
if [ -n "${DEFINDEX_VAULT:-}" ]; then
  ADAPTER=$(dep adapter_defindex.wasm --admin "$ADMIN" --underlying "$USDC_SAC")
  inv "$ADAPTER" set_vault --addr "$DEFINDEX_VAULT"
  inv "$VAULT" add_strategy --address "$ADAPTER" --weight_bps 10000 --volatile false
  echo "ADAPTER_DEFINDEX=$ADAPTER (DeFindex vault $DEFINDEX_VAULT)"
else
  echo "DEFINDEX_VAULT unset -> using mock-strategy slot only"
fi

echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"; echo "MOCK=$MOCK"
