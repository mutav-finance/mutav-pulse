import { describe, it, expect } from "vitest";
import { getReserves, getReserve, isVerified, resolveAddress } from "./discovery";
import { config } from "./config";

const LIVE = config.contracts.vault;

describe("discovery seam", () => {
  it("getReserves returns the registry", () => {
    expect(getReserves().length).toBeGreaterThan(0);
  });
  it("resolves the live reserve by its vault address", () => {
    const r = getReserve(LIVE);
    expect(r?.currency).toBe("USDC");
    expect(isVerified(LIVE)).toBe(true);
  });
  it("an unknown but valid contract address is unverified, not found", () => {
    const unknown = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    expect(getReserve(unknown)).toBeUndefined();
    expect(isVerified(unknown)).toBe(false);
    expect(resolveAddress(unknown)).toBe("unverified");
  });
  it("classifies addresses", () => {
    expect(resolveAddress(LIVE)).toBe("verified");
    expect(resolveAddress("not-an-address")).toBe("invalid");
    expect(resolveAddress("GBADDRESSNOTACONTRACT")).toBe("invalid");
  });
  it("planned reserves (no address) are never resolvable by address", () => {
    const planned = getReserves().filter((r) => r.status === "planned");
    for (const p of planned) expect(p.address).toBeUndefined();
  });
});
