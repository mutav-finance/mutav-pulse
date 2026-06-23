#!/usr/bin/env bash
# Seed a freshly-bootstrapped deployment with a realistic demo state:
#   reserve ~$50.4k, NAV ~1.0084, 4 guarantees (3 active/current, 1 unpaid/lapsed),
#   $420 premiums accrued to NAV.
#
# Usage (IDs from bootstrap.sh output):
#   VAULT=… POLICY=… USDC=… ./seed.sh
#
# Money is i128 in 1e7 units ($1 = 10_000_000). Re-run after every redeploy.
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
ADMIN="${ADMIN:-pulse-admin}"       # SAC mint admin + policy/vault admin
INVESTOR="${INVESTOR:-pulse-alice}"
AGENCY="${AGENCY:-pulse-agency}"
LANDLORDS=(${LANDLORDS:-land-a land-b land-c land-d})

: "${VAULT:?set VAULT to the deployed vault id}"
: "${POLICY:?set POLICY to the deployed policy id}"
: "${USDC:?set USDC to the underlying SAC id}"

INV_ADDR=$(stellar keys address "$INVESTOR")
AG_ADDR=$(stellar keys address "$AGENCY")
inv(){ stellar contract invoke --id "$1" --source "$2" --network "$NETWORK" --send=yes -- "${@:3}"; }

DEPOSIT=500000000000      # $50,000 investor deposit
MONTHLY=20000000000       # $2,000 monthly guarantee amount
FEE_BPS=700               # 7% -> $140 premium each; 3 paid = $420
MONTHS=6
PERIOD=2592000            # 30 days

echo "→ funding actors with mock USDC"
inv "$USDC" "$ADMIN" mint --to "$INV_ADDR" --amount "$DEPOSIT"   # top up investor
inv "$USDC" "$ADMIN" mint --to "$AG_ADDR"  --amount 10000000000  # $1,000 premium budget

echo "→ investor deposits \$50,000 (SEP-0056 deposit: assets/receiver/from/operator)"
inv "$VAULT" "$INVESTOR" deposit --assets "$DEPOSIT" --receiver "$INV_ADDR" --from "$INV_ADDR" --operator "$INV_ADDR"

echo "→ signing ${#LANDLORDS[@]} guarantees (\$2,000/mo, ${MONTHS}mo, 7% fee)"
for L in "${LANDLORDS[@]}"; do
  LADDR=$(stellar keys address "$L")
  inv "$POLICY" "$ADMIN" sign_guarantee \
    --landlord "$LADDR" --monthly_amount "$MONTHLY" --months_covered "$MONTHS" \
    --fee_bps "$FEE_BPS" --period_secs "$PERIOD"
done

echo "→ paying premiums on guarantees 0,1,2 (=> 3 active/current, \$420; id 3 left lapsed)"
for ID in 0 1 2; do
  inv "$POLICY" "$AGENCY" pay_premium --payer "$AG_ADDR" --id "$ID"
done

echo "✅ seed complete"
echo "   NAV: $(stellar contract invoke --id "$VAULT" --source "$ADMIN" --network "$NETWORK" -- nav_per_share 2>/dev/null)"
echo "   total_assets: $(stellar contract invoke --id "$VAULT" --source "$ADMIN" --network "$NETWORK" -- total_assets 2>/dev/null)"
echo "   coverage_required: $(stellar contract invoke --id "$POLICY" --source "$ADMIN" --network "$NETWORK" -- coverage_required 2>/dev/null)"
