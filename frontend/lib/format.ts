export const STROOP_SCALE = 10_000_000n;
export const STROOP_SCALE_NUM = 1e7;

export function errMsg(e: unknown, fallback = "Transaction failed"): string {
  return e instanceof Error ? e.message : fallback;
}

export function fromStroops(v: bigint): number {
  return Number(v) / STROOP_SCALE_NUM;
}
export function stroopsToInput(v: bigint): string {
  const whole = v / STROOP_SCALE;
  const frac = (v % STROOP_SCALE).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
export function fmtUsd(v: bigint): string {
  return "$" + fromStroops(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
export function truncAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
