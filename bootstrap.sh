#!/usr/bin/env bash
set -euo pipefail

# Requires: stellar CLI, a funded testnet identity named `deployer`.
NETWORK=testnet
SOURCE=deployer
ADMIN=$(stellar keys address "$SOURCE")
RATIO_BPS=10000

echo "Building..."
make build

echo "Deploying a test USDC SAC is out of scope here; export USDC_SAC first." >&2
: "${USDC_SAC:?set USDC_SAC to the underlying token contract id}"

RESERVE=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/reserve.wasm \
  --source "$SOURCE" --network "$NETWORK" \
  -- --admin "$ADMIN" --underlying "$USDC_SAC" --coverage_ratio_bps "$RATIO_BPS")
echo "RESERVE=$RESERVE"

MOCK=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/mock_strategy.wasm \
  --source "$SOURCE" --network "$NETWORK" \
  -- --underlying "$USDC_SAC")
echo "MOCK_STRATEGY=$MOCK"

stellar contract invoke --id "$RESERVE" --source "$SOURCE" --network "$NETWORK" \
  -- add_strategy --address "$MOCK" --weight_bps 10000 --volatile false
echo "Wired mock strategy at 100% (replace with real adapters in Plan 2)."
