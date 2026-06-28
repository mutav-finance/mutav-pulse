#!/usr/bin/env bash
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-deployer}"
ADMIN=$(stellar keys address "$SOURCE")
# Share-token metadata — per-reserve. Each fiat-pegged vault mints a share symboled
# for its currency: SHARE_SYMBOL=MUSD|MBRL|MARS, SHARE_NAME="Mutav <Fiat> Reserve".
SHARE_NAME="${SHARE_NAME:-Mutav Reserve}"
SHARE_SYMBOL="${SHARE_SYMBOL:-mtvR}"

# --- Mode select -------------------------------------------------------------
# Default mode redeploys the original (TESOURO/USDC-underlying) reserve and
# expects USDC_SAC. Set BRL_NATIVE=1 to deploy the BRL-native MBRL reserve
# (cBRL underlying + mock-tesouro yield strategy) per the BRL-native spec.
BRL_NATIVE="${BRL_NATIVE:-}"

make build
dep(){ stellar contract deploy --wasm "target/wasm32v1-none/release/$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }
inv(){ stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }

# -----------------------------------------------------------------------------
# Legacy reserve rename (metadata-only, in-place; address unchanged).
# Guarded behind RENAME_LEGACY=1 so it never fires by accident. Re-labels the
# existing TESOURO-underlying reserve's share token MBRL -> MTESOURO to be honest
# about its denomination. Preserves balances/NAV/seeded state (no redeploy).
#   RENAME_LEGACY=1 LEGACY_VAULT=<existing vault id> bash bootstrap.sh
if [ -n "${RENAME_LEGACY:-}" ]; then
  : "${LEGACY_VAULT:?set LEGACY_VAULT to the existing TESOURO reserve vault id}"
  echo "Renaming legacy reserve share token -> MTESOURO (vault $LEGACY_VAULT)"
  inv "$LEGACY_VAULT" set_token_metadata --name "Mutav TESOURO Reserve" --symbol "MTESOURO"
  echo "RENAMED_LEGACY_VAULT=$LEGACY_VAULT (MBRL -> MTESOURO)"
  exit 0
fi

# -----------------------------------------------------------------------------
# BRL-native MBRL reserve: cBRL underlying + mock-tesouro yield strategy.
if [ -n "$BRL_NATIVE" ]; then
  # Per-reserve metadata defaults for the BRL-native reserve.
  SHARE_NAME="${SHARE_NAME:-Mutav BRL Reserve}"
  SHARE_SYMBOL="${SHARE_SYMBOL:-MBRL}"
  # Liquid cash buffer (bps of total assets) retained against forced-exit cost.
  MIN_LIQUID_BUFFER_BPS="${MIN_LIQUID_BUFFER_BPS:-1000}"
  # Faucet drip params for the cBRL test asset.
  FAUCET_AMOUNT="${FAUCET_AMOUNT:-10000000000}"   # 1000 cBRL @ 7 decimals
  FAUCET_COOLDOWN="${FAUCET_COOLDOWN:-86400}"      # 1 day
  FAUCET_FUND="${FAUCET_FUND:-1000000000000}"      # 100k cBRL minted into faucet

  # Test-asset SAC. A classic asset's SAC address is DETERMINISTIC (derived from
  # code:issuer) — there is no salt and you cannot deploy a second one. So: reuse an
  # explicit BRL_SAC, else reuse the on-chain SAC for this code if it already exists,
  # else deploy it. Idempotent — never dies with "contract already exists".
  BRL_SAC="${BRL_SAC:-}"
  BRL_CODE="${BRL_CODE:-cBRL}"
  if [ -z "$BRL_SAC" ]; then
    CANDIDATE=$(stellar contract id asset --asset "$BRL_CODE:$ADMIN" --network "$NETWORK" 2>/dev/null || true)
    if [ -n "$CANDIDATE" ] && stellar contract invoke --id "$CANDIDATE" --source "$SOURCE" --network "$NETWORK" -- name >/dev/null 2>&1; then
      BRL_SAC="$CANDIDATE"; echo "Reusing existing $BRL_CODE SAC: $BRL_SAC"
    else
      BRL_SAC=$(stellar contract asset deploy --asset "$BRL_CODE:$ADMIN" --source "$SOURCE" --network "$NETWORK")
      echo "Deployed $BRL_CODE SAC: $BRL_SAC"
    fi
  fi

  # Faucet for the test asset, pre-funded by the admin (issuer). SETTLE between the
  # mint and the drip: the drip's simulation reads the faucet balance, which otherwise
  # races RPC propagation of the mint (Error(Contract,#10) "zero balance").
  FAUCET=$(dep faucet.wasm --token "$BRL_SAC" --amount "$FAUCET_AMOUNT" --cooldown_secs "$FAUCET_COOLDOWN")
  inv "$BRL_SAC" mint --to "$FAUCET" --amount "$FAUCET_FUND"
  sleep "${SETTLE_SECS:-6}"
  inv "$FAUCET" drip --to "$ADMIN"   # faucet drip (admin is issuer → holds without a trustline)

  # Core reserve: registry + vault(underlying=cBRL) + policy.
  REGISTRY=$(dep registry.wasm --admin "$ADMIN")
  VAULT=$(dep vault.wasm --admin "$ADMIN" --underlying "$BRL_SAC" --name "$SHARE_NAME" --symbol "$SHARE_SYMBOL")
  POLICY=$(dep policy.wasm --admin "$ADMIN")

  inv "$REGISTRY" set_writer --writer "$POLICY"
  inv "$POLICY" set_vault --addr "$VAULT"
  inv "$POLICY" set_registry --addr "$REGISTRY"
  inv "$POLICY" set_coverage_ratio_bps --bps 10000
  inv "$VAULT" set_policy --policy "$POLICY"

  # TESOURO yield strategy (cBRL-settled). volatile=false -> counts toward the
  # solvency floor; weight 10000 -> the whole surplus flows here.
  MOCK_TESOURO=$(dep mock_tesouro.wasm --admin "$ADMIN" --underlying "$BRL_SAC")
  # Controller must be set BEFORE add_strategy: rebalance/ensure_liquidity call
  # invest/divest, which now require the controlling vault's auth. (audit H1/H4 gate)
  inv "$MOCK_TESOURO" set_controller --addr "$VAULT"
  inv "$VAULT" add_strategy --address "$MOCK_TESOURO" --weight_bps 10000 --volatile false
  inv "$VAULT" set_min_liquid_buffer_bps --bps "$MIN_LIQUID_BUFFER_BPS"

  # Seed a working demo so the deployed reserve demonstrably accrues (NAV > 1.0)
  # without a live keeper. MUST deposit BEFORE accrue: accruing into a 0-supply
  # vault donates value with no shares outstanding and dilutes the first real
  # depositor (the donation-to-empty-vault problem). Sequence: admin deposits ->
  # rebalance deploys the surplus to the adapter -> mint+accrue raises NAV for the
  # now-outstanding shares. Skip with SEED_DEMO=0; a live keeper replaces accrue.
  SEED_DEMO="${SEED_DEMO:-1}"
  if [ "$SEED_DEMO" != "0" ]; then
    SEED_DEPOSIT="${SEED_DEPOSIT:-1000000000}"   # 100 cBRL @ 7 decimals
    SEED_YIELD="${SEED_YIELD:-100000000}"        # 10 cBRL yield (~10% NAV bump)
    inv "$VAULT" deposit --assets "$SEED_DEPOSIT" --receiver "$ADMIN" --from "$ADMIN" --operator "$ADMIN"
    inv "$VAULT" rebalance
    inv "$BRL_SAC" mint --to "$MOCK_TESOURO" --amount "$SEED_YIELD"
    inv "$MOCK_TESOURO" accrue --amount "$SEED_YIELD"
    echo "SEED_DEMO: deposited $SEED_DEPOSIT, accrued $SEED_YIELD -> NAV > 1.0"
  fi

  echo "BRL_SAC=$BRL_SAC"; echo "FAUCET=$FAUCET"
  echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"
  echo "MOCK_TESOURO=$MOCK_TESOURO"; echo "MIN_LIQUID_BUFFER_BPS=$MIN_LIQUID_BUFFER_BPS"
  exit 0
fi

# -----------------------------------------------------------------------------
# Default (original) reserve: USDC-underlying.
: "${USDC_SAC:?set USDC_SAC to the underlying token contract id}"

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
  # Controller must be set BEFORE add_strategy: any subsequent rebalance / remove_strategy
  # / ensure_liquidity triggers invest/divest, whose fail-closed controller read would
  # otherwise trap. (audit H1/H4 gate)
  inv "$ADAPTER" set_controller --addr "$VAULT"
  inv "$VAULT" add_strategy --address "$ADAPTER" --weight_bps 10000 --volatile false
  echo "ADAPTER_DEFINDEX=$ADAPTER (DeFindex vault $DEFINDEX_VAULT)"
else
  # DEFINDEX_VAULT unset -> fall back to the mock-strategy for local/testnet runs.
  # Controller must be set BEFORE add_strategy (see DeFindex branch). (audit H1/H4 gate)
  inv "$MOCK" set_controller --addr "$VAULT"
  inv "$VAULT" add_strategy --address "$MOCK" --weight_bps 10000 --volatile false
  echo "DEFINDEX_VAULT unset -> using mock-strategy slot only"
fi

echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"; echo "MOCK=$MOCK"
