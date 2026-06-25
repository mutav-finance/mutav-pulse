import { describe, it, expect } from "vitest";
import { fromStroops, stroopsToInput, fmtUsd, fmtNav, fmtBps, fmtPct, truncAddr } from "./format";

describe("format", () => {
  it("fromStroops divides by 1e7", () => {
    expect(fromStroops(10_000_000n)).toBe(1);
    expect(fromStroops(15_000_000n)).toBe(1.5);
  });
  it("stroopsToInput renders a trimmed decimal string", () => {
    expect(stroopsToInput(10_000_000n)).toBe("1");
    expect(stroopsToInput(15_000_000n)).toBe("1.5");
    expect(stroopsToInput(1n)).toBe("0.0000001");
    expect(stroopsToInput(10_000_001n)).toBe("1.0000001");
    expect(stroopsToInput(0n)).toBe("0");
  });
  it("fmtUsd renders 2dp with $", () => {
    expect(fmtUsd(1_012_0000000n)).toBe("$1,012.00");
  });
  it("fmtNav renders NAV_SCALE 1e7 as 1.0000", () => {
    expect(fmtNav(10_100_000n)).toBe("1.0100"); // nav_per_share scaled 1e7
  });
  it("fmtBps renders percent", () => {
    expect(fmtBps(1200)).toBe("12.00%");
  });
  it("fmtPct renders a 1-decimal percent", () => {
    expect(fmtPct(0.055)).toBe("5.5%");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(0.249)).toBe("24.9%");
  });
  it("truncAddr shortens", () => {
    expect(truncAddr("GBE3QZQSNKZQU7ESFUXFYT5ECZYRM5QM72QW2VKTPHH7TAHFEEPTWED3")).toBe("GBE3…WED3");
  });
});
