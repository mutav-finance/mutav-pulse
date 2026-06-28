/**
 * Model-backed reserve economics — the closed form from `model/mutav_model.py`,
 * computed from LIVE on-chain reads. Every number here traces to (a) the current
 * guarantee book and (b) two stated assumptions (delinquency + underlying yield),
 * NOT to a per-browser localStorage guess.
 *
 *   Investor APY = underlying yield + underwriting spread
 *   underwriting spread = (annual fee − expected annual payout) / total assets
 *
 * The underwriting spread is the protocol's edge over the local risk-free rate; the
 * base `underlyingYield` pegs to the guarantee currency (BRL Selic ~14% vs USD DeFi
 * ~5.5%). See docs/whitepaper.md.
 */

import { fromStroops, STROOP_SCALE } from "./format";
import type { Guarantee } from "policy";

const SECONDS_PER_YEAR = 365.25 * 86_400;

/**
 * The STANDARD two-leg fiança product (pilot default): a 3-month DEFAULT
 * (rent-arrears) leg + a 6-month EXIT (property-recovery) leg. Single source for
 * the leg counts shared by the modeled-economics reference and the
 * sign-guarantee default — change here to re-peg the pilot shape.
 */
export const STANDARD_PRODUCT = { monthsCovered: 3, exitMonths: 6 } as const;

/**
 * Remaining two-leg exposure of a single guarantee, in stroops — the capital the
 * vault still reserves behind it. Mirrors `registry::contribution`:
 *   DEFAULT leg: monthly × max(0, months_covered − months_used)
 *   EXIT leg:    monthly × exit_months − exit_used (clamped ≥ 0 for display;
 *                the contract relies on the exit_used ≤ cap invariant instead).
 * Keep in lockstep with the contract so the UI's "remaining exposure" never
 * diverges from what the vault actually locks.
 */
export function guaranteeExposure(g: Guarantee): bigint {
  const monthsRemaining = Math.max(0, g.months_covered - g.months_used);
  const defaultRemaining = BigInt(monthsRemaining) * g.monthly_amount;
  const exitCap = BigInt(g.exit_months) * g.monthly_amount;
  const exitRemaining = exitCap > g.exit_used ? exitCap - g.exit_used : 0n;
  return defaultRemaining + exitRemaining;
}

/** assets → shares at a given NAV-per-share (both stroop-scaled). 0 if NAV ≤ 0. */
export function sharesFor(assets: bigint, navPerShare: bigint): bigint {
  return navPerShare > 0n ? (assets * STROOP_SCALE) / navPerShare : 0n;
}
/** shares → assets at a given NAV-per-share (both stroop-scaled). */
export function assetsFor(shares: bigint, navPerShare: bigint): bigint {
  return (shares * navPerShare) / STROOP_SCALE;
}

/** Stated modeling assumptions. Single source of truth — change here to re-peg. */
export interface ModelAssumptions {
  /** Monthly stock delinquency (60+ dpd). Índice Superlógica, South region. */
  delinquency: number;
  /** Underlying reserve yield, pegged to the guarantee currency. */
  underlyingYield: number;
}

export const MODEL_ASSUMPTIONS: ModelAssumptions = {
  delinquency: 0.0246, // South region, Índice Superlógica (60+ dpd, Jan 2026)
  underlyingYield: 0.055, // USD stablecoin DeFi — the testnet (USDC) denomination
};

export interface BookInput {
  guarantees: Array<{ guarantee: Guarantee; isCurrent: boolean }>;
  /** policy.coverage_required() — capital locked behind the book (c-scaled, stroops). */
  coverageRequired: bigint;
  /** vault.total_assets() — the whole reserve the investor's shares represent (stroops). */
  totalAssets: bigint;
}

export interface ModeledEconomics {
  annualFee: number; // contracted fee run-rate, currency/yr
  expectedAnnualPayout: number; // delinquency × 12 × Σ monthly_amount
  netUnderwriting: number; // fee − payout
  capitalLocked: number; // = coverage_required
  underwritingSpread: number; // netUnderwriting / totalAssets (APY contribution)
  modeledApy: number; // underlyingYield + underwritingSpread
  lossRatio: number; // expectedPayout / fee
  breakevenRho: number; // delinquency at which underwriting = 0
  cushion: number; // breakevenRho / delinquency
  // echoed assumptions (for honest labeling)
  rho: number;
  underlyingYield: number;
}

/**
 * Compute the modeled economics of the current book. Only **active and
 * fee-current** guarantees earn fees / lock capital — exactly the set the
 * contract's `coverage_required` counts.
 */
export function computeEconomics(
  input: BookInput,
  assumptions: ModelAssumptions = MODEL_ASSUMPTIONS,
): ModeledEconomics {
  const { delinquency: rho, underlyingYield } = assumptions;

  let annualFee = 0;
  let monthlySum = 0; // Σ monthly_amount over active & current
  for (const { guarantee: g, isCurrent } of input.guarantees) {
    if (!g.active || !isCurrent) continue;
    const monthly = fromStroops(g.monthly_amount);
    const periodsPerYear = SECONDS_PER_YEAR / Number(g.period_secs);
    annualFee += monthly * (g.fee_bps / 10_000) * periodsPerYear;
    monthlySum += monthly;
  }

  const expectedAnnualPayout = rho * 12 * monthlySum;
  const netUnderwriting = annualFee - expectedAnnualPayout;
  const capitalLocked = fromStroops(input.coverageRequired);
  const totalAssets = fromStroops(input.totalAssets);

  const underwritingSpread = totalAssets > 0 ? netUnderwriting / totalAssets : 0;
  const modeledApy = underlyingYield + underwritingSpread;
  const lossRatio = annualFee > 0 ? expectedAnnualPayout / annualFee : 0;
  const breakevenRho = monthlySum > 0 ? annualFee / (12 * monthlySum) : 0;
  const cushion = rho > 0 ? breakevenRho / rho : Infinity;

  return {
    annualFee,
    expectedAnnualPayout,
    netUnderwriting,
    capitalLocked,
    underwritingSpread,
    modeledApy,
    lossRatio,
    breakevenRho,
    cushion,
    rho,
    underlyingYield,
  };
}

/**
 * Reference economics for the STANDARD two-leg product (one $1,000 / 12%-per-30d
 * guarantee, fully packed) under a given currency peg. Two-leg fiança: a 3-month
 * DEFAULT (rent-arrears) leg + a 6-month EXIT (property-recovery) leg, so the
 * capital reserved per guarantee is `monthly * (months_covered + exit_months)` =
 * 1,000 × (3 + 6) = 9,000. Used to show a model-backed headline APY for reserves
 * that have no live book yet (planned currencies).
 */
export function standardProductEconomics(
  assumptions: ModelAssumptions = MODEL_ASSUMPTIONS,
): ModeledEconomics {
  const { monthsCovered, exitMonths } = STANDARD_PRODUCT;
  const guarantee = {
    id: 1,
    landlord: "",
    monthly_amount: 1000n * STROOP_SCALE,
    months_covered: monthsCovered,
    months_used: 0,
    exit_months: exitMonths,
    exit_used: 0n,
    fee_bps: 1200,
    period_secs: 2_592_000n,
    paid_until: 0n,
    active: true,
  } as Guarantee;
  // Capital reserved per guarantee = monthly × (default leg + exit leg).
  const capital = BigInt(monthsCovered + exitMonths) * 1000n * STROOP_SCALE;
  return computeEconomics(
    {
      guarantees: [{ guarantee, isCurrent: true }],
      coverageRequired: capital,
      totalAssets: capital,
    },
    assumptions,
  );
}
