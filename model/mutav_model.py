#!/usr/bin/env python3
"""
MUTAV reserve — economic model (guarantees · coverage · premiums · yield · risk).

Pure standard library, zero install. Models the on-chain mechanics exactly as the
`policy` + `vault` Soroban contracts implement them:

  - fee charged per pay_fee = monthly_amount * fee_bps / 10_000   (per period)
  - coverage_required (active) = sum coverage_ratio * [ monthly*(months_covered-months_used)  # DEFAULT leg
        + (monthly*exit_months - exit_used) ]                                                 # EXIT leg
    NO time-gate: a fee-miss past grace IS a default (it triggers the claim), never a release.
  - cover_default pays ONE monthly_amount per call (DEFAULT/rent-arrears leg), caps at months_covered
  - cover_exit pays property-recovery costs up to monthly*exit_months (EXIT leg)
  - fees accrue to NAV (no shares minted); claims (default + exit) drain NAV
  - free_capital = max(0, stable_assets - coverage_required); only it may exit or back new guarantees

Two layers:
  1) DETERMINISTIC closed-form unit & portfolio economics (the headline APY math).
  2) MONTE CARLO over a book of guarantees with correlated default waves (the tail:
     investor-APY distribution + probability of a coverage breach in actuarial mode).

Default-rate inputs are grounded in real Brazilian data (Indice Superlogica, 60+ dpd
monthly stock). See README.md for citations. Every rate here is a *monthly stock*
delinquency `rho` — the fraction of active contracts 60+ days overdue at a point in
time. By Little's law that stock equals the expected fraction of rents the reserve
covers, so expected monthly payout per guarantee = rho * monthly_amount.

Run:  python3 mutav_model.py            # prints all tables + a Monte Carlo run
      python3 mutav_model.py --selftest # assertions only
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass, field, replace

BPS = 10_000
MONTHS_PER_YEAR = 12

# ───────────────────────────── Real-data anchors ─────────────────────────────
# Monthly stock delinquency (60+ days overdue), Indice Superlogica, Jan 2026.
# These are POINT-IN-TIME stocks: rho = share of active contracts in default now.
DELINQUENCY = {
    "sul":            0.0246,  # South region — lowest in Brazil
    "sul_apto":       0.0211,  # South, apartments (cleanest segment)
    "sul_casa":       0.0358,  # South, houses
    "brasil":         0.0329,  # national average
    "apto_nacional":  0.0215,  # national, apartments
    "banda_ate_1k":   0.0543,  # worst rent band (<= R$1.000/mo) — stress anchor
    "parana":         0.0510,  # PR ran hot in 2026 — regional stress
}
DEFAULT_SCENARIO = "sul"


# ───────────────────────────── Currency / yield peg ──────────────────────────
# The reserve's underlying-asset yield is NOT a universal constant — it pegs to the
# currency the guarantee is denominated in. A guarantee written in BRL is backed by
# a BRL reserve sitting in CDI/Selic-yielding instruments (or a tokenized Tesouro);
# a USD guarantee is backed by USDC earning stablecoin DeFi yield. So `yield_rate`
# below is the per-currency risk-free/underlying rate the float earns.
#
# NOTE these are NOMINAL rates. BRL's ~14% carries ~4.5% inflation + FX drift; USD's
# ~5.5% carries ~2.5%. Real returns: subtract `inflation`. The protocol's *edge over
# the local risk-free rate* (the underwriting spread) is currency-independent — only
# the passthrough base rate changes.
@dataclass(frozen=True)
class Currency:
    code: str
    yield_rate: float   # nominal underlying/reserve yield (annual)
    inflation: float    # nominal local inflation (annual), for real-return context


CURRENCIES = {
    # BRL: Selic/CDI ~14%/yr mid-2026 (the operating currency in Brazil).
    "BRL": Currency("BRL", yield_rate=0.1400, inflation=0.0450),
    # USD: stablecoin DeFi yield (DeFindex/Blend) ~5.5%; the testnet/PoC denomination.
    "USD": Currency("USD", yield_rate=0.0550, inflation=0.0250),
}
DEFAULT_CURRENCY = "BRL"


# ───────────────────────────────── Parameters ────────────────────────────────
@dataclass(frozen=True)
class Params:
    """One standard guarantee + reserve assumptions. `rent` is in the guarantee's
    own currency unit — APY is unit-invariant, so only `currency` (via its yield)
    and the rate inputs matter."""
    rent: float = 1_000.0          # monthly_amount (R), in `currency` units
    months_covered: int = 3        # N — DEFAULT (rent-arrears) coverage, the eviction window
    exit_months: int = 6           # E — EXIT (property-recovery) coverage, multiple of monthly rent
    fee_bps: int = 1_200           # f = fee_bps/10000 charged PER PERIOD (period=30d => monthly)
    period_days: int = 30          # period_secs/86400
    coverage_ratio: float = 1.00   # c — 1.0 = hard-solvent floor; <1.0 = actuarial mode
    currency: str = DEFAULT_CURRENCY  # pegs the underlying yield (BRL ~14% vs USD ~5.5%)
    yield_override: float | None = None  # set to bypass the currency's pegged yield
    rho: float = DELINQUENCY[DEFAULT_SCENARIO]  # monthly stock delinquency (the swept variable, D)

    # severity shape (only used by the Monte Carlo / capped-payout refinement)
    mean_default_months: float = 4.0  # avg months a default spell runs before cure/eviction (L)

    # EXIT-cost claim assumption (the one non-contract modelling input — exit severity is
    # not in the rho default regime). p_exit = fraction of leases that draw exit cost;
    # exit_severity = mean draw as a fraction of the E*R cap; lease_months annualizes the
    # one-time exit cost. The full E*R is RESERVED regardless (hard solvency). CONFIRM these.
    p_exit: float = 1.0               # every lease incurs some exit cost (wear/cleanup/restoration)
    exit_severity: float = 0.15       # mean exit draw ≈ 0.15 * 6R = 0.9R (≈ one month of restoration)
    lease_months: int = 30            # typical Brazilian lease span, to annualize the exit draw

    @property
    def f(self) -> float:
        return self.fee_bps / BPS

    @property
    def s(self) -> float:
        """Underlying yield the reserve earns — pegged to the guarantee currency."""
        if self.yield_override is not None:
            return self.yield_override
        return CURRENCIES[self.currency].yield_rate

    @property
    def periods_per_year(self) -> float:
        return 365.25 / self.period_days

    @property
    def capital_locked(self) -> float:
        """coverage_required for one fresh guarantee = c * R * (N + E) — both legs
        (DEFAULT rent-arrears + EXIT property-recovery) reserved in full at c=1.0."""
        return self.coverage_ratio * self.rent * (self.months_covered + self.exit_months)

    @property
    def annual_exit_payout(self) -> float:
        """Expected exit-cost payout per guarantee, annualized. One-time draw of
        exit_severity * (E*R) on a p_exit fraction of leases, spread over lease_months."""
        lifetime_exit = self.p_exit * self.exit_severity * self.exit_months * self.rent
        return lifetime_exit / (self.lease_months / MONTHS_PER_YEAR)


# ───────────────────────── Deterministic unit economics ──────────────────────
@dataclass
class UnitEconomics:
    capital_locked: float
    annual_premium: float
    annual_expected_payout: float        # DEFAULT (rent-arrears) leg
    annual_expected_exit_payout: float   # EXIT (property-recovery) leg
    annual_net_underwriting: float
    annual_defi_yield: float
    annual_total_return: float
    apy: float
    loss_ratio: float          # expected payout / premium income
    breakeven_rho: float       # monthly stock delinquency at which underwriting = 0
    cushion: float             # breakeven_rho / rho


def unit_economics(p: Params) -> UnitEconomics:
    """
    Closed-form annual P&L for a single fully-backed (or c-scaled) guarantee.

    Fee income      = periods/yr * f * R          (contract: R*fee_bps/10000 per period)
    Default payout  = 12 * rho * R                 (stock delinquency => fraction of rents paid)
    Exit payout     = p_exit * s_exit * E * R / lease_years   (one-time property-recovery cost)
    DeFi yield      = s * capital_locked           (the locked reserve is invested, not idle)
    """
    annual_premium = p.periods_per_year * p.f * p.rent
    annual_expected_payout = MONTHS_PER_YEAR * p.rho * p.rent      # DEFAULT leg
    annual_exit = p.annual_exit_payout                            # EXIT leg
    net = annual_premium - annual_expected_payout - annual_exit
    defi = p.s * p.capital_locked
    total = net + defi
    apy = total / p.capital_locked if p.capital_locked else float("nan")

    # breakeven default rho: fee income == default payout + exit payout
    #   periods/yr*f*R - exit  ==  12 * rho * R   =>   rho* = (premium - exit)/(12*R)
    breakeven_rho = max(0.0, (annual_premium - annual_exit) / (MONTHS_PER_YEAR * p.rent)) if p.rent else float("nan")
    return UnitEconomics(
        capital_locked=p.capital_locked,
        annual_premium=annual_premium,
        annual_expected_payout=annual_expected_payout,
        annual_expected_exit_payout=annual_exit,
        annual_net_underwriting=net,
        annual_defi_yield=defi,
        annual_total_return=total,
        apy=apy,
        loss_ratio=((annual_expected_payout + annual_exit) / annual_premium) if annual_premium else float("nan"),
        breakeven_rho=breakeven_rho,
        cushion=(breakeven_rho / p.rho) if p.rho else float("inf"),
    )


def reserve_capacity(reserve: float, p: Params) -> int:
    """How many standard guarantees a reserve of given USDC size can fully back."""
    return int(reserve // p.capital_locked)


@dataclass
class PortfolioEconomics:
    reserve: float
    guarantees: int
    coverage_required: float
    free_capital: float
    annual_premium: float
    annual_expected_payout: float
    annual_net_underwriting: float
    annual_defi_yield: float
    annual_total_return: float
    apy: float


def portfolio_economics(reserve: float, p: Params) -> PortfolioEconomics:
    """
    Reserve sized at `reserve`, packed with as many standard guarantees as fit.
    DeFi yield earns on the WHOLE reserve (locked coverage + free buffer are both invested).
    """
    n = reserve_capacity(reserve, p)
    u = unit_economics(p)
    coverage = n * u.capital_locked
    free = reserve - coverage
    premium = n * u.annual_premium
    payout = n * (u.annual_expected_payout + u.annual_expected_exit_payout)  # DEFAULT + EXIT legs
    net = premium - payout
    defi = p.s * reserve
    total = net + defi
    return PortfolioEconomics(
        reserve=reserve,
        guarantees=n,
        coverage_required=coverage,
        free_capital=free,
        annual_premium=premium,
        annual_expected_payout=payout,
        annual_net_underwriting=net,
        annual_defi_yield=defi,
        annual_total_return=total,
        apy=total / reserve if reserve else float("nan"),
    )


# ─────────────────────────────── Monte Carlo ─────────────────────────────────
@dataclass
class MCConfig:
    n_guarantees: int = 100
    horizon_months: int = 36
    n_sims: int = 4_000
    # Correlated risk as a PERSISTENT recession regime (two-state Markov), not a
    # one-off shock month. A recession multiplies every contract's default hazard
    # for as long as it lasts — this is what actually erodes a sub-100% floor.
    p_enter_recession: float = 0.025   # ~once per 3.3 yrs
    p_exit_recession: float = 0.12     # mean recession ~8 months
    recession_mult: float = 8.0        # hazard multiplier while in recession
    seed: int = 42


@dataclass
class MCResult:
    apy_mean: float
    apy_p50: float
    apy_p05: float           # 5th percentile investor APY (downside)
    apy_p01: float
    worst_apy: float
    p_coverage_breach: float  # fraction of sims where stable_assets < coverage_required (only <100%)
    mean_total_defaults_paid: float
    mean_months_in_default: float
    peak_stock_p95: float     # 95th-pct peak simultaneous in-default share across sims


def _calibrate_hazard(p: Params) -> float:
    """
    Pick a per-contract monthly entry hazard lambda so the steady-state stock of
    in-default contracts matches the observed rho. For a spell of mean length L
    (geometric cure prob 1/L), steady-state stock = lambda*L / (1 + lambda*L)... we
    invert: stock rho => lambda = rho / (L * (1 - rho)). Clamped to [0,1].
    """
    L = max(1.0, p.mean_default_months)
    lam = p.rho / (L * (1.0 - p.rho))
    return min(max(lam, 0.0), 1.0)


def monte_carlo(p: Params, cfg: MCConfig) -> MCResult:
    """
    Simulate a book of `n_guarantees` standard guarantees over `horizon_months`.

    Each contract is either healthy or in a default spell. Healthy contracts enter
    default with monthly hazard lambda (calibrated to rho), inflated during systemic
    shock months. While in default the reserve pays R/month (cover_default) until the
    spell cures (geometric, mean L) or the months_covered cap is hit. Premiums are
    paid by healthy contracts each month (accrue to NAV). DeFi yield accrues monthly
    on the reserve. We track whether stable_assets ever drops below coverage_required
    (a breach — only possible when coverage_ratio < 1.0).

    Investor APY = (end_nav - start_nav)/start_nav annualized over the horizon.
    """
    rng = random.Random(cfg.seed)
    lam = _calibrate_hazard(p)
    cure_prob = 1.0 / max(1.0, p.mean_default_months)
    monthly_defi = (1.0 + p.s) ** (1.0 / 12.0) - 1.0
    monthly_premium = p.f * p.rent  # one period == one month at period_days=30
    # EXIT leg: a one-time property-recovery draw per guarantee. Monthly one-shot
    # hazard so expected ~p_exit draws over the horizon; each pays exit_severity*E*R.
    h_exit = p.p_exit / cfg.horizon_months if cfg.horizon_months else 0.0
    exit_amount = p.exit_severity * p.exit_months * p.rent

    start_reserve = cfg.n_guarantees * p.capital_locked  # fully-packed book
    apys: list[float] = []
    breaches = 0
    total_defaults_paid_acc = 0.0
    months_in_default_acc = 0.0
    peak_stocks: list[float] = []

    for _ in range(cfg.n_sims):
        nav = start_reserve
        months_used = [0] * cfg.n_guarantees
        in_default = [False] * cfg.n_guarantees
        exited = [False] * cfg.n_guarantees
        defaults_paid = 0.0
        months_in_default = 0
        breached = False
        recession = False
        peak_stock = 0.0

        for _m in range(cfg.horizon_months):
            # recession regime transition (persistent — this is the correlated wave)
            if recession:
                if rng.random() < cfg.p_exit_recession:
                    recession = False
            elif rng.random() < cfg.p_enter_recession:
                recession = True
            eff_lam = min(1.0, lam * (cfg.recession_mult if recession else 1.0))

            nav += nav * monthly_defi  # DeFi yield on the whole reserve

            coverage_required = 0.0
            in_default_now = 0
            for i in range(cfg.n_guarantees):
                # DEFAULT (rent-arrears) leg — only while the eviction window remains
                if p.months_covered - months_used[i] > 0:
                    if in_default[i]:
                        nav -= p.rent                 # cover_default pays one month
                        defaults_paid += p.rent
                        months_used[i] += 1
                        months_in_default += 1
                        in_default_now += 1
                        if (p.months_covered - months_used[i]) <= 0 or rng.random() < cure_prob:
                            in_default[i] = False
                    else:
                        nav += monthly_premium        # fee accrues to NAV
                        if rng.random() < eff_lam:
                            in_default[i] = True

                # EXIT (property-recovery) leg — one-time draw, drops NAV and coverage in
                # lockstep so c=1.0 stays breach-proof (coverage releases the full E*R).
                if not exited[i] and rng.random() < h_exit:
                    nav -= exit_amount                # cover_exit
                    exited[i] = True

                # coverage_required = remaining DEFAULT leg + remaining EXIT leg
                default_rem = p.months_covered - months_used[i]
                if default_rem > 0:
                    coverage_required += p.coverage_ratio * p.rent * default_rem
                if not exited[i]:
                    coverage_required += p.coverage_ratio * p.rent * p.exit_months

            peak_stock = max(peak_stock, in_default_now / cfg.n_guarantees)
            if nav < coverage_required:
                breached = True

        years = cfg.horizon_months / 12.0
        ratio = nav / start_reserve if start_reserve > 0 else 0.0
        # NAV can go negative under deep stress (a wiped-out book); floor at -100%
        # and avoid the complex root of a negative base.
        apy = (ratio ** (1.0 / years)) - 1.0 if ratio > 0 else -1.0
        apys.append(apy)
        if breached:
            breaches += 1
        total_defaults_paid_acc += defaults_paid
        months_in_default_acc += months_in_default
        peak_stocks.append(peak_stock)

    apys.sort()
    peak_stocks.sort()
    n = len(apys)

    def pct(seq: list[float], q: float) -> float:
        return seq[min(len(seq) - 1, max(0, int(q * len(seq))))]

    return MCResult(
        apy_mean=sum(apys) / n,
        apy_p50=pct(apys, 0.50),
        apy_p05=pct(apys, 0.05),
        apy_p01=pct(apys, 0.01),
        worst_apy=apys[0],
        p_coverage_breach=breaches / cfg.n_sims,
        mean_total_defaults_paid=total_defaults_paid_acc / cfg.n_sims,
        mean_months_in_default=months_in_default_acc / cfg.n_sims,
        peak_stock_p95=pct(peak_stocks, 0.95),
    )


# ──────────────────────────────── Reporting ──────────────────────────────────
_SYMBOL = {"BRL": "R$", "USD": "$"}


def _pct(x: float) -> str:
    return f"{x * 100:6.2f}%"


def _usd(x: float) -> str:
    """Format money in the active report currency (set via DEFAULT_CURRENCY)."""
    return f"{_SYMBOL.get(DEFAULT_CURRENCY, '')}{x:,.0f}"


def print_report(base: Params) -> None:
    print("=" * 78)
    print("MUTAV RESERVE — ECONOMIC MODEL")
    print("=" * 78)
    print(f"Standard product: R={base.rent:,.0f} {base.currency}/mo · DEFAULT N={base.months_covered}mo "
          f"+ EXIT E={base.exit_months}x · fee={base.f*100:.0f}%/period · period={base.period_days}d · "
          f"coverage_ratio={base.coverage_ratio:.2f}")
    print(f"Underlying yield = {base.s*100:.2f}% ({base.currency}-pegged) · "
          f"delinquency rho = {base.rho*100:.2f}% monthly stock "
          f"(scenario '{DEFAULT_SCENARIO}', Superlogica 60+ dpd)")

    # 0) currency-pegged yield: APY = currency risk-free + underwriting spread --------
    print("\n[0] CURRENCY-PEGGED YIELD — same product, same default risk; only the base rate changes")
    print("    APY decomposes as:  (currency risk-free yield)  +  (underwriting spread)")
    print("    underwriting spread = (annual premium - annual payout) / capital_locked  [currency-independent]")
    hdr0 = f"    {'currency':<10}{'risk-free':>11}{'+u/w spread':>13}{'= nominal APY':>15}{'- inflation':>13}{'real APY':>10}"
    print(hdr0)
    print("    " + "-" * (len(hdr0) - 4))
    for code in CURRENCIES:
        cur = CURRENCIES[code]
        u = unit_economics(replace(base, currency=code, yield_override=None))
        spread = u.annual_net_underwriting / u.capital_locked
        nominal = u.apy
        real = (1 + nominal) / (1 + cur.inflation) - 1
        print(f"    {code:<10}{_pct(cur.yield_rate):>11}{_pct(spread):>13}{_pct(nominal):>15}"
              f"{_pct(cur.inflation):>13}{_pct(real):>10}")
    print("    => The protocol's edge over the local risk-free rate is the SAME spread in any")
    print("       currency; BRL just rides a higher base (Selic/CDI ~14%) than USD (~5.5%).")

    # 1) Unit economics across delinquency scenarios -------------------------------
    print(f"\n[1] UNIT ECONOMICS — one {_usd(base.rent)} guarantee "
          f"(DEFAULT {base.months_covered}mo + EXIT {base.exit_months}x), by delinquency scenario")
    print(f"    capital locked per guarantee = {_usd(base.capital_locked)}  "
          f"(= c · R · (N+E))")
    hdr = f"    {'scenario':<16}{'rho':>7}{'fee':>10}{'payout(D+E)':>13}{'net u/w':>10}{'+DeFi':>9}{'APY':>8}{'lossratio':>11}{'cushion':>9}"
    print(hdr)
    print("    " + "-" * (len(hdr) - 4))
    for name, rho in DELINQUENCY.items():
        u = unit_economics(replace(base, rho=rho))
        print(f"    {name:<16}{rho*100:6.2f}%{_usd(u.annual_premium):>10}"
              f"{_usd(u.annual_expected_payout + u.annual_expected_exit_payout):>13}{_usd(u.annual_net_underwriting):>10}"
              f"{_usd(u.annual_defi_yield):>9}{_pct(u.apy):>8}{_pct(u.loss_ratio):>11}"
              f"{u.cushion:>8.1f}x")

    # 2) months_covered lever ------------------------------------------------------
    print("\n[2] THE months_covered (N) LEVER — base delinquency, varying coverage cap")
    hdr2 = f"    {'N (months)':<12}{'capital lock':>14}{'premium':>10}{'+DeFi':>9}{'total':>10}{'APY':>9}"
    print(hdr2)
    print("    " + "-" * (len(hdr2) - 4))
    for N in (3, 6, 12, 30):
        u = unit_economics(replace(base, months_covered=N))
        print(f"    {N:<12}{_usd(u.capital_locked):>14}{_usd(u.annual_premium):>10}"
              f"{_usd(u.annual_defi_yield):>9}{_usd(u.annual_total_return):>10}{_pct(u.apy):>9}")

    # 3) reserve capacity & portfolio ---------------------------------------------
    print("\n[3] RESERVE CAPACITY & PORTFOLIO APY — base delinquency, N=3, E=6, c=1.0")
    hdr3 = f"    {'reserve':>12}{'guarantees':>12}{'coverage':>12}{'free':>10}{'premiums/yr':>13}{'payouts/yr':>12}{'APY':>8}"
    print(hdr3)
    print("    " + "-" * (len(hdr3) - 4))
    for reserve in (50_000, 100_000, 500_000, 1_000_000):
        pe = portfolio_economics(reserve, base)
        print(f"    {_usd(pe.reserve):>12}{pe.guarantees:>12}{_usd(pe.coverage_required):>12}"
              f"{_usd(pe.free_capital):>10}{_usd(pe.annual_premium):>13}"
              f"{_usd(pe.annual_expected_payout):>12}{_pct(pe.apy):>8}")

    # 4) actuarial-mode leverage ---------------------------------------------------
    print("\n[4] ACTUARIAL MODE — coverage_ratio < 1.0 levers fee-on-capital (base rho, N=3, E=6)")
    hdr4 = f"    {'coverage_ratio':<16}{'capital lock':>14}{'APY':>9}   {'note':<34}"
    print(hdr4)
    print("    " + "-" * (len(hdr4) - 4))
    for c, note in ((1.00, "hard-solvent (armageddon-proof)"),
                    (0.50, "2x leverage; breach if >50% full-N"),
                    (0.30, "3.3x leverage; thin floor")):
        u = unit_economics(replace(base, coverage_ratio=c))
        print(f"    {c:<16.2f}{_usd(u.capital_locked):>14}{_pct(u.apy):>9}   {note:<34}")

    # 5) Monte Carlo tail ----------------------------------------------------------
    print("\n[5] MONTE CARLO — book of 100 guarantees, 36 months, persistent recession regime")
    cfg = MCConfig()
    for label, p in (("hard-solvent  c=1.00", base),
                     ("actuarial     c=0.50", replace(base, coverage_ratio=0.50)),
                     ("actuarial     c=0.30", replace(base, coverage_ratio=0.30))):
        r = monte_carlo(p, cfg)
        print(f"    {label}:  APY mean {_pct(r.apy_mean)}  p05 {_pct(r.apy_p05)}  "
              f"p01 {_pct(r.apy_p01)}  worst {_pct(r.worst_apy)}  "
              f"P(breach) {r.p_coverage_breach*100:5.2f}%  peakStock(p95) {r.peak_stock_p95*100:4.1f}%")
    print(f"    (recession: enter {cfg.p_enter_recession*100:.1f}%/mo, mean {1/cfg.p_exit_recession:.0f} mo, "
          f"{cfg.recession_mult:.0f}x hazard; cure {1/base.mean_default_months*100:.0f}%/mo, capped at N; "
          f"breakeven stock = {unit_economics(base).breakeven_rho*100:.1f}%)")
    print("    Note: c=1.00 is breach-proof BY CONSTRUCTION — cover_default drops NAV and the")
    print("    floor in lockstep, so stable_assets >= coverage_required is invariant.")
    print("=" * 78)


# ──────────────────────────────── Self-tests ─────────────────────────────────
def selftest() -> None:
    p = Params()
    u = unit_economics(p)

    # contract-exact fee: R * fee_bps/10000 per period
    assert abs(p.f * p.rent - 120.0) < 1e-9, "fee per period should be $120"
    # annual fee ~ 12.175 periods * 120
    assert 1455 < u.annual_premium < 1465, u.annual_premium
    # capital locked = c*R*(N+E) = 1*1000*(3+6) = 9000 (DEFAULT + EXIT legs)
    assert abs(u.capital_locked - 9_000.0) < 1e-9, u.capital_locked
    # DEFAULT payout = 12 * rho * R, Sul rho=0.0246 -> ~$295
    assert 290 < u.annual_expected_payout < 300, u.annual_expected_payout
    # EXIT payout = p_exit*s_exit*E*R / lease_years = 1.0*0.15*6000 / 2.5 = 360
    assert abs(u.annual_expected_exit_payout - 360.0) < 1e-9, u.annual_expected_exit_payout
    # loss ratio = (default+exit)/fee ~ 655/1461 ~ 45% (the exit leg now dominates the loss)
    assert 0.40 < u.loss_ratio < 0.50, u.loss_ratio
    # breakeven default rho = (fee - exit)/(12*R) ~ 1101/12000 ~ 0.0918
    assert 0.088 < u.breakeven_rho < 0.096, u.breakeven_rho
    # APY positive and sane; BRL (~14% yield) with 9R locked -> ~23%
    assert 0.18 < u.apy < 0.28, u.apy

    # currency peg: BRL rides a higher base than USD, but the underwriting SPREAD
    # (premium - payout)/capital is currency-independent.
    u_brl = unit_economics(replace(p, currency="BRL"))
    u_usd = unit_economics(replace(p, currency="USD"))
    assert u_brl.apy > u_usd.apy, "BRL yield should exceed USD"
    spread_brl = u_brl.annual_net_underwriting / u_brl.capital_locked
    spread_usd = u_usd.annual_net_underwriting / u_usd.capital_locked
    assert abs(spread_brl - spread_usd) < 1e-9, "underwriting spread must be currency-independent"
    # the APY gap equals exactly the yield gap
    assert abs((u_brl.apy - u_usd.apy)
               - (CURRENCIES["BRL"].yield_rate - CURRENCIES["USD"].yield_rate)) < 1e-9
    # yield_override bypasses the peg
    assert abs(unit_economics(replace(p, yield_override=0.20)).annual_defi_yield
               - 0.20 * u.capital_locked) < 1e-9

    # capacity: $50k / $9k = 5
    assert reserve_capacity(50_000, p) == 5
    pe = portfolio_economics(100_000, p)
    assert pe.guarantees == 11
    assert pe.apy > 0.15

    # N lever monotonic: lower N -> higher APY
    apy_n6 = unit_economics(replace(p, months_covered=6)).apy
    apy_n30 = unit_economics(replace(p, months_covered=30)).apy
    assert apy_n6 > apy_n30

    # actuarial leverage: lower c -> higher APY
    apy_c1 = unit_economics(replace(p, coverage_ratio=1.0)).apy
    apy_c05 = unit_economics(replace(p, coverage_ratio=0.5)).apy
    assert apy_c05 > apy_c1

    # Monte Carlo: c=1.0 never breaches; c=0.3 breaches sometimes under shocks
    r1 = monte_carlo(p, MCConfig(n_sims=600))
    assert r1.p_coverage_breach == 0.0, "100% coverage must never breach"
    r03 = monte_carlo(replace(p, coverage_ratio=0.30), MCConfig(n_sims=600))
    assert r03.p_coverage_breach >= r1.p_coverage_breach

    print("selftest: OK")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="MUTAV reserve economic model")
    ap.add_argument("--selftest", action="store_true", help="run assertions and exit")
    ap.add_argument("--scenario", default=DEFAULT_SCENARIO, choices=list(DELINQUENCY),
                    help="base delinquency scenario")
    ap.add_argument("--rent", type=float, default=1_000.0)
    ap.add_argument("--months", type=int, default=3, help="DEFAULT (rent-arrears) coverage months, N")
    ap.add_argument("--exit-months", type=int, default=6, help="EXIT (property-recovery) coverage, E (× rent)")
    ap.add_argument("--fee-bps", type=int, default=1_200)
    ap.add_argument("--coverage-ratio", type=float, default=1.0)
    ap.add_argument("--currency", default=DEFAULT_CURRENCY, choices=list(CURRENCIES),
                    help="pegs the underlying reserve yield (BRL~14%% vs USD~5.5%%)")
    ap.add_argument("--yield", dest="yield_override", type=float, default=None,
                    help="override the currency-pegged yield (e.g. 0.135)")
    args = ap.parse_args()

    if args.selftest:
        selftest()
    else:
        DEFAULT_SCENARIO = args.scenario
        DEFAULT_CURRENCY = args.currency
        base = Params(
            rent=args.rent,
            months_covered=args.months,
            exit_months=args.exit_months,
            fee_bps=args.fee_bps,
            coverage_ratio=args.coverage_ratio,
            currency=args.currency,
            yield_override=args.yield_override,
            rho=DELINQUENCY[args.scenario],
        )
        print_report(base)
