#!/usr/bin/env bash
# Seed a freshly-bootstrapped BRL-native reserve with a realistic two-leg demo book:
#   reserve funded, NAV > 1.0 (from bootstrap), N guarantees each reserving BOTH legs
#   (DEFAULT months_covered + EXIT exit_months => 9× rent at the pilot params), fees
#   paid on most (active/current), one left fee-pending (still within grace, coverage
#   reserved). Demonstrates the new fiança ABI: sign_guarantee(.. exit_months ..),
#   pay_fee, and the solvency-gated capacity (sign asserts stable_assets >= coverage).
#
# Admin is the cBRL ISSUER (asset cBRL:ADMIN), so it holds cBRL with NO trustline and
# plays both investor (deposit) and agency (fee payer) — a trustline-free demo book.
# Landlords are plain addresses; the basic seed does NOT disburse to them, so they
# need no trustline. Run the optional claim demo (CLAIM_DEMO=1) only with funded,
# trustlined landlords.
#
# Usage (IDs from `BRL_NATIVE=1 bash bootstrap.sh` output):
#   VAULT=… POLICY=… BRL_SAC=… [REGISTRY=…] ./seed.sh
#
# Money is i128 in 1e7 units (1 cBRL = 10_000_000). Re-run after every redeploy.
set -euo pipefail
NETWORK="${NETWORK:-testnet}"
ADMIN="${ADMIN:-deployer}"             # cBRL issuer + policy/vault admin (from bootstrap)
LANDLORDS=(${LANDLORDS:-land-a land-b land-c land-d})

: "${VAULT:?set VAULT to the deployed vault id}"
: "${POLICY:?set POLICY to the deployed policy id}"
: "${BRL_SAC:?set BRL_SAC to the cBRL underlying SAC id}"

ADMIN_ADDR=$(stellar keys address "$ADMIN")
inv(){ stellar contract invoke --id "$1" --source "$2" --network "$NETWORK" --send=yes -- "${@:3}"; }

# Two-leg pilot product (matches model/mutav_model.py + the contracts):
MONTHLY=20000000000       # 2,000 cBRL monthly amount (R)
MONTHS_COVERED=3          # N — DEFAULT (rent-arrears) leg
EXIT_MONTHS=6             # E — EXIT (property-recovery) leg; coverage/guarantee = 9×R
FEE_BPS=1200              # 12%/period (regular tier) -> 240 cBRL fee each
PERIOD=2592000            # 30 days
# Deposit must exceed total reserved coverage = #guarantees × 9 × R before signing.
# 4 × 9 × 2,000 = 72,000 cBRL; deposit 100,000 with headroom for fees.
DEPOSIT=1000000000000     # 100,000 cBRL investor deposit
MINT=1100000000000        # 110,000 cBRL minted to admin (deposit + fees + buffer)

echo "→ minting cBRL to admin (issuer, no trustline needed)"
inv "$BRL_SAC" "$ADMIN" mint --to "$ADMIN_ADDR" --amount "$MINT"

echo "→ admin deposits 100,000 cBRL (SEP-0056 deposit: assets/receiver/from/operator)"
inv "$VAULT" "$ADMIN" deposit --assets "$DEPOSIT" --receiver "$ADMIN_ADDR" --from "$ADMIN_ADDR" --operator "$ADMIN_ADDR"

echo "→ signing ${#LANDLORDS[@]} two-leg guarantees (2,000/mo · N=${MONTHS_COVERED} + E=${EXIT_MONTHS} · 12% fee · 9× reserved each)"
for L in "${LANDLORDS[@]}"; do
  LADDR=$(stellar keys address "$L")
  inv "$POLICY" "$ADMIN" sign_guarantee \
    --landlord "$LADDR" --monthly_amount "$MONTHLY" --months_covered "$MONTHS_COVERED" \
    --exit_months "$EXIT_MONTHS" --fee_bps "$FEE_BPS" --period_secs "$PERIOD"
done

echo "→ paying fees on guarantees 0,1,2 (active/current); id 3 left fee-pending (within grace)"
for ID in 0 1 2; do
  inv "$POLICY" "$ADMIN" pay_fee --payer "$ADMIN_ADDR" --id "$ID"
done

# Optional claim demo — shows the EXIT leg paying out. Needs a trustlined landlord
# to receive cBRL; off by default to keep the basic seed trustline-free.
if [ "${CLAIM_DEMO:-0}" = "1" ]; then
  echo "→ CLAIM_DEMO: cover_exit on guarantee 0 (1,000 cBRL property-recovery draw)"
  inv "$POLICY" "$ADMIN" cover_exit --id 0 --amount 10000000000
fi

echo "✅ seed complete"
q(){ stellar contract invoke --id "$1" --source "$ADMIN" --network "$NETWORK" -- "$2" 2>/dev/null; }
echo "   NAV/share:         $(q "$VAULT" nav_per_share)"
echo "   total_assets:      $(q "$VAULT" total_assets)"
echo "   stable_assets:     $(q "$VAULT" stable_assets)"
echo "   coverage_required: $(q "$POLICY" coverage_required)   (= 4 × 9 × 2,000 = 72,000 cBRL @1e7)"
echo "   raw_coverage:      ${REGISTRY:+$(q "$REGISTRY" raw_coverage)}${REGISTRY:-set REGISTRY to query}"
