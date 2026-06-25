import { describe, it, expect } from "vitest";
import {
  computeEconomics,
  standardProductEconomics,
  MODEL_ASSUMPTIONS,
} from "./economics";
import type { Guarantee } from "policy";

// Helper: a standard $1,000 / 6-month / 12%-per-30d guarantee, premium-current.
const STROOP = 10_000_000n; // 1 unit = 1e7 stroops
function g(over: Partial<Guarantee> = {}, isCurrent = true) {
  const guarantee: Guarantee = {
    id: 1,
    landlord: "GAAA",
    monthly_amount: 1000n * STROOP, // 1,000
    months_covered: 6,
    months_used: 0,
    fee_bps: 1200, // 12% per period
    period_secs: 2_592_000n, // 30 days
    paid_until: 0n,
    active: true,
    ...over,
  } as Guarantee;
  return { guarantee, isCurrent };
}

describe("computeEconomics", () => {
  it("matches the Python model on one standard guarantee (USD assumptions)", () => {
    const e = computeEconomics(
      {
        guarantees: [g()],
        coverageRequired: 6000n * STROOP, // c·R·N = 6,000
        totalAssets: 6000n * STROOP, // fully packed
      },
      { delinquency: 0.0246, underlyingYield: 0.055 },
    );
    // annual premium = 1000 * 0.12 * (365.25/30) ≈ 1,461
    expect(e.annualPremium).toBeGreaterThan(1455);
    expect(e.annualPremium).toBeLessThan(1465);
    // expected payout = 0.0246 * 12 * 1000 ≈ 295
    expect(e.expectedAnnualPayout).toBeCloseTo(295.2, 1);
    // loss ratio ≈ 20.2%
    expect(e.lossRatio).toBeGreaterThan(0.19);
    expect(e.lossRatio).toBeLessThan(0.21);
    // breakeven rho = premium / (12 * Σmonthly) ≈ 12.17%
    expect(e.breakevenRho).toBeGreaterThan(0.118);
    expect(e.breakevenRho).toBeLessThan(0.124);
    // cushion = breakeven / rho ≈ 4.9x
    expect(e.cushion).toBeGreaterThan(4.5);
    expect(e.cushion).toBeLessThan(5.3);
    // modeled APY (USD) = 5.5% yield + ~19.4% spread ≈ 24.9%
    expect(e.modeledApy).toBeGreaterThan(0.24);
    expect(e.modeledApy).toBeLessThan(0.26);
  });

  it("rides a higher base in BRL — same spread, yield gap exactly the APY gap", () => {
    const book = {
      guarantees: [g()],
      coverageRequired: 6000n * STROOP,
      totalAssets: 6000n * STROOP,
    };
    const usd = computeEconomics(book, { delinquency: 0.0246, underlyingYield: 0.055 });
    const brl = computeEconomics(book, { delinquency: 0.0246, underlyingYield: 0.14 });
    expect(brl.underwritingSpread).toBeCloseTo(usd.underwritingSpread, 9);
    expect(brl.modeledApy - usd.modeledApy).toBeCloseTo(0.14 - 0.055, 9);
  });

  it("ignores lapsed (non-current) and inactive guarantees in premium income", () => {
    const e = computeEconomics({
      guarantees: [g(), g({}, false), g({ active: false })],
      coverageRequired: 6000n * STROOP,
      totalAssets: 6000n * STROOP,
    });
    const one = computeEconomics({
      guarantees: [g()],
      coverageRequired: 6000n * STROOP,
      totalAssets: 6000n * STROOP,
    });
    expect(e.annualPremium).toBeCloseTo(one.annualPremium, 6);
  });

  it("standardProductEconomics matches the model per currency peg", () => {
    const usd = standardProductEconomics({ delinquency: 0.0246, underlyingYield: 0.055 });
    const brl = standardProductEconomics({ delinquency: 0.0246, underlyingYield: 0.14 });
    // USD ≈ 24.9%, BRL ≈ 33.4% (from the Python model section [0])
    expect(usd.modeledApy).toBeGreaterThan(0.24);
    expect(usd.modeledApy).toBeLessThan(0.26);
    expect(brl.modeledApy).toBeGreaterThan(0.32);
    expect(brl.modeledApy).toBeLessThan(0.35);
    // spread currency-independent
    expect(brl.underwritingSpread).toBeCloseTo(usd.underwritingSpread, 9);
  });

  it("zero-asset book with a live guarantee: no spread, APY pegs to the underlying yield", () => {
    const assumptions = { delinquency: 0.0246, underlyingYield: 0.055 };
    const e = computeEconomics(
      {
        guarantees: [g()],
        coverageRequired: 0n,
        totalAssets: 0n,
      },
      assumptions,
    );
    expect(e.underwritingSpread).toBe(0);
    expect(e.modeledApy).toBe(assumptions.underlyingYield);
    expect(Number.isFinite(e.modeledApy)).toBe(true);
    expect(e.annualPremium).toBeGreaterThan(0);
  });

  it("is safe on an empty book", () => {
    const e = computeEconomics({ guarantees: [], coverageRequired: 0n, totalAssets: 0n });
    expect(e.annualPremium).toBe(0);
    expect(e.lossRatio).toBe(0);
    expect(e.modeledApy).toBe(MODEL_ASSUMPTIONS.underlyingYield);
  });
});
