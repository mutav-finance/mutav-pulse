export const STROOP_SCALE = 10_000_000n;
export const STROOP_SCALE_NUM = 1e7;

/** Clamp a fraction into [0, 1] — used for allocation/gauge segment sizing. */
export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function errMsg(e: unknown, fallback = "Transaction failed"): string {
  if (e instanceof Error) return e.message;
  // Soroban contracts revert with bare strings (e.g. "invalid guarantee ID"),
  // so surface those verbatim rather than the generic fallback.
  if (typeof e === "string") return e;
  return fallback;
}

export function fromStroops(v: bigint): number {
  return Number(v) / STROOP_SCALE_NUM;
}

/**
 * Parse a user-entered decimal STRING into stroops (1e7 scale) exactly,
 * without going through a lossy float. Splits on ".", pads/truncates the
 * fractional part to 7 digits, and combines as BigInt.
 *
 * Returns null for empty/invalid input or any value ≤ 0 — so callers can
 * gate submission on a non-null result.
 *
 *   "1.2345678"  → 12345678n
 *   "0.0000001"  → 1n
 *   "1000000"    → 10000000000000n
 *   ""/"abc"/"0" → null
 */
export function parseToStroops(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Reject anything that isn't an unsigned decimal (no sign, no exponent).
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  const [wholeRaw = "", fracRaw = ""] = trimmed.split(".");
  // "." or "" with no digits at all is invalid.
  if (wholeRaw === "" && fracRaw === "") return null;
  // Pad/truncate the fractional part to exactly 7 digits (stroop precision).
  const frac = fracRaw.slice(0, 7).padEnd(7, "0");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const stroops = BigInt(whole) * STROOP_SCALE + BigInt(frac);
  return stroops > 0n ? stroops : null;
}
export function stroopsToInput(v: bigint): string {
  const whole = v / STROOP_SCALE;
  const frac = (v % STROOP_SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * Reserve money presentation. Every on-chain amount is denominated in the
 * reserve's DEPOSIT TOKEN (cUSD for MUSD, cTSR for MTESOURO) — not dollars. A
 * yield-bearing underlying like cTSR is not 1:1 with its fiat (1 cTSR ≈
 * R$1.22), so we render an INDICATIVE fiat value via `unitPriceFiat`. This is a
 * pure display concern; the contract accounts in token units and needs no price.
 *
 * `Reserve` structurally satisfies this, so call sites pass the reserve directly.
 */
export interface Money {
  depositToken: string;
  fiatSymbol: string;
  /** Indicative fiat price of one deposit-token unit (1 for fiat-pegged tokens). */
  unitPriceFiat: number;
}

/** Indicative fiat value of an on-chain amount: "R$1,234.93" / "$1,012.00". */
export function fmtFiat(v: bigint, m: Money): string {
  const fiat = fromStroops(v) * m.unitPriceFiat;
  return m.fiatSymbol + fiat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Exact on-chain amount + token ticker: "1,012.00 TESOURO". No price applied. */
export function fmtAmount(v: bigint, token: string): string {
  return fromStroops(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + token;
}

/** Indicative unit price line: "R$1.22107" (1 deposit-token = …). */
export function fmtUnitPrice(m: Money): string {
  return m.fiatSymbol + m.unitPriceFiat.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 });
}
export function fmtNav(v: bigint): string {
  return (Number(v) / 1e7).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
export function fmtBps(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}
/** Format a 0–1 rate as a 1-decimal percent ("5.5%"). Modeled-APY headlines. */
export function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}
export function fmtPct2(v: number): string {
  return (v * 100).toFixed(2) + "%";
}
export function fmtSignedPct(v: number): string {
  const sign = v >= 0 ? "+" : "-";
  return sign + (Math.abs(v) * 100).toFixed(2) + "%";
}
export function fmtShares(v: bigint): string {
  return (v / STROOP_SCALE).toLocaleString("en-US");
}
/** Share balance to 4 dp ("1,234.5678") — the deposit/redeem share readouts. */
export function fmtShares4(v: bigint): string {
  return fromStroops(v).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
export function truncAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
