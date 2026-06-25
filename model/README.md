# MUTAV reserve — economic model

A pure-stdlib Python model of the MUTAV guarantee reserve: **guarantees · coverage ·
premiums · yield · risk**. It mirrors the on-chain mechanics of the `policy` + `vault`
Soroban contracts exactly, and answers the two questions investors and the protocol
team ask: *what does this yield, and what can break it?*

No dependencies. Runs on any Python ≥ 3.9.

```bash
python3 mutav_model.py              # full report (BRL, Sul delinquency) — all 6 sections
python3 mutav_model.py --selftest   # assertions only (CI-friendly)

# sweep the variables
python3 mutav_model.py --currency USD                 # USDC / testnet denomination
python3 mutav_model.py --scenario banda_ate_1k        # worst rent band (stress)
python3 mutav_model.py --months 12 --coverage-ratio 0.5
python3 mutav_model.py --yield 0.135                  # override the currency-pegged yield
```

## What it models (contract-exact)

| Mechanic | Contract source | Model |
|---|---|---|
| Premium per `pay_premium` | `policy.rs:45,66` — `monthly_amount * fee_bps / 10_000` | charged **per period** (period=30d ⇒ monthly) |
| `coverage_required` | `policy.rs:107` — Σ over active **& current** | `c · R · (N − months_used)` |
| `cover_default` | `policy.rs:82-86` — pays one month, caps at `months_covered` | `−R` per default month, `months_used++` |
| Premiums → NAV | premiums mint no shares | accrue to NAV; investor return = premiums **+** yield − defaults |
| `free_capital` | `max(0, stable_assets − coverage_required)` | surplus that may exit/underwrite |

## The two layers

1. **Deterministic** closed-form unit & portfolio economics → the headline APY and its
   decomposition.
2. **Monte Carlo** over a book of guarantees with a **persistent recession regime**
   (two-state Markov) → the tail: investor-APY distribution and the probability of a
   coverage breach in actuarial mode.

## The one formula

```
Investor APY  =  currency risk-free yield  +  underwriting spread
                                               └ (annual premium − annual payout) / capital_locked
```

The **underwriting spread is currency-independent** — it's the protocol's edge over the
local risk-free rate. The base yield is whatever the guarantee's currency pays:
**BRL ≈ 14% (Selic/CDI)** vs **USD ≈ 5.5% (stablecoin DeFi)**. See `Currency` /
`CURRENCIES` in the code.

## Key variables (all tunable)

- `rho` — **monthly stock delinquency** (the headline risk variable, "D"). Grounded in
  real data; see below.
- `currency` — pegs the underlying reserve yield (`BRL` / `USD`), overridable with `--yield`.
- `months_covered` (N) — the coverage cap. The dominant lever on capital efficiency.
- `coverage_ratio` (c) — `1.0` = hard-solvent (breach-proof); `< 1.0` = actuarial leverage.
- `fee_bps` — per-period premium rate (1200 = 12%/period).

## Data sources (delinquency)

`rho` values in `DELINQUENCY` are **monthly point-in-time stock** rates — the share of
active rental contracts **60+ days overdue** — from the **Índice Superlógica** (Jan 2026,
>600k tenants). 60+ dpd is a genuine default trigger, not a few-days-late blip. By Little's
law a stock of `rho` in-default contracts means the reserve covers a `rho` fraction of
rents, so expected monthly payout per guarantee ≈ `rho · R`.

| Scenario | rho | Source |
|---|---|---|
| `sul` | 2.46% | South region — lowest in Brazil |
| `sul_apto` / `sul_casa` | 2.11% / 3.58% | South, by property type |
| `brasil` / `apto_nacional` | 3.29% / 2.15% | national |
| `banda_ate_1k` | 5.43% | worst rent band (≤ R$1.000/mo) — stress anchor |
| `parana` | 5.10% | PR ran hot in 2026 |

See [`../docs/whitepaper.md`](../docs/whitepaper.md) for the full write-up, citations, and
interpretation.

> The numbers in the whitepaper are produced by this script — re-run it to regenerate.
> If you change `CURRENCIES`, `DELINQUENCY`, or the defaults, update the doc to match.
