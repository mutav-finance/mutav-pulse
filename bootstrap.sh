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

echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"; echo "MOCK=$MOCK"
