# MUTAV reserve — economic model

A pure-stdlib Python model of the MUTAV guarantee reserve: **guarantees · coverage ·
fees · yield · risk**. It mirrors the on-chain mechanics of the `policy` + `vault`
Soroban contracts exactly, and answers the two questions investors and the protocol
team ask: *what does this yield, and what can break it?*

MUTAV is a **fiança** (fiador institucional — Código Civil art. 818+; art. 37-II of
Lei 8.245/91), **not insurance**. The vocabulary is fiança throughout: a **fee**
("taxa de garantia", `pay_fee` / `collect_fee`), never a premium/apólice/sinistro, and
no seguradora. The obligation has **two legs**: cover the rent while the tenant is in
default (the short rent-arrears window) **and** cover the cost of recovering and
restoring the property (eviction, damages, restoration). The fee stream **is** the
default oracle — a fee missed past a grace window *is* a default and triggers the
claim; lapse does **not** release coverage.

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

## Headline (BRL · Sul · c = 1.0)

The standard product is `R = R$1,000/mo` rent · **DEFAULT N = 3mo** + **EXIT E = 6×**
· `fee = 12%/period` (period = 30d) · `coverage_ratio = 1.0`:

- **Capital locked / guarantee: R$9,000** (= `c · R · (N + E)` = 9× monthly rent — the
  max executable obligation).
- **Nominal APY ≈ 23%** (22.95%); **real APY ≈ 17.66%** (BRL inflation 4.50%).
- **Underwriting spread ≈ 9%** (8.95%) — currency-independent.
- **Loss ratio (Sul) ≈ 45%** (44.85%); **cushion 3.7×**.
- **Monte-Carlo P(breach) at c = 1.0: 0.00%** — breach-proof by construction.

## What it models (contract-exact)

| Mechanic | Contract source | Model |
|---|---|---|
| Fee per `pay_fee` | `policy.rs:112-121,207` — `monthly_amount * fee_bps / 10_000` | charged **per period** (period=30d ⇒ monthly) |
| `coverage_required` (two-leg) | `policy.rs:310` — `raw_coverage × ratio`; raw aggregate = Σ DEFAULT + EXIT legs | `c · [ R·(N − months_used) + (R·E − exit_used) ]` |
| `cover_default` (rent-arrears leg) | `policy.rs:226-240` — pays one month, caps at `months_covered` | `−R` per default month, `months_used++` |
| `cover_exit` (property-recovery leg) | `policy.rs:261-270` — pays exit cost up to `R·exit_months` | exit draw `−amount`, `exit_used +=` |
| Fees → NAV | `vault.rs:60,70` — `FeeIncome`; fees mint no shares | accrue to NAV; investor return = fees **+** yield − payouts |
| `free_capital` | `vault.rs:461` — `max(0, stable_assets − coverage_required)` | surplus that may exit/underwrite |
| `disburse` solvency witness | `vault.rs:659` — `disburse(.., coverage_after)`, asserts `stable_pre − amount ≥ coverage_after` | both legs pass `coverage_after` recomputed after their decrement |

## The two layers

1. **Deterministic** closed-form unit & portfolio economics → the headline APY and its
   decomposition.
2. **Monte Carlo** over a book of guarantees with a **persistent recession regime**
   (two-state Markov) → the tail: investor-APY distribution and the probability of a
   coverage breach in actuarial mode.

## The one formula

```
Investor APY  =  currency risk-free yield  +  underwriting spread
                                               └ (annual fee − annual payout) / capital_locked
                  annual payout = DEFAULT leg (≈ rho·R, capped at N) + EXIT leg
```

The **underwriting spread is currency-independent** — it's the protocol's edge over the
local risk-free rate. The base yield is whatever the guarantee's currency pays:
**BRL ≈ 14% (Selic/CDI)** vs **USD ≈ 5.5% (stablecoin DeFi)**. See `Currency` /
`CURRENCIES` in the code.

## Key variables (all tunable)

- `rho` — **monthly stock delinquency** (the headline risk variable, "D"). Drives the
  DEFAULT (rent-arrears) leg. Grounded in real data; see below.
- `currency` — pegs the underlying reserve yield (`BRL` / `USD`), overridable with `--yield`.
- `months_covered` (N) — the **DEFAULT** (rent-arrears) coverage cap; `cover_default`
  draws one month at a time up to N. The dominant lever on capital efficiency.
- `exit_months` (E) — the **EXIT** (property-recovery) coverage cap, a multiple of
  monthly rent; `cover_exit` draws up to `R·E`.
- `coverage_ratio` (c) — `1.0` = hard-solvent (breach-proof); `< 1.0` = actuarial leverage.
- `fee_bps` — per-period fee rate (1200 = 12%/period).

### The exit-cost claim assumption (pending confirmation with Draau)

The DEFAULT leg rides the empirical `rho` regime, but exit severity isn't in that data,
so the EXIT leg is a **stated, tunable modelling input** — surfaced here so it can be
confirmed, not buried:

- `p_exit` = **1.0** — every lease incurs some exit cost (wear/cleanup/restoration).
- `exit_severity` = **0.15** — mean exit draw ≈ `0.15 · 6R` = 0.9R (≈ one month of restoration).
- `lease_months` = **30** — typical Brazilian lease span, used to annualize the exit draw.

The full `R·E` (6×) is reserved regardless of the assumed draw (hard solvency); the
assumption only moves the expected *payout* (and thus APY / loss ratio), not the floor.
**`p_exit` / `exit_severity` / `lease_months` are the values to confirm with Draau.**

> **Deferred (Draau decision):** the **30× monthly-rent LMI** is the *seguro-fiança*
> variant and is **out of scope**. The pilot uses 3× default + 6× exit (9× total); 30×
> would likely force a `c < 1` calibration. Not modelled as the standard product here.

## Data sources (delinquency)

`rho` values in `DELINQUENCY` are **monthly point-in-time stock** rates — the share of
active rental contracts **60+ days overdue** — from the **Índice Superlógica** (Jan 2026,
>600k tenants). 60+ dpd is a genuine default trigger, not a few-days-late blip. By Little's
law a stock of `rho` in-default contracts means the reserve covers a `rho` fraction of
rents, so expected monthly DEFAULT payout per guarantee ≈ `rho · R` (capped at N months).

| Scenario | rho | Source |
|---|---|---|
| `sul` | 2.46% | South region — lowest in Brazil |
| `sul_apto` / `sul_casa` | 2.11% / 3.58% | South, by property type |
| `brasil` / `apto_nacional` | 3.29% / 2.15% | national |
| `banda_ate_1k` | 5.43% | worst rent band (≤ R$1.000/mo) — stress anchor |
| `parana` | 5.10% | PR ran hot in 2026 |

See [`../docs/concepts/economic-model.md`](../docs/concepts/economic-model.md) for the full write-up, citations, and
interpretation.

> The numbers in the whitepaper are produced by this script — re-run it to regenerate.
> If you change `CURRENCIES`, `DELINQUENCY`, or the defaults, update the doc to match.
