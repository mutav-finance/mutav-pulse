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

# --- testnet resilience helpers --------------------------------------------
# Settle between txs, and NEVER blind-retry a non-idempotent op (deposit /
# sign_guarantee / pay_fee). Each is submitted only while an on-chain reading is
# short of its target, with a generous poll after every submit so a landed-but-
# timed-out tx is observed before we'd resubmit it (the double-apply trap).
SETTLE_SECS="${SETTLE_SECS:-6}"
MAX_TRIES="${MAX_TRIES:-6}"
q(){ stellar contract invoke --id "$1" --source "$ADMIN" --network "$NETWORK" -- "${@:2}" 2>/dev/null; }
unq(){ tr -d '"'; }
# Active-guarantee count: prefer the registry active set (exact, ratio-independent);
# else derive from coverage_required (assumes the 1.0 ratio bootstrap wires).
count(){
  if [ -n "${REGISTRY:-}" ]; then
    local a; a=$(q "$REGISTRY" active_ids); a="${a//[^0-9,]/}"
    [ -z "$a" ] && { echo 0; return; }; awk -F, '{print NF}' <<<"$a"
  else
    local c; c=$(q "$POLICY" coverage_required | unq); [ -z "$c" ] && { echo 0; return; }; echo $(( c / PER_GUARANTEE ))
  fi
}
paid_until(){ q "$POLICY" guarantee --id "$1" | grep -o '"paid_until":[0-9]*' | grep -o '[0-9]*$'; }

# Two-leg pilot product (matches model/mutav_model.py + the contracts):
MONTHLY=20000000000       # 2,000 cBRL monthly amount (R)
MONTHS_COVERED=3          # N — DEFAULT (rent-arrears) leg
EXIT_MONTHS=6             # E — EXIT (property-recovery) leg; coverage/guarantee = 9×R
FEE_BPS=1200              # 12%/period (regular tier) -> 240 cBRL fee each
PERIOD=2592000            # 30 days
# Deposit must exceed total reserved coverage = #guarantees × 9 × R before signing.
# 4 × 9 × 2,000 = 72,000 cBRL; deposit 100,000 with headroom for fees.
DEPOSIT=1000000000000     # 100,000 cBRL investor deposit
PER_GUARANTEE=$(( (MONTHS_COVERED + EXIT_MONTHS) * MONTHLY ))   # raw coverage per guarantee (9×R)
NEED=$(( ${#LANDLORDS[@]} * PER_GUARANTEE ))                    # total coverage the book reserves

# Admin IS the cBRL issuer, so it funds the deposit (and fees) by issuance — a
# transfer-out from the issuer mints implicitly. Do NOT mint to the issuer: a classic
# asset cannot mint to its own issuer (Error(Contract,#2) "operation invalid on
# issuer"; the issuer already carries implicit infinite balance).
# Deposit until the vault can cover the whole book. Verify-guarded: re-checks
# stable_assets after each submit (a generous poll) so a landed-but-timed-out
# deposit is never re-applied, and so sign_guarantee's solvency gate (which reads
# stable_assets) never races RPC propagation of the deposit. Idempotent on re-run.
echo "→ admin deposits cBRL until the vault covers the book (verify-guarded; SEP-0056 deposit)"
n=1
while :; do
  s=$(q "$VAULT" stable_assets | unq)
  if [ -n "$s" ] && [ "$s" -ge "$NEED" ] 2>/dev/null; then echo "   ✓ capacity ready (stable_assets=$s ≥ need=$NEED)"; break; fi
  [ "$n" -gt "$MAX_TRIES" ] && { echo "   ✗ deposit/capacity failed (stable_assets=$s need=$NEED)" >&2; exit 1; }
  inv "$VAULT" "$ADMIN" deposit --assets "$DEPOSIT" --receiver "$ADMIN_ADDR" --from "$ADMIN_ADDR" --operator "$ADMIN_ADDR" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do sleep "$SETTLE_SECS"; s=$(q "$VAULT" stable_assets | unq); [ -n "$s" ] && [ "$s" -ge "$NEED" ] 2>/dev/null && break; done
  n=$((n+1))
done

# Sign one guarantee per landlord. Verify-guarded by the active count: we check
# BEFORE each submit and poll AFTER it, so a sign that landed despite a CLI
# timeout is seen (count incremented) and never double-signed.
echo "→ signing ${#LANDLORDS[@]} two-leg guarantees (2,000/mo · N=${MONTHS_COVERED} + E=${EXIT_MONTHS} · 12% fee · 9× reserved each)"
for L in "${LANDLORDS[@]}"; do
  LADDR=$(stellar keys address "$L")
  before=$(count); target=$((before + 1)); n=1
  while [ "$(count)" -lt "$target" ]; do
    [ "$n" -gt "$MAX_TRIES" ] && { echo "   ✗ sign $L failed (active stuck at $(count))" >&2; exit 1; }
    inv "$POLICY" "$ADMIN" sign_guarantee \
      --landlord "$LADDR" --monthly_amount "$MONTHLY" --months_covered "$MONTHS_COVERED" \
      --exit_months "$EXIT_MONTHS" --fee_bps "$FEE_BPS" --period_secs "$PERIOD" >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5; do sleep "$SETTLE_SECS"; [ "$(count)" -ge "$target" ] && break; done
    n=$((n+1))
  done
  echo "   ✓ signed $L (active=$(count))"
done

# Pay fees on 0,1,2; id 3 left pending. Verify-guarded by paid_until advancing,
# so a timed-out pay_fee is observed before any resubmit (no double-payment).
echo "→ paying fees on guarantees 0,1,2 (active/current); id 3 left fee-pending (within grace)"
for ID in 0 1 2; do
  before=$(paid_until "$ID")
  if [ -z "$before" ]; then echo "   ✗ guarantee $ID not found; skipping fee" >&2; continue; fi
  n=1
  while [ "$(paid_until "$ID")" = "$before" ]; do
    [ "$n" -gt "$MAX_TRIES" ] && { echo "   ✗ pay_fee $ID failed" >&2; exit 1; }
    inv "$POLICY" "$ADMIN" pay_fee --payer "$ADMIN_ADDR" --id "$ID" >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5; do sleep "$SETTLE_SECS"; [ "$(paid_until "$ID")" != "$before" ] && break; done
    n=$((n+1))
  done
  echo "   ✓ fee paid on $ID (paid_until $(paid_until "$ID"))"
done

# Optional claim demo — shows the EXIT leg paying out. Needs a trustlined landlord
# to receive cBRL; off by default to keep the basic seed trustline-free.
if [ "${CLAIM_DEMO:-0}" = "1" ]; then
  echo "→ CLAIM_DEMO: cover_exit on guarantee 0 (1,000 cBRL property-recovery draw)"
  inv "$POLICY" "$ADMIN" cover_exit --id 0 --amount 10000000000
fi

echo "✅ seed complete"
echo "   NAV/share:         $(q "$VAULT" nav_per_share)"
echo "   total_assets:      $(q "$VAULT" total_assets)"
echo "   stable_assets:     $(q "$VAULT" stable_assets)"
echo "   coverage_required: $(q "$POLICY" coverage_required)   (= 4 × 9 × 2,000 = 72,000 cBRL @1e7)"
echo "   raw_coverage:      ${REGISTRY:+$(q "$REGISTRY" raw_coverage)}${REGISTRY:-set REGISTRY to query}"
