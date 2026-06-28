/**
 * Model-backed reserve economics — the closed form from `model/mutav_model.py`,
 * computed from LIVE on-chain reads. Every number here traces to (a) the current
 * guarantee book and (b) two stated assumptions (delinquency + underlying yield),
 * NOT to a per-browser localStorage guess.
 *
 *   Investor APY = underlying yield + underwriting spread
 *   underwriting spread = (annual premium − expected annual payout) / total assets
 *
 * The underwriting spread is the protocol's edge over the local risk-free rate; the
 * base `underlyingYield` pegs to the guarantee currency (BRL Selic ~14% vs USD DeFi
 * ~5.5%). See docs/whitepaper.md.
 */

import { fromStroops } from "./format";
import type { Guarantee } from "policy";

import { STROOP_SCALE } from "./format";

const SECONDS_PER_YEAR = 365.25 * 86_400;

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
  annualPremium: number; // contracted premium run-rate, currency/yr
  expectedAnnualPayout: number; // delinquency × 12 × Σ monthly_amount
  netUnderwriting: number; // premium − payout
  capitalLocked: number; // = coverage_required
  underwritingSpread: number; // netUnderwriting / totalAssets (APY contribution)
  modeledApy: number; // underlyingYield + underwritingSpread
  lossRatio: number; // expectedPayout / premium
  breakevenRho: number; // delinquency at which underwriting = 0
  cushion: number; // breakevenRho / delinquency
  // echoed assumptions (for honest labeling)
  rho: number;
  underlyingYield: number;
}

/**
 * Compute the modeled economics of the current book. Only **active and
 * premium-current** guarantees earn premium / lock capital — exactly the set the
 * contract's `coverage_required` counts.
 */
export function computeEconomics(
  input: BookInput,
  assumptions: ModelAssumptions = MODEL_ASSUMPTIONS,
): ModeledEconomics {
  const { delinquency: rho, underlyingYield } = assumptions;

  let annualPremium = 0;
  let monthlySum = 0; // Σ monthly_amount over active & current
  for (const { guarantee: g, isCurrent } of input.guarantees) {
    if (!g.active || !isCurrent) continue;
    const monthly = fromStroops(g.monthly_amount);
    const periodsPerYear = SECONDS_PER_YEAR / Number(g.period_secs);
    annualPremium += monthly * (g.fee_bps / 10_000) * periodsPerYear;
    monthlySum += monthly;
  }

  const expectedAnnualPayout = rho * 12 * monthlySum;
  const netUnderwriting = annualPremium - expectedAnnualPayout;
  const capitalLocked = fromStroops(input.coverageRequired);
  const totalAssets = fromStroops(input.totalAssets);

  const underwritingSpread = totalAssets > 0 ? netUnderwriting / totalAssets : 0;
  const modeledApy = underlyingYield + underwritingSpread;
  const lossRatio = annualPremium > 0 ? expectedAnnualPayout / annualPremium : 0;
  const breakevenRho = monthlySum > 0 ? annualPremium / (12 * monthlySum) : 0;
  const cushion = rho > 0 ? breakevenRho / rho : Infinity;

  return {
    annualPremium,
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
  const monthsCovered = 3;
  const exitMonths = 6;
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
