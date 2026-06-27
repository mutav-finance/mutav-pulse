"use client";

/**
 * useLiveAum — fetch each LIVE reserve's on-chain AUM (total_assets) once on
 * mount, keyed by vault address. `aumFor(reserve)` returns that reserve's own
 * formatted AUM ("…" until its read lands, "—" for reserves with no address).
 *
 * Shared by the homepage strip and /reserves.
 */

import { useEffect, useState, useCallback } from "react";
import { LIVE_RESERVES, PRIMARY_RESERVE, type Reserve } from "./reserves";
import { reserveReads } from "./contracts";
import { fmtFiat } from "./format";

export function useLiveAum() {
  // vault address -> total_assets (bigint); absent until that reserve's read lands.
  const [aum, setAum] = useState<Record<string, bigint>>({});
  // vault addresses whose read failed — render "—" instead of a perpetual "…".
  const [errored, setErrored] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    for (const r of LIVE_RESERVES) {
      reserveReads(r.contracts)
        .vaultTotalAssets()
        .then((v) => {
          if (!cancelled) setAum((m) => ({ ...m, [r.address]: v }));
        })
        .catch(() => {
          // Read failed (e.g. vault not reachable) — mark it so the card
          // settles on "—" rather than loading forever.
          if (!cancelled) setErrored((s) => new Set(s).add(r.address));
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  /** Formatted AUM for a reserve: its own live value, "…" while loading, "—" if no address or its read failed. */
  const aumFor = useCallback(
    (reserve: Reserve): string => {
      if (!reserve.address) return "—";
      const v = aum[reserve.address];
      if (v !== undefined) return fmtFiat(v, reserve);
      return errored.has(reserve.address) ? "—" : "…";
    },
    [aum, errored],
  );

  // Aggregate label for the primary reserve (the strip header uses this).
  const primaryLabel = aumFor(PRIMARY_RESERVE);

  return { primaryLabel, aumFor };
}
