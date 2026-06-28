import { describe, it, expect } from "vitest";
import { isSigner, isValidPubkey, type AccountSigner } from "./admin-account";

const SIGNERS: AccountSigner[] = [
  { key: "GA6LJT75ZRW3GWJ3NUQFBIL7CL66ITLT5BS35ZA7E7G35IOMGTSFJRIO", weight: 1 },
  { key: "GBGRCDMLN6NV7W64DUMCOOCRH3WEFU6PC5LIFCXSQQDDC7Q3MQAZK5O5", weight: 1 },
];

describe("isSigner", () => {
  it("matches a known signer", () => {
    expect(isSigner(SIGNERS, "GBGRCDMLN6NV7W64DUMCOOCRH3WEFU6PC5LIFCXSQQDDC7Q3MQAZK5O5")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isSigner(SIGNERS, "ga6ljt75zrw3gwj3nuqfbil7cl66itlt5bs35za7e7g35iomgtsfjrio")).toBe(true);
  });
  it("rejects a non-signer", () => {
    expect(isSigner(SIGNERS, "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ")).toBe(false);
  });
  it("rejects null/empty", () => {
    expect(isSigner(SIGNERS, null)).toBe(false);
    expect(isSigner(SIGNERS, undefined)).toBe(false);
    expect(isSigner(SIGNERS, "")).toBe(false);
  });
});

describe("isValidPubkey", () => {
  it("accepts a valid G-address", () => {
    expect(isValidPubkey("GBGRCDMLN6NV7W64DUMCOOCRH3WEFU6PC5LIFCXSQQDDC7Q3MQAZK5O5")).toBe(true);
  });
  it("tolerates surrounding whitespace", () => {
    expect(isValidPubkey("  GBGRCDMLN6NV7W64DUMCOOCRH3WEFU6PC5LIFCXSQQDDC7Q3MQAZK5O5  ")).toBe(true);
  });
  it("rejects junk and empty input", () => {
    expect(isValidPubkey("not-a-key")).toBe(false);
    expect(isValidPubkey("")).toBe(false);
    // a secret (S…) key is not a valid public key
    expect(isValidPubkey("SА6LJT75ZRW3GWJ3NUQFBIL7CL66ITLT5BS35ZA7E7G35IOMGTSFJRIO")).toBe(false);
  });
});
