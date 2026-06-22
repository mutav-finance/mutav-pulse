export type NavSnap = { navScaled: bigint; t: number };

export function estimateApy(snaps: NavSnap[]): number {
  if (snaps.length < 2) return 0;
  const a = snaps[0], b = snaps[snaps.length - 1];
  const days = (b.t - a.t) / 86_400_000;
  if (days <= 0) return 0;
  const growth = Number(b.navScaled - a.navScaled) / Number(a.navScaled);
  return growth * (365 / days);
}
