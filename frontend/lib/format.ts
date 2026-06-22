export function fromStroops(v: bigint): number {
  return Number(v) / 1e7;
}
export function stroopsToInput(v: bigint): string {
  const whole = v / 10_000_000n;
  const frac = (v % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
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
export function truncAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
