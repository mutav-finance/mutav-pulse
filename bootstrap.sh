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

# --- testnet resilience helpers --------------------------------------------
# Testnet RPC lags: a deploy can momentarily return empty / "Wasm not found",
# and a tx's effect may not be visible to the *next* tx's simulation for a few
# seconds (the "transfer/balance reads zero" races). So we settle between txs
# and bound-retry transient failures. Idempotent ops (deploys, setters, drip)
# retry freely; NON-idempotent ops (mint/deposit/accrue) go through `await`,
# which submits only while an on-chain predicate is unmet — so a tx that landed
# despite a CLI timeout is never applied twice. Tune via SETTLE_SECS / MAX_TRIES.
SETTLE_SECS="${SETTLE_SECS:-6}"
MAX_TRIES="${MAX_TRIES:-6}"

raw_dep(){ stellar contract deploy --wasm "target/wasm32v1-none/release/$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }
inv(){ stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }
q(){ stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}" 2>/dev/null; }
unq(){ tr -d '"'; }

# Deploy, retrying while stdout (the contract id) comes back empty.
dep(){
  local out n=1
  while :; do
    out=$(raw_dep "$@" 2>/tmp/bootstrap.dep.err) || true
    [ -n "$out" ] && { printf '%s\n' "$out"; sleep "$SETTLE_SECS"; return 0; }
    [ "$n" -ge "$MAX_TRIES" ] && { echo "deploy failed ($1): $(tail -3 /tmp/bootstrap.dep.err)" >&2; return 1; }
    echo "  ↻ deploy $1 retry $n/$MAX_TRIES" >&2; sleep "$SETTLE_SECS"; n=$((n+1))
  done
}

# Retry an idempotent command (setter / drip) until it succeeds; settle after.
retry(){
  local n=1
  until "$@"; do
    [ "$n" -ge "$MAX_TRIES" ] && { echo "  ✗ gave up ($n tries): $*" >&2; return 1; }
    echo "  ↻ retry $n/$MAX_TRIES: $*" >&2; sleep "$SETTLE_SECS"; n=$((n+1))
  done
  sleep "$SETTLE_SECS"
}

# Guarded one-shot for a NON-idempotent op: run OP only while PRED (a function
# name) is unsatisfied, polling on-chain state after each submit so a landed-
# but-timed-out tx is observed before we would ever resubmit it.
#   await <pred-fn> <op...>
await(){
  local pred="$1"; shift; local n=1
  while ! "$pred"; do
    [ "$n" -gt "$MAX_TRIES" ] && { echo "  ✗ $pred never satisfied" >&2; return 1; }
    "$@" >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5; do sleep "$SETTLE_SECS"; "$pred" && break; done
    n=$((n+1))
  done
}

# -----------------------------------------------------------------------------
# Legacy reserve rename (metadata-only, in-place; address unchanged).
# Guarded behind RENAME_LEGACY=1 so it never fires by accident. Re-labels the
# existing TESOURO-underlying reserve's share token MBRL -> MTESOURO to be honest
# about its denomination. Preserves balances/NAV/seeded state (no redeploy).
#   RENAME_LEGACY=1 LEGACY_VAULT=<existing vault id> bash bootstrap.sh
if [ -n "${RENAME_LEGACY:-}" ]; then
  : "${LEGACY_VAULT:?set LEGACY_VAULT to the existing TESOURO reserve vault id}"
  echo "Renaming legacy reserve share token -> MTESOURO (vault $LEGACY_VAULT)"
  retry inv "$LEGACY_VAULT" set_token_metadata --name "Mutav TESOURO Reserve" --symbol "MTESOURO"
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

  # Faucet for the test asset, pre-funded by the admin (issuer). The mint is
  # verify-guarded (await faucet_funded) so a timed-out mint is never double-
  # applied, and we drip only once the faucet balance is on-chain — otherwise the
  # drip's simulation reads a stale zero balance (Error(Contract,#10)).
  FAUCET=$(dep faucet.wasm --token "$BRL_SAC" --amount "$FAUCET_AMOUNT" --cooldown_secs "$FAUCET_COOLDOWN")
  faucet_funded(){ local b; b=$(q "$BRL_SAC" balance --id "$FAUCET" | unq); [ -n "$b" ] && [ "$b" -ge "$FAUCET_FUND" ] 2>/dev/null; }
  await faucet_funded inv "$BRL_SAC" mint --to "$FAUCET" --amount "$FAUCET_FUND"
  retry inv "$FAUCET" drip --to "$ADMIN"   # faucet drip (admin is issuer → holds without a trustline)

  # Core reserve: registry + vault(underlying=cBRL) + policy.
  REGISTRY=$(dep registry.wasm --admin "$ADMIN")
  VAULT=$(dep vault.wasm --admin "$ADMIN" --underlying "$BRL_SAC" --name "$SHARE_NAME" --symbol "$SHARE_SYMBOL")
  POLICY=$(dep policy.wasm --admin "$ADMIN")

  retry inv "$REGISTRY" set_writer --writer "$POLICY"
  retry inv "$POLICY" set_vault --addr "$VAULT"
  retry inv "$POLICY" set_registry --addr "$REGISTRY"
  retry inv "$POLICY" set_coverage_ratio_bps --bps 10000
  retry inv "$VAULT" set_policy --policy "$POLICY"

  # TESOURO yield strategy (cBRL-settled). volatile=false -> counts toward the
  # solvency floor; weight 10000 -> the whole surplus flows here.
  MOCK_TESOURO=$(dep mock_tesouro.wasm --admin "$ADMIN" --underlying "$BRL_SAC")
  # Controller must be set BEFORE add_strategy: rebalance/ensure_liquidity call
  # invest/divest, which now require the controlling vault's auth. (audit H1/H4 gate)
  retry inv "$MOCK_TESOURO" set_controller --addr "$VAULT"
  retry inv "$VAULT" add_strategy --address "$MOCK_TESOURO" --weight_bps 10000 --volatile false
  retry inv "$VAULT" set_min_liquid_buffer_bps --bps "$MIN_LIQUID_BUFFER_BPS"

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
    # Each non-idempotent step is verify-guarded so a timed-out tx is observed on
    # chain, never blind-retried: deposit -> shares minted; rebalance is idempotent;
    # fund the strategy -> its balance grows by SEED_YIELD; accrue -> NAV > 1.0.
    vault_seeded(){ local s; s=$(q "$VAULT" total_supply | unq); [ -n "$s" ] && [ "$s" -gt 0 ] 2>/dev/null; }
    await vault_seeded inv "$VAULT" deposit --assets "$SEED_DEPOSIT" --receiver "$ADMIN" --from "$ADMIN" --operator "$ADMIN"
    retry inv "$VAULT" rebalance
    mock_pre=$(q "$BRL_SAC" balance --id "$MOCK_TESOURO" | unq); mock_pre="${mock_pre:-0}"; mock_target=$((mock_pre + SEED_YIELD))
    mock_funded(){ local b; b=$(q "$BRL_SAC" balance --id "$MOCK_TESOURO" | unq); [ -n "$b" ] && [ "$b" -ge "$mock_target" ] 2>/dev/null; }
    await mock_funded inv "$BRL_SAC" mint --to "$MOCK_TESOURO" --amount "$SEED_YIELD"
    nav_bumped(){ local v; v=$(q "$VAULT" nav_per_share | unq); [ -n "$v" ] && [ "$v" -gt 10000000 ] 2>/dev/null; }
    await nav_bumped inv "$MOCK_TESOURO" accrue --amount "$SEED_YIELD"
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

retry inv "$REGISTRY" set_writer --writer "$POLICY"
retry inv "$POLICY" set_vault --addr "$VAULT"
retry inv "$POLICY" set_registry --addr "$REGISTRY"
retry inv "$POLICY" set_coverage_ratio_bps --bps 10000
retry inv "$VAULT" set_policy --policy "$POLICY"

# --- Strategy slot (mutually exclusive) ---
# When DEFINDEX_VAULT is set the reserve flows entirely to the DeFindex adapter at
# weight 10000.  When it is unset the mock-strategy fills that slot instead.
# Never add both: their weights would sum to 20000 and split the reserve 50/50.
if [ -n "${DEFINDEX_VAULT:-}" ]; then
  ADAPTER=$(dep adapter_defindex.wasm --admin "$ADMIN" --underlying "$USDC_SAC")
  retry inv "$ADAPTER" set_vault --addr "$DEFINDEX_VAULT"
  # Controller must be set BEFORE add_strategy: any subsequent rebalance / remove_strategy
  # / ensure_liquidity triggers invest/divest, whose fail-closed controller read would
  # otherwise trap. (audit H1/H4 gate)
  retry inv "$ADAPTER" set_controller --addr "$VAULT"
  retry inv "$VAULT" add_strategy --address "$ADAPTER" --weight_bps 10000 --volatile false
  echo "ADAPTER_DEFINDEX=$ADAPTER (DeFindex vault $DEFINDEX_VAULT)"
else
  # DEFINDEX_VAULT unset -> fall back to the mock-strategy for local/testnet runs.
  # Controller must be set BEFORE add_strategy (see DeFindex branch). (audit H1/H4 gate)
  retry inv "$MOCK" set_controller --addr "$VAULT"
  retry inv "$VAULT" add_strategy --address "$MOCK" --weight_bps 10000 --volatile false
  echo "DEFINDEX_VAULT unset -> using mock-strategy slot only"
fi

echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"; echo "MOCK=$MOCK"
