# MUTAV Reserve — Economic Model

**Guarantees · Coverage · Premiums · Yield · Risk**

**Date:** 2026-06-23 · **Status:** working model (hackathon)
**Companion model:** [`model/mutav_model.py`](../model/mutav_model.py) — every number in
this document is produced by that script (`python3 model/mutav_model.py`). Re-run to
regenerate.

---

## 1. Summary

MUTAV is an on-chain *fiador institucional*: a solvency-gated, tokenized reserve that
backs rental guarantees, pays tenant defaults, and earns yield on its idle float. This
document models the unit economics of one guarantee and of a reserve full of them, then
stress-tests the floor against correlated default waves.

The result reduces to one sentence:

> **Investor APY = the guarantee currency's risk-free yield + a currency-independent
> underwriting spread of ≈ 19%.**

The protocol's edge over a plain Tesouro/CDI position is the **underwriting spread** —
premiums collected minus defaults paid, per unit of capital locked. The base rate it
rides on is whatever the guarantee's currency pays. The business makes money on premiums;
the reserve's job is the **tail, not the average**.

---

## 2. The standard product

| Parameter | Symbol | Value | Note |
|---|---|---|---|
| Monthly rent | `R` | 1,000 | `monthly_amount`, in the guarantee's currency |
| Coverage cap | `N` | **6 months** | `months_covered` — the standard product |
| Premium rate | `f` | **12%/period** | `fee_bps = 1200`, charged **per `pay_premium`** (period = 30d) |
| Coverage ratio | `c` | 1.00 | hard-solvent floor; `< 1.0` is "actuarial mode" |
| Underlying yield | `s` | **currency-pegged** | BRL ≈ 14%, USD ≈ 5.5% (§5) |

**Contract-exact mechanics** (`policy/src/lib.rs`):

- **Premium** charged on each `pay_premium` = `monthly_amount × fee_bps / 10_000`,
  extending `paid_until` by one `period_secs`. So `fee_bps` is a **per-period** rate. With
  a 30-day period that is `R × 12% = 120` per month, ≈ **1,461/yr** (12.17 periods).
- **Coverage required** (the floor) = Σ over active **and premium-current** guarantees of
  `c × monthly_amount × (months_covered − months_used)`. A fresh guarantee locks
  `c · R · N = 6,000`.
- **`cover_default`** pays exactly **one** `monthly_amount` per call, increments
  `months_used`, and halts at `months_used == months_covered`. The reserve's maximum
  loss on any guarantee is therefore `R · N = 6,000` — exactly the capital it locked.
- **Premiums mint no shares**; they accrue to NAV. So **investor return = premiums +
  yield − defaults**, not yield alone.

> ⚠️ **Frontend label bug to fix:** the `/protocol` "Sign Guarantee" form labels Fee (bps)
> as *"Annual premium in basis points (500 = 5%)"* (`frontend/app/protocol/page.tsx:584`).
> The contract charges `fee_bps` **per period**, not per year. At 30-day periods, 500 bps =
> 5%/month ≈ 60%/yr, not 5%/yr. The operator must set `fee_bps` as the per-period rate.

---

## 3. Default risk — grounded in real data

The risk input is **`rho`, the monthly stock delinquency rate**: the share of active
rental contracts **60+ days overdue** at a point in time. Source: the **Índice Superlógica**
(Jan 2026, >600,000 tenants nationwide; "inadimplência" defined as *boletos* 60+ days
unpaid). 60+ dpd is a real default trigger — the regime a guarantee exists to cover —
not a few-days-late blip.

**Why a stock rate is the right input.** By Little's law, a steady-state stock of `rho`
contracts-in-default means the reserve covers, on average, a `rho` fraction of all rents.
So **expected monthly payout per guarantee ≈ `rho × R`**, and annual ≈ `12 · rho · R`. No
separate "frequency × severity" guess is needed — the published stock already embeds both.

| Scenario | `rho` (monthly) | Context |
|---|---|---|
| **South region** | **2.46%** | lowest in Brazil — MUTAV's launch market |
| South, apartments | 2.11% | cleanest segment |
| South, houses | 3.58% | |
| National | 3.29% | Brazil average |
| National, apartments | 2.15% | |
| **≤ R$1.000/mo band** | **5.43%** | worst rent band — our **stress anchor** |
| Paraná (2026) | 5.10% | a state that ran hot — regional stress |

Sources: [Índice Superlógica — Jan 2026 (STG News)](https://stgnews.com.br/inadimplencia-de-aluguel-comeca-2026-em-queda-aponta-indice-superlogica/),
[RS 2025 close (Gazeta)](https://www.gaz.com.br/inadimplencia-de-aluguel-no-rio-grande-do-sul-fecha-2025-em-alta/),
[Sul é a menor do país (ND Mais)](https://ndmais.com.br/economia/inadimplencia-de-alugueis-cresce-em-sc-mas-segue-abaixo-da-media-nacional-aponta-pesquisa/),
[PR sobe (Bem Paraná)](https://www.bemparana.com.br/noticias/economia/inadimplencia-no-aluguel-no-parana-sobe-pelo-segundo-mes-seguido/).

> **Segment note.** A 1,000-unit rent in BRL (~R$5k) sits in a *low*-delinquency band; the
> ≤R$1.000 band (5.43%) is a different, riskier segment we model only as a stress. Default
> screening keeps a book near the `sul_apto` end (2.11%).

---

## 4. Unit economics — one guarantee

Per `R = 1,000`, `N = 6`, `f = 12%`, `c = 1.0`, base yield `s` currency-pegged.

```
capital locked   = c · R · N                    = 6,000
annual premium   = 12.17 · f · R                ≈ 1,461
annual payout    = 12 · rho · R   (rho = 2.46%) ≈   295
net underwriting = premium − payout             ≈ 1,166
underwriting spread = net / capital_locked      ≈ 19.4%   ← currency-independent
```

Across the data scenarios (BRL, `s = 14%`):

| Scenario | `rho` | premium | exp. payout | net u/w | + yield | **APY** | loss ratio | cushion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| South | 2.46% | 1,461 | 295 | 1,166 | 840 | **33.4%** | 20.2% | 4.9× |
| South apt | 2.11% | 1,461 | 253 | 1,208 | 840 | **34.1%** | 17.3% | 5.8× |
| National | 3.29% | 1,461 | 395 | 1,066 | 840 | **31.8%** | 27.0% | 3.7× |
| ≤R$1k band | 5.43% | 1,461 | 652 | 809 | 840 | **27.5%** | 44.6% | 2.2× |

**Cushion** = break-even delinquency ÷ actual. Underwriting turns negative only when
`rho > f` (premium rate), i.e. **above ≈ 12.2% monthly stock delinquency** — a 5× cushion
over the South's 2.46%, and still 2.2× even in the worst rent band. The premium is
generously priced against real Brazilian default rates; the loss ratio (payout ÷ premium)
runs 17–45%, healthy by any insurer's standard.

---

## 5. Currency-pegged yield — BRL vs USD

The underlying yield is **not a universal constant**. A guarantee written in BRL is backed
by a BRL reserve in CDI/Selic-yielding instruments (or tokenized Tesouro); a USD guarantee
is backed by USDC earning stablecoin DeFi yield. So `s` **pegs to the guarantee's currency**.
APY decomposes cleanly:

| Currency | risk-free yield | + u/w spread | = **nominal APY** | − inflation | **real APY** |
|---|---:|---:|---:|---:|---:|
| **BRL** | 14.00% | 19.43% | **33.4%** | 4.50% | **27.7%** |
| **USD** | 5.50% | 19.43% | **24.9%** | 2.50% | **21.9%** |

The **spread is identical across currencies** — the protocol adds the same ≈19pp of
underwriting edge whether it rides Selic or a stablecoin. BRL simply starts from a higher
base. A BRL investor's *alternative* is buying Tesouro at ~14%; MUTAV offers that **plus**
the underwriting spread, in the same currency, with on-chain solvency proof.

> Nominal vs real: BRL's 14% carries ~4.5% inflation and FX drift; a USD investor sees a
> lower nominal but comparable *real* return. A multi-currency reserve is modeled as
> **segregated per-currency sub-vaults**, each backed by and yielding its own currency —
> never cross-subsidized, so no FX risk leaks into the solvency floor.

---

## 6. The `months_covered` (N) lever

`N` is the dominant knob on capital efficiency — the same ≈1,166 net underwriting profit
rides on `R · N` of locked capital (BRL, base `rho`):

| `N` | capital locked | + yield | total | **APY** |
|---|---:|---:|---:|---:|
| 3 mo | 3,000 | 420 | 1,586 | **52.9%** |
| **6 mo (standard)** | **6,000** | 840 | 2,006 | **33.4%** |
| 12 mo | 12,000 | 1,680 | 2,846 | 23.7% |
| 30 mo (full lease) | 30,000 | 4,200 | 5,366 | 17.9% |

Lower `N` → less capital locked per guarantee → higher APY, **but** a weaker promise to
the landlord (the guarantee stops paying at `months_used == N`). **N = 6 is the deliberate
choice**: it covers the typical Brazilian eviction window, caps the reserve's per-guarantee
loss at `R · N`, keeps the premium affordable, and funds the headline APY. The product
promise is literally *"up to 6 months of rent covered."* Slow evictions that outrun 6
months are the landlord's tail, and the contract must say so.

---

## 7. Reserve capacity & portfolio

At `c = 1.0`, each standard guarantee needs `R · N = 6,000` of reserve behind it (BRL):

| Reserve | Guarantees | Coverage | Free | Premiums/yr | Payouts/yr | **APY** |
|---|---:|---:|---:|---:|---:|---:|
| 50,000 | 8 | 48,000 | 2,000 | 11,688 | 2,362 | **32.7%** |
| 100,000 | 16 | 96,000 | 4,000 | 23,376 | 4,723 | **32.7%** |
| 1,000,000 | 166 | 996,000 | 4,000 | 242,526 | 49,003 | **33.4%** |

Capital intensity is real: full backing means reserve ≈ total exposure. Scaling the book
requires more reserve, a lower `N`, or actuarial mode (§8).

---

## 8. Actuarial mode — the leverage/safety dial

`coverage_ratio` `c < 1.0` backs each guarantee with less than its full remaining
exposure, levering the **same premiums** over less capital:

| `c` | capital locked | **APY** | floor |
|---|---:|---:|---|
| **1.00** | 6,000 | 33.4% | **hard-solvent — breach-proof by construction** |
| 0.50 | 3,000 | 52.9% | 2× leverage; breaches if a wave exceeds the floor |
| 0.30 | 1,800 | 78.8% | 3.3× leverage; thin floor |

**Why `c = 1.0` is breach-proof.** `cover_default` pays `R` and simultaneously releases
`c · R = R` of the floor, so `stable_assets − coverage_required` is *invariant* under
defaults; premiums and yield only add to it. Even if **every** guarantee defaults to its
full cap at once, total payout = `Σ R·N` = exactly the floor. Insolvency is impossible at
`c ≥ 1.0`. Sub-100% trades that hard guarantee for yield.

A second stabilizer: coverage counts only **premium-current** guarantees. In a real wave,
agencies stop paying → coverage lapses → `cover_default` halts for those → the floor
*releases*. The reserve's true tail exposure is bounded to premium-paying guarantees.

---

## 9. Risk — Monte Carlo tail

A book of 100 standard guarantees over 36 months, with a **persistent recession regime**
(two-state Markov: ~2.5%/mo to enter, mean 8-month duration, 8× default hazard while
active — calibrated so peak simultaneous default stock reaches ~20–34%). 4,000 sims.

**Base case (South delinquency, BRL):**

| Mode | APY mean | APY p05 | APY p01 | worst | **P(breach)** |
|---|---:|---:|---:|---:|---:|
| c = 1.00 | 27.2% | 19.4% | 14.9% | 9.9% | **0.00%** |
| c = 0.50 | 38.1% | 24.4% | 15.8% | 5.4% | **0.00%** |
| c = 0.30 | 50.2% | 30.5% | 16.9% | −1.1% | **0.00%** |

At realistic South default rates, **even aggressive actuarial mode rarely breaches in 3
years** — premiums build a buffer faster than recessions drain it. The floor barely has to
work.

**Stress case (≤R$1k band, `rho` 5.43% — the riskiest segment):**

| Mode | APY mean | APY p05 | APY p01 | worst | **P(breach)** |
|---|---:|---:|---:|---:|---:|
| c = 1.00 | 20.8% | 5.8% | −1.5% | −10.3% | **0.00%** |
| c = 0.50 | 26.1% | −3.9% | −24.5% | −100% | **0.45%** |
| c = 0.30 | 30.8% | −21.1% | −100% | −100% | **7.80%** |

Here the floor earns its keep: actuarial mode at `c = 0.30` breaches in **~8% of recession
paths** and can wipe a fully-packed book; `c = 1.0` stays solvent (negative APY in the bad
tail, but never insolvent). **This is the dial the protocol team owns**: full backing for
the audited/pilot phase; actuarial mode only with a capital buffer, a conservative book,
and eyes open to the tail.

---

## 10. Conclusions

1. **APY = currency risk-free + ≈19% underwriting spread.** The spread is the product; the
   base rate is currency passthrough. BRL (~33% nominal / ~28% real) rides Selic; USD
   (~25% / ~22%) rides stablecoin DeFi.
2. **Premiums dominate; the reserve covers the tail.** Loss ratios of 17–45% and a 2–5×
   break-even cushion mean the book is structurally profitable on underwriting alone,
   before any yield.
3. **N = 6 is a capital-efficiency choice with a named cost** — it caps both the reserve's
   per-guarantee loss and the landlord's protection at 6 months.
4. **`c = 1.0` is armageddon-proof; `c < 1.0` is a deliberate, quantified bet.** At real
   South default rates the floor rarely binds; in the worst segment under recession it
   binds hard. Keep `c = 1.0` for the pilot.

---

### Appendix — reproduce

```bash
cd model
python3 mutav_model.py                 # BRL, South (this document's base case)
python3 mutav_model.py --currency USD  # USD comparison (§5)
python3 mutav_model.py --scenario banda_ate_1k   # stress (§9)
python3 mutav_model.py --selftest      # assertions
```

All figures rounded; see the script for exact values. Parameters (`DELINQUENCY`,
`CURRENCIES`, the standard product, the recession regime) are at the top of
`mutav_model.py` and are the single source of truth — change them there and regenerate.
