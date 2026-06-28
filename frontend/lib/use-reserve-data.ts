"use client";

/**
 * useReserveData — owns the live read cycle for one reserve.
 *
 * Lifted out of <ReserveTransparency> so the reserve hub can render the refresh
 * control up in its page header (next to the Cockpit link) while the body stays
 * a presentational component fed by `data`. One fetch, one source of truth.
 *
 * Phase 1 reads the vault/policy/registry in parallel; Phase 2 fans out per
 * active guarantee id. `vaultStrategies` degrades to [] on failure so a vault
 * without a wired allocator still renders.
 */

import { useCallback, useEffect, useState } from "react";
import type { Reads } from "@/lib/contracts";
import { errMsg } from "@/lib/format";
import type { Guarantee } from "policy";
import type { StrategyAlloc } from "vault";

export interface ReserveData {
  totalAssets: bigint;
  navPerShare: bigint;
  freeCapital: bigint;
  premiumIncome: bigint;
  totalSupply: bigint;
  stableAssets: bigint;
  coverageRequired: bigint;
  /** Liquidity the vault holds itself; deployed = totalAssets − availableHeld. */
  availableHeld: bigint;
  guarantees: Array<{ id: bigint; guarantee: Guarantee; isCurrent: boolean }>;
  strategies: StrategyAlloc[];
  /** Live amount each strategy adapter holds, keyed by its address. */
  strategyBalances: Record<string, bigint>;
  loading: boolean;
  error: string | null;
}

export const INITIAL_RESERVE_DATA: ReserveData = {
  totalAssets: 0n,
  navPerShare: 0n,
  freeCapital: 0n,
  premiumIncome: 0n,
  totalSupply: 0n,
  stableAssets: 0n,
  coverageRequired: 0n,
  availableHeld: 0n,
  guarantees: [],
  strategies: [],
  strategyBalances: {},
  loading: true,
  error: null,
};

export interface UseReserveData {
  data: ReserveData;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  refresh: () => void;
}

export function useReserveData(reads: Reads): UseReserveData {
  const [data, setData] = useState<ReserveData>(INITIAL_RESERVE_DATA);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Phase 1: vault / policy / registry reads (parallel).
      const [
        totalAssets,
        navPerShare,
        freeCapital,
        premiumIncome,
        totalSupply,
        stableAssets,
        coverageRequired,
        availableHeld,
        activeIds,
        strategies,
      ] = await Promise.all([
        reads.vaultTotalAssets(),
        reads.vaultNavPerShare(),
        reads.vaultFreeCapital(),
        reads.vaultPremiumIncome(),
        reads.vaultTotalSupply(),
        reads.vaultStableAssets(),
        reads.policyCoverageRequired(),
        reads.vaultAvailableHeld(),
        reads.registryActiveIds(),
        reads.vaultStrategies().catch(() => [] as StrategyAlloc[]),
      ]);

      // Phase 2: guarantee details + per-strategy live balances (parallel).
      const [guarantees, strategyBalanceList] = await Promise.all([
        Promise.all(
          activeIds.map(async (id) => {
            const bid = BigInt(id);
            const [guarantee, isCurrent] = await Promise.all([
              reads.policyGuarantee(bid),
              reads.policyIsCurrent(bid),
            ]);
            return { id: bid, guarantee, isCurrent };
          }),
        ),
        Promise.all(
          strategies.map(async (s) => {
            // A single failing adapter shouldn't blank the whole section.
            const bal = await reads.strategyBalance(s.address).catch(() => null);
            return [s.address, bal] as const;
          }),
        ),
      ]);

      const strategyBalances: Record<string, bigint> = {};
      for (const [addr, bal] of strategyBalanceList) {
        if (bal !== null) strategyBalances[addr] = bal;
      }

      setData({
        totalAssets,
        navPerShare,
        freeCapital,
        premiumIncome,
        totalSupply,
        stableAssets,
        coverageRequired,
        availableHeld,
        guarantees,
        strategies,
        strategyBalances,
        loading: false,
        error: null,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: errMsg(err, "Failed to load reserve data"),
      }));
    }
  }, [reads]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading: data.loading, error: data.error, lastRefreshed, refresh };
}
