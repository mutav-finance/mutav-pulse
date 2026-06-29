import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { treatTxError, friendlyTxError, isFaucetCooldown, type TxContext } from "./errors";

// treatTxError logs the raw string on the unknown-fallback path; silence it so
// the deliberate unknown-fallback cases don't spam the test output.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("treatTxError — typed codes and literal strings", () => {
  const cases: Array<[string, string, string]> = [
    ["Account not found: GABC…", "account-not-found", "account"],
    ["User declined the transaction", "user-rejected-in-wallet", "auth"],
    ["Error(Contract, #13)", "missing-trustline", "trustline"],
    ["Error(Contract, #9)", "missing-allowance", "auth"],
    ["Error(Contract, #10)", "insufficient-token-balance", "balance"],
    ["Error(Contract, #100)", "insufficient-share-balance", "balance"],
    ["Error(Contract, #600)", "vault-insufficient-liquidity", "solvency"],
    ["Error(Contract, #507)", "soroswap-slippage-min-out", "amm"],
    ["Error(Contract, #503)", "soroswap-deadline-expired", "deadline"],
    ["Error(Contract, #4)", "wrong-signer-not-authorized", "auth"],
    ["Error(Auth, InvalidAction)", "wrong-signer-not-authorized", "auth"],
    [
      "HostError: Error(Storage, MissingValue) calling get_reserves",
      "soroswap-no-liquidity",
      "amm",
    ],
    ["op_low_reserve", "trustline-low-reserve", "trustline"],
    [
      "Simulation failed: restorePreamble present — entry archived, restoration required",
      "state-archived-restore",
      "storage",
    ],
    ["HostError: Error(Budget, ExceededLimit)", "unknown-fallback", "unknown"],
  ];

  it.each(cases)("%s → %s / %s", (input, expectedId, expectedCategory) => {
    const t = treatTxError(input);
    expect(t.id).toBe(expectedId);
    expect(t.category).toBe(expectedCategory);
    // Copy is always populated from the catalog.
    expect(t.message.length).toBeGreaterThan(0);
  });
});

describe("treatTxError — overloaded WasmVm trap disambiguation by context", () => {
  const trap = "UnreachableCodeReached: VM call trapped";

  it.each<[TxContext | undefined, string]>([
    ["faucet-drip", "faucet-cooldown"],
    ["sign-guarantee", "solvency-gate-signguarantee"],
    ["deposit", "invalid-or-disabled-call"],
    [undefined, "invalid-or-disabled-call"],
  ])("ctx %s → %s", (ctx, expectedId) => {
    expect(treatTxError(trap, ctx).id).toBe(expectedId);
  });

  it("literal 'insufficient capital' beats ctx (solvency even with no ctx)", () => {
    expect(
      treatTxError("Host: insufficient capital to cover guarantee").id,
    ).toBe("solvency-gate-signguarantee");
  });

  it("'insufficient capital' wins even under a faucet-drip ctx", () => {
    expect(
      treatTxError("insufficient capital to cover guarantee", "faucet-drip").id,
    ).toBe("solvency-gate-signguarantee");
  });
});

describe("treatTxError — ordering regressions", () => {
  it("stale-sequence beats network for a wrapped sendTransaction blob", () => {
    const blob = 'sendTransaction failed: {"txBAD_SEQ":true,"status":"ERROR"}';
    expect(treatTxError(blob).id).toBe("stale-sequence-or-fee");
  });

  it("TRY_AGAIN_LATER → network-rpc-transient", () => {
    expect(treatTxError("TRY_AGAIN_LATER").id).toBe("network-rpc-transient");
  });

  it("txTOO_LATE → network-rpc-transient", () => {
    expect(treatTxError("txTOO_LATE").id).toBe("network-rpc-transient");
  });

  it("txINSUFFICIENT_FEE → stale-sequence-or-fee", () => {
    expect(treatTxError("txINSUFFICIENT_FEE").id).toBe("stale-sequence-or-fee");
  });

  it("Stage 1 trap is NOT mis-keyed by the Error(Type,#Code) regex", () => {
    // Error(WasmVm, InvalidAction) must classify as a trap, not via the typed map.
    expect(treatTxError("Error(WasmVm, InvalidAction)", "deposit").id).toBe(
      "invalid-or-disabled-call",
    );
  });
});

describe("legacy wrappers", () => {
  it("isFaucetCooldown is true for a bare trap", () => {
    expect(isFaucetCooldown("UnreachableCodeReached")).toBe(true);
  });

  it("isFaucetCooldown is false for an unrelated error", () => {
    expect(isFaucetCooldown("Error(Contract, #13)")).toBe(false);
  });

  it("friendlyTxError returns the account-not-found userMessage", () => {
    expect(friendlyTxError("Account not found: G")).toBe(
      "This wallet isn't active on Stellar yet. Fund it before doing anything else.",
    );
  });

  it("friendlyTxError falls back for non-Error/non-string unknowns", () => {
    expect(friendlyTxError({ weird: true }, "Transaction failed")).toBe(
      "Transaction failed",
    );
  });
});
