# MUTAV Reserve — Economic Model

**Guarantees · Coverage · Fees · Yield · Risk**

**Date:** 2026-06-23 · **Status:** working model (hackathon)
**Companion model:** [`model/mutav_model.py`](../../model/mutav_model.py) — every number in
this document is produced by that script (`python3 model/mutav_model.py`). Re-run to
regenerate.

---

## 1. Summary

MUTAV is an on-chain *fiador institucional* — a **fiança**, not a *seguradora* (Código Civil
art. 818 e seguintes): a solvency-gated, tokenized reserve that backs rental guarantees,
honours tenant defaults across **two coverage legs** — rent arrears (the **DEFAULT** leg,
drawn by `cover_default`) and the landlord's property-recovery cost (the **EXIT** leg,
drawn by `cover_exit`) — and earns yield on its idle float. This document models the unit
economics of one guarantee and of a reserve full of them, then stress-tests the floor
against correlated default waves.

The result reduces to one sentence:

> **Investor APY = the guarantee currency's risk-free yield + a currency-independent
> underwriting spread of ≈ 9%.**

The protocol's edge over a plain Tesouro/CDI position is the **underwriting spread** —
guarantee fees (the *taxa de garantia*) collected minus claims paid, per unit of capital
locked. The base rate it rides on is whatever the guarantee's currency pays: a BRL
guarantee earns ≈ **22.95% nominal APY** riding a ~14% Selic/CDI base, a USD guarantee
≈ **14.45%** riding a ~5.5% base — the **same ≈9pp spread** in either currency. The
business makes money on the **fee stream**, not the float; the reserve's job is the
**tail, not the average**. And because this is a fiança — no *prêmio*, no *apólice*, no
*sinistro* — the **fee stream itself is the default oracle**: a fee paid on time means
solvent, and a fee missed past a grace window *is* the default that triggers the claim.
There is no separate time-gate, and a lapse never releases coverage.

---

## 2. The standard product

MUTAV is a *fiança* (institutional `fiador`, Código Civil art. 818+; art. 37-II of
Lei 8.245/91), **not** a seguradora — so the product speaks in fiança terms (a **fee /
`taxa de garantia`**, not a *prêmio*; a guarantee, not an *apólice*). The obligation has
**two coverage legs**: a short **default** leg that pays rent while the tenant is in
arrears, and an **exit** leg that pays the cost of recovering and restoring the property at
lease end.

| Parameter | Symbol | Value | Note |
|---|---|---|---|
| Monthly rent | `R` | 1,000 | `monthly_amount`, in the guarantee's currency |
| Default coverage cap | `N` | **3 months** | `months_covered` — rent-arrears leg, drawn via `cover_default` |
| Exit coverage cap | `E` | **6× monthly rent** | `exit_months` — property-recovery leg, drawn via `cover_exit` |
| Capital locked | `R·(N+E)` | **9,000 (9× rent)** | max obligation per guarantee at `c = 1.0` |
| Fee rate | `f` | **12%/period** | `fee_bps = 1200`, charged **per `pay_fee`** (period = 30d) |
| Coverage ratio | `c` | 1.00 | hard-solvent floor; `< 1.0` is "actuarial mode" |
| Underlying yield | `s` | **currency-pegged** | BRL ≈ 14%, USD ≈ 5.5% (§5) |

**Contract-exact mechanics** (`policy/src/lib.rs`):

- **Fee** charged on each `pay_fee` = `monthly_amount × fee_bps / 10_000`, extending
  `paid_until` by one `period_secs`. So `fee_bps` is a **per-period** rate. With a 30-day
  period that is `R × 12% = 120` per month, ≈ **1,461/yr** (12.17 periods). **Fees mint no
  shares**; they accrue to NAV — so **investor return = fees + yield − payouts**, not yield
  alone.
- **Coverage required** (the floor) = Σ over active guarantees of `c ×` the remaining
  obligation, summing **both legs**: the default term `monthly_amount × (months_covered −
  months_used)` **plus** the exit term `monthly_amount × exit_months − exit_used`. A fresh
  guarantee reserves `c · R · (N + E) = 9,000` — the full 9× is held from signing,
  regardless of fee status. The aggregate is **time-gate-free**: a lapsed fee does **not**
  drop a guarantee out of the floor, so coverage is never silently released.
- **`cover_default`** (the rent-arrears leg) pays exactly **one** `monthly_amount` per call,
  increments `months_used`, and halts at `months_used == months_covered`. Its lifetime cap
  is `R · N = 3,000` (3 draws).
- **`cover_exit`** (the property-recovery leg) pays an exit cost up to `monthly_amount ×
  exit_months = 6,000`, increments `exit_used`, and supports **partial / multiple draws**
  (eviction, damages, restoration) against the 6× cap. The reserve's maximum loss on any
  guarantee is therefore `R · (N + E) = 9,000` — exactly the capital it locked.
- **The fee stream *is* the default oracle.** A fee paid within the **grace window**
  (`paid_until + grace ≥ now`) means solvent; a fee **missed past grace** (`paid_until +
  grace < now`) **is** the on-chain default that authorizes `cover_default`. There is **no
  separate time-gate**, and a lapse **triggers** the claim rather than releasing coverage —
  the inverse of an insurance lapse.

> **Exit-cost claim assumption (pending Draau confirmation).** The exit leg's full 6× is
> always *reserved* for solvency, but the *expected* exit-cost payout used in the economics
> (§4, §9) is a stated, tunable modelling input — `p_exit = 1.0` (every lease incurs some
> exit cost), `exit_severity = 0.15`, `lease_months = 30`. These are conservative starting
> values, not measured rates; the frequency/severity pair is **to be confirmed with Draau**.

> **Out of scope: the 30× LMI variant.** The insurance-shaped **30× rent** ceiling
> (seguro-fiança framing) is **not** adopted for the pilot — it sits far above our 9× model
> and is a separate Draau product decision. The pilot stays at 3× default + 6× exit, fully
> backed at `c = 1.0`.

---

## 3. Default risk — grounded in real data

The risk input is **`rho`, the monthly stock delinquency rate**: the share of active
rental contracts **60+ days overdue** at a point in time. Source: the **Índice Superlógica**
(Jan 2026, >600,000 tenants nationwide; "inadimplência" defined as *boletos* 60+ days
unpaid). 60+ dpd is a real default trigger — the regime a guarantee exists to cover —
not a few-days-late blip.

**Why a stock rate is the right input.** By Little's law, a steady-state stock of `rho`
contracts-in-default means the reserve covers, on average, a `rho` fraction of all rents.
So **the DEFAULT (rent-arrears) leg's expected monthly payout per guarantee ≈ `rho × R`**,
and annual ≈ `12 · rho · R`. No separate "frequency × severity" guess is needed for this
leg — the published stock already embeds both. The fee stream doubles as the default
oracle: a missed `pay_fee` past the grace window *is* the default that triggers the claim,
so there is no separate time-gate and a lapse never releases coverage.

**The two coverage legs.** Each guarantee carries two obligations: the **DEFAULT** leg
(up to `N = 3` months of rent arrears, drawn via `cover_default`, governed by the `rho`
above) and the **EXIT** leg (a one-off property-recovery cost of `E = 6×` rent, drawn via
`cover_exit`). Unlike the arrears leg, the EXIT cost is **not** read off the Superlógica
stock — it is a stated, tunable modelling input (`p_exit = 1.0`, `exit_severity = 0.15`,
`lease_months = 30`) that remains **pending confirmation with Draau**. Together the two
legs cap the reserve's exposure at `R · (N + E) = 9×` monthly rent per guarantee — so the
`rho`-driven figures below size the default leg, with the exit leg layered on top per the
unit economics in §4.

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

Per `R = 1,000`, `N = 3` (DEFAULT, rent-arrears), `E = 6` (EXIT, property-recovery),
`f = 12%`, `c = 1.0`, base yield `s` currency-pegged.

```
capital locked     = c · R · (N + E)                        = 9,000
annual fee         = 12.17 · f · R                          ≈ 1,461
default payout     = 12 · rho · R       (rho = 2.46%)       ≈   295   ← DEFAULT leg (cover_default)
exit payout        = R · E · severity · 12 / lease_months   ≈   360   ← EXIT leg (cover_exit)
annual payout      = default + exit                         ≈   655
net underwriting   = fee − payout                           ≈   806
underwriting spread = net / capital_locked                  ≈ 8.95%   ← currency-independent
```

The two legs are funded from the same `taxa de garantia` (fee), not a premium: a fee-miss
past the grace window *is* the default that draws the DEFAULT leg via `cover_default`, and
property-recovery cost draws the EXIT leg via `cover_exit`. Max obligation per guarantee is
`R · (N + E) = 9×` monthly rent.

Across the data scenarios (BRL, `s = 14%`):

| Scenario | `rho` | fee | exp. payout (D+E) | net u/w | + yield | **APY** | loss ratio | cushion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| South | 2.46% | 1,461 | 655 | 806 | 1,260 | **22.95%** | 44.85% | 3.7× |
| South apt | 2.11% | 1,461 | 613 | 848 | 1,260 | **23.42%** | 41.97% | 4.3× |
| National | 3.29% | 1,461 | 755 | 706 | 1,260 | **21.85%** | 51.66% | 2.8× |
| ≤R$1k band | 5.43% | 1,461 | 1,012 | 449 | 1,260 | **18.99%** | 69.24% | 1.7× |

**The exit leg now dominates losses.** Only the DEFAULT leg scales with delinquency
(`12 · rho · R`); the EXIT leg is a flat ≈ 360/yr (it assumes every lease eventually
recovers the property at `exit_severity` of `E` months, amortised over the lease). In the
base South scenario the exit charge (≈ 360) already *exceeds* the default charge (≈ 295) —
i.e. property-recovery cost, not rent arrears, is the larger loss driver — and it only stays
subordinate to defaults once `rho` climbs past the upper rent bands.

**Cushion** = break-even delinquency ÷ actual. Because the flat exit leg is pre-funded out
of the fee, underwriting turns negative once the DEFAULT leg alone exhausts the remaining
fee, i.e. **above ≈ 9.2% monthly stock delinquency** — a 3.7× cushion over the South's
2.46%, and still 1.7× even in the worst rent band. (The single-leg model broke even at
≈ 12.2%; the exit leg consumes part of the fee, lowering the break-even.) The taxa de
garantia is generously priced against real Brazilian default rates; the loss ratio
(payout ÷ fee) runs ≈ 42–69%, a comfortable margin for a fiador institucional carrying a
fully pre-funded reserve.

> **Exit-leg assumption (pending confirmation with Draau).** The EXIT leg is a stated,
> tunable modelling input — `p_exit = 1.0`, `exit_severity = 0.15`, `lease_months = 30` —
> which together produce the flat ≈ 360/yr exit charge (`R · E · severity · 12 / lease_months`
> = `1,000 · 6 · 0.15 · 12 / 30`). These claim assumptions are not yet validated against
> portfolio data and are subject to Draau's sign-off; the 30× LMI (seguro-fiança) variant is
> a separate, deferred Draau decision and out of scope here.

---

## 5. Currency-pegged yield — BRL vs USD

The underlying yield is **not a universal constant**. A guarantee written in BRL is backed
by a BRL reserve in CDI/Selic-yielding instruments (or tokenized Tesouro); a USD guarantee
is backed by USDC earning stablecoin DeFi yield. So `s` **pegs to the guarantee's currency**.
APY decomposes cleanly:

| Currency | risk-free yield | + u/w spread | = **nominal APY** | − inflation | **real APY** |
|---|---:|---:|---:|---:|---:|
| **BRL** | 14.00% | 8.95% | **22.95%** | 4.50% | **17.66%** |
| **USD** | 5.50% | 8.95% | **14.45%** | 2.50% | **11.66%** |

The **spread is identical across currencies** — the protocol adds the same ≈9pp of
underwriting edge whether it rides Selic or a stablecoin. BRL simply starts from a higher
base. A BRL investor's *alternative* is buying Tesouro at ~14%; MUTAV offers that **plus**
the underwriting spread, in the same currency, with on-chain solvency proof.

> Nominal vs real: BRL's 14% carries ~4.5% inflation and FX drift; a USD investor sees a
> lower nominal but comparable *real* return. A multi-currency reserve is modeled as
> **segregated per-currency sub-vaults**, each backed by and yielding its own currency —
> never cross-subsidized, so no FX risk leaks into the solvency floor.

---

## 6. The `months_covered` (N) lever

`N` is the dominant knob on capital efficiency — but it now governs only the **DEFAULT
leg** (rent-arrears, drawn one month at a time via `cover_default`). The **EXIT leg**
(property-recovery, drawn via `cover_exit`) is held fixed at `E = 6×`, so every guarantee
locks `c · R · (N + E)` of reserve and the floor never drops below the exit obligation.
With `E` fixed, the same R$806 net underwriting profit rides on `R · (N + E)` of locked
capital (BRL, base `rho`):

| `N` (default leg) | capital locked | fee | + yield | total | **APY** |
|---|---:|---:|---:|---:|---:|
| **3 mo (standard)** | **9,000** | 1,461 | 1,260 | 2,066 | **22.95%** |
| 6 mo | 12,000 | 1,461 | 1,680 | 2,486 | 20.72% |
| 12 mo | 18,000 | 1,461 | 2,520 | 3,326 | 18.48% |
| 30 mo (full lease) | 36,000 | 1,461 | 5,040 | 5,846 | 16.24% |

Lower `N` → less capital locked per guarantee → higher APY, **but** a weaker rent-arrears
promise to the landlord (the default leg stops paying at `months_used == N`; the 6×
property-recovery leg is unaffected). **N = 3 is the deliberate choice**: it covers the
typical Brazilian rent-arrears window, and combined with the fixed `E = 6×` exit leg it
caps the reserve's per-guarantee obligation at `R · (N + E) = 9,000` — exactly **9× monthly
rent**, the maximum the fiança can owe on any one guarantee. Because the exit leg is always
present, the floor never falls below `R · E = 6,000` even at `N = 0`; that is why the
standard product's capital lock is R$9,000, not R$3,000. The product promise is literally
*"up to 3 months of rent arrears plus property-recovery costs."* Slow evictions whose
arrears outrun 3 months are the landlord's tail, and the contract must say so.

The `N = 30` row is **not** the standard product — it corresponds to the deferred
**seguro-fiança / 30× LMI variant** (full-lease coverage). That variant is out of scope
for this redesign and remains a Draau decision; it is shown here only to bound the lever's
range.

---

## 7. Reserve capacity & portfolio

At `c = 1.0`, each standard guarantee needs `c · R · (N + E) = 9,000` of reserve behind it
— the two coverage legs combined (DEFAULT `N = 3` + EXIT `E = 6`), i.e. up to 9× monthly
rent (BRL):

| Reserve | Guarantees | Coverage | Free | Fees/yr | Payouts/yr | **APY** |
|---|---:|---:|---:|---:|---:|---:|
| 50,000 | 5 | 45,000 | 5,000 | 7,305 | 3,276 | **22.06%** |
| 100,000 | 11 | 99,000 | 1,000 | 16,071 | 7,207 | **22.86%** |
| 500,000 | 55 | 495,000 | 5,000 | 80,355 | 36,036 | **22.86%** |
| 1,000,000 | 111 | 999,000 | 1,000 | 162,171 | 72,727 | **22.94%** |

Capital intensity is real: full backing means reserve ≈ total exposure, and at `9R` per
guarantee that exposure is steep — a R$50,000 reserve underwrites just 5 standard
guarantees. Scaling the book requires more reserve, a lower `N` (§6), or actuarial mode
(§8).

---

## 8. Actuarial mode — the leverage/safety dial

`coverage_ratio` `c < 1.0` backs each guarantee with less than its full remaining
exposure, levering the **same fees** over less capital. Capital locked per guarantee is
`c · R · (N + E)` — at `c = 1.0` that is `R · (3 + 6) = 9R`, i.e. R$9,000 on a
R$1,000/mo lease (the full two-leg obligation: 3 months of rent-arrears + a 6×
property-recovery exit cap).

| `c` | capital locked | **APY** | floor |
|---|---:|---:|---|
| **1.00** | 9,000 | 22.95% | **hard-solvent — breach-proof by construction** |
| 0.50 | 4,500 | 31.91% | 2× leverage; breach if >50% draw the full default window |
| 0.30 | 2,700 | 43.84% | 3.3× leverage; thin floor |

*(Base delinquency, scenario `sul` `rho` 2.46%, `N = 3`, `E = 6`, BRL.)*

**Why `c = 1.0` is breach-proof.** Both payout legs drop NAV and the solvency floor in
**lockstep**. `cover_default` pays one month `R` and simultaneously releases `c · R = R`
of `coverage_required`; `cover_exit` pays an exit cost and releases the matching slice of
the reserved exit cap. So `stable_assets − coverage_required` is *invariant* under either
leg — fees and yield only add to it. Even if **every** guarantee draws its full cap at
once across both legs, total payout = `Σ R · (N + E)` = exactly the floor. Insolvency is
impossible at `c ≥ 1.0`. Sub-100% trades that hard guarantee for yield.

This is enforced on-chain without re-entrancy: the policy reduces `coverage_required`
*before* calling `vault.disburse`, passing the post-decrement coverage as a witness, so
the vault asserts `stable_assets − amount ≥ coverage_after` without ever calling back into
the policy during a default.

A note on the tail, and how it differs from a lapse model. Coverage here is reserved for
the **full life** of every signed guarantee — a missed fee does **not** release it. As a
fiança, the fee stream *is* the default oracle: a fee paid on time means solvent, a fee
missed past the grace window **is** the default that authorizes the claim. Lapse triggers
the payout; it never frees the floor. That makes the floor strictly conservative — the
reserve always holds capital against the entire book, never just the fee-current subset —
which is exactly why the `c = 1.0` invariant above holds unconditionally.

**This is the dial the protocol team owns**: full backing (`c = 1.0`) for the
audited/pilot phase; actuarial mode (`c < 1.0`) only with a capital buffer, a conservative
book, and eyes open to the tail (Section 9).

---

## 9. Risk — Monte Carlo tail

A book of 100 standard guarantees (DEFAULT 3mo + EXIT 6×) over 36 months, with a
**persistent recession regime** (two-state Markov: ~2.5%/mo to enter, mean 8-month
duration, 8× default hazard while active; cure 25%/mo, default stock capped at N;
breakeven stock 9.2%). 4,000 sims. The EXIT leg is modelled as a **lockstep one-time
draw**: when a lease terminates in default, `cover_exit` draws the property-recovery cost
(E = 6× monthly rent) exactly as `cover_default` draws rent arrears — both reduce NAV
*and* `coverage_required` in the same step, so the solvency invariant
`stable_assets >= coverage_required` holds across both legs. Adding the exit leg does not
weaken breach-proofness; it just enlarges the lockstep draw.

**Base case (South delinquency, BRL — peak default stock p95 ~16%):**

| Mode | APY mean | APY p05 | APY p01 | worst | **P(breach)** |
|---|---:|---:|---:|---:|---:|
| c = 1.00 | 22.0% | 17.4% | 15.3% | 13.0% | **0.00%** |
| c = 0.50 | 29.0% | 20.6% | 16.5% | 12.0% | **0.00%** |
| c = 0.30 | 37.3% | 24.6% | 18.2% | 10.7% | **0.00%** |

At realistic South default rates, **even aggressive actuarial mode never breaches in 3
years** — the guarantee-fee stream builds a buffer faster than recessions drain it, and
every mode keeps a positive worst-case APY. The floor barely has to work.

**Stress case (≤R$1k band, `rho` 5.43% — the riskiest segment; peak default stock p95 ~27%):**

| Mode | APY mean | APY p05 | APY p01 | worst | **P(breach)** |
|---|---:|---:|---:|---:|---:|
| c = 1.00 | 18.4% | 11.2% | 8.3% | 5.6% | **0.00%** |
| c = 0.50 | 22.3% | 8.2% | 2.0% | −4.4% | **0.00%** |
| c = 0.30 | 26.9% | 3.9% | −8.0% | −22.4% | **0.07%** |

Here the floor earns its keep: actuarial mode at `c = 0.30` still breaches in **~0.1% of
recession paths** and runs a deeply negative APY in the bad tail; `c = 0.50` survives every
path but turns negative at p05; `c = 1.0` stays solvent throughout — its worst recession
path is still a **positive** APY. **This is the dial the protocol team owns**: full backing
(`c = 1.0`) for the audited/pilot phase — breach-proof by construction, because every
`cover_default` and `cover_exit` drops NAV and the floor in lockstep; actuarial mode only
with a capital buffer, a conservative book, and eyes open to the tail.

---

## 10. Conclusions

1. **APY = currency risk-free + ≈9% underwriting spread.** The spread is the product; the
   base rate is currency passthrough. BRL (~23% nominal / ~18% real) rides Selic; USD
   (~14% / ~12%) rides stablecoin DeFi.
2. **The guarantee-fee stream dominates; the reserve covers the tail — and MUTAV is a
   _fiança_, not insurance.** MUTAV is an institutional guarantor (_fiador institucional_,
   Código Civil art. 818+; art. 37-II of Lei 8.245/91), not a _seguradora_: the fee
   (_taxa de garantia_) stream is itself the default oracle — a fee paid on time means
   solvent, and a fee missed past the grace window _is_ the default that triggers the
   claim. There is no time-gate, and lapse never releases coverage. Loss ratios of
   ~42–69% (≈45% at the South base) and a 1.7–4.3× (3.7× at base) break-even cushion
   mean the book is structurally profitable on underwriting alone, before any yield.
3. **The two coverage legs are a capital-efficiency choice with a named cost.** Each
   guarantee locks `c · R · (N + E) = 9R` (R$9,000 at R = R$1,000, c = 1.0): a 3-month
   rent-arrears leg (`N = 3`) drawn via `cover_default`, plus a 6× property-recovery
   (exit) leg (`E = 6`) drawn via `cover_exit` — capping both the reserve's
   per-guarantee obligation and the landlord's protection at 9 months' rent. The
   exit-cost leg's claim assumptions (`p_exit = 1.0`, `exit_severity = 0.15`,
   `lease_months = 30`) are a stated, tunable modelling input and are **pending
   confirmation with Draau**. The 30× LMI (_seguro-fiança_) variant is deferred and
   out of scope — a Draau product decision.
4. **`c = 1.0` is armageddon-proof; `c < 1.0` is a deliberate, quantified bet.** At real
   South default rates the floor rarely binds; under a persistent recession the
   Monte-Carlo breach probability is **0% at `c = 1.0`** across every scenario, and binds
   hard only in the worst segment at thin `c`. Keep `c = 1.0` for the pilot.

---

### Appendix — reproduce

```bash
cd model
python3 mutav_model.py                 # BRL, South (this document's base case: DEFAULT N=3 + EXIT E=6)
python3 mutav_model.py --currency USD  # USD comparison (§5)
python3 mutav_model.py --scenario banda_ate_1k   # stress (§9)
python3 mutav_model.py --exit-months 0 # DEFAULT-leg only (no property-recovery leg)
python3 mutav_model.py --selftest      # assertions
```

The two coverage legs are tunable from the CLI: `--months` sets the DEFAULT
(rent-arrears) cap `N` and `--exit-months` sets the EXIT (property-recovery) cap
`E`; the standard product is `N=3`, `E=6`, so `capital_locked = c·R·(N+E) = 9R`
per guarantee. `--fee-bps` sets the taxa de garantia (default `1200` = 12%/period),
`--coverage-ratio` sets `c`, and `--currency`/`--yield` peg the underlying reserve
rate.

All figures rounded; see the script for exact values. Parameters (`DELINQUENCY`,
`CURRENCIES`, the standard product `Params` — including `months_covered`,
`exit_months`, `fee_bps`, and the EXIT-claim assumptions `p_exit`/`exit_severity`/
`lease_months` — and the recession regime) are at the top of `mutav_model.py` and
are the single source of truth — change them there and regenerate.
