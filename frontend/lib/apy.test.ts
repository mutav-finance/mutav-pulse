import { describe, it, expect } from "vitest";
import { estimateApy } from "./apy";

describe("estimateApy", () => {
  it("annualizes nav growth over elapsed days", () => {
    // nav 1.00 -> 1.01 over 30 days ~ (0.01/1)*(365/30) ≈ 0.1217
    const apy = estimateApy([
      { navScaled: 10_000_000n, t: 0 },
      { navScaled: 10_100_000n, t: 30 * 86400 * 1000 },
    ]);
    expect(apy).toBeGreaterThan(0.11);
    expect(apy).toBeLessThan(0.13);
  });
  it("returns 0 with <2 snapshots", () => {
    expect(estimateApy([])).toBe(0);
  });
});
