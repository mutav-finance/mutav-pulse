"use client";

/**
 * useLiveAum — fetch the live reserve's on-chain AUM once on mount.
 *
 * Only the PRIMARY (live) reserve's total_assets is read. `aumFor(reserve)`
 * returns the formatted AUM for the primary reserve and "—" for any other
 * reserve. That guard matters before a 2nd reserve goes live: the home strip and
 * /reserves iterate every reserve, and without it they'd render the primary's
 * AUM against each `live` row. Each additional live reserve needs its own read.
 *
 * Shared by the homepage strip and /reserves (previously duplicated verbatim).
 */

import { useEffect, useState, useCallback } from "react";
import { PRIMARY_RESERVE, type Reserve } from "./reserves";
import { reserveReads } from "./contracts";
import { fmtUsd } from "./format";

export function useLiveAum() {
  const [liveAum, setLiveAum] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!PRIMARY_RESERVE.contracts) return;
    reserveReads(PRIMARY_RESERVE.contracts)
      .vaultTotalAssets()
      .then((v) => {
        if (!cancelled) setLiveAum(v);
      })
      .catch(() => {
        /* leave as null → renders "…" */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The primary reserve's AUM label ("…" until the read lands).
  const primaryLabel = liveAum === null ? "…" : fmtUsd(liveAum);

  /** Formatted AUM for a reserve: the live value for the primary, "—" otherwise. */
  const aumFor = useCallback(
    (reserve: Reserve): string =>
      reserve.address && reserve.address === PRIMARY_RESERVE.address
        ? primaryLabel
        : "—",
    [primaryLabel],
  );

  return { liveAum, primaryLabel, aumFor };
}
