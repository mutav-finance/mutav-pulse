import { describe, it, expect } from "vitest";
import { reserveReads, reads } from "./contracts";

describe("reserveReads", () => {
  it("returns an object exposing the expected read methods", () => {
    const r = reserveReads({ vault: "CA".padEnd(56, "A"), policy: "CB".padEnd(56, "B"), registry: "CC".padEnd(56, "C") });
    for (const m of ["vaultTotalAssets", "policyCoverageRequired", "registryActiveIds", "vaultNavPerShare"]) {
      expect(typeof (r as Record<string, unknown>)[m]).toBe("function");
    }
  });
  it("the default `reads` exposes the same surface", () => {
    expect(typeof reads.vaultTotalAssets).toBe("function");
  });
});
