import { describe, it, expect } from "vitest";
import { classifyRequest } from "./queue";

describe("classifyRequest", () => {
  it("claimed when claimed flag set", () => {
    expect(classifyRequest({ fulfilled: true, claimed: true, claimable: 100n } as any)).toBe("claimed");
  });
  it("claimable when fulfilled and not claimed", () => {
    expect(classifyRequest({ fulfilled: true, claimed: false, claimable: 100n } as any)).toBe("claimable");
  });
  it("pending when not fulfilled", () => {
    expect(classifyRequest({ fulfilled: false, claimed: false, claimable: 0n } as any)).toBe("pending");
  });
});
