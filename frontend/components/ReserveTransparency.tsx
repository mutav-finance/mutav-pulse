"use client";

/**
 * ReserveTransparency — live-detail body for a single reserve.
 *
 * Layout (top → bottom):
 *   - Header (standalone page title, or a compact label when `embedded`)
 *   - SolvencyChip (invariant: stable_assets >= coverage_required)
 *   - Metric card grid (7 cards, incl. NAV/APY)
 *   - Underwriting economics panel (4 cards + assumptions caption)
 *   - GuaranteeTable (active guarantees from registry)
 *   - VenueDirectory + caption
 *   - VerificationPanel
 *   - Footer: network indicator
 *
 * `embedded`: when true, render the left column of the 2-column hub — no outer
 * <main>, no big page title (the hub header identifies the reserve), just a
 * compact "RESERVE OVERVIEW" label + refresh control above the body.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import type { Reads } from "@/lib/contracts";
import type { Reserve } from "@/lib/reserves";
import { MetricCard } from "@/components/MetricCard";
import { AllocationDonut } from "@/components/AllocationDonut";
import { InfoTooltip } from "@/components/InfoTooltip";
import { GuaranteeTable } from "@/components/GuaranteeTable";
import { SolvencyChip } from "@/components/SolvencyChip";
import { VerificationPanel } from "@/components/VerificationPanel";
import { VenueDirectory } from "@/components/VenueDirectory";
import { fmtFiat, fmtNav, fmtPct2, fmtSignedPct, fmtShares, errMsg } from "@/lib/format";
import { computeEconomics } from "@/lib/economics";
import type { Guarantee } from "policy";

// ── Data shape ───────────────────────────────────────────────────────────────

interface TransparencyData {
  totalAssets: bigint;
  navPerShare: bigint;
  freeCapital: bigint;
  premiumIncome: bigint;
  totalSupply: bigint;
  stableAssets: bigint;
  coverageRequired: bigint;
  guarantees: Array<{ id: bigint; guarantee: Guarantee; isCurrent: boolean }>;
  loading: boolean;
  error: string | null;
}

const INITIAL: TransparencyData = {
  totalAssets: 0n,
  navPerShare: 0n,
  freeCapital: 0n,
  premiumIncome: 0n,
  totalSupply: 0n,
  stableAssets: 0n,
  coverageRequired: 0n,
  guarantees: [],
  loading: true,
  error: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--color-text-2)",
  textTransform: "uppercase",
  margin: 0,
};

/** Format a multiple ("4.9×") */
function fmtMult(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) + "×" : "∞";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReserveTransparency({
  reads,
  reserve,
  embedded = false,
}: {
  reads: Reads;
  reserve: Reserve;
  embedded?: boolean;
}) {
  const [data, setData] = useState<TransparencyData>(INITIAL);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Phase 1: vault reads (parallel)
      const [
        totalAssets,
        navPerShare,
        freeCapital,
        premiumIncome,
        totalSupply,
        stableAssets,
        coverageRequired,
        activeIds,
      ] = await Promise.all([
        reads.vaultTotalAssets(),
        reads.vaultNavPerShare(),
        reads.vaultFreeCapital(),
        reads.vaultPremiumIncome(),
        reads.vaultTotalSupply(),
        reads.vaultStableAssets(),
        reads.policyCoverageRequired(),
        reads.registryActiveIds(),
      ]);

      // Phase 2: guarantee details (parallel per ID)
      const guarantees = await Promise.all(
        activeIds.map(async (id) => {
          const bid = BigInt(id);
          const [guarantee, isCurrent] = await Promise.all([
            reads.policyGuarantee(bid),
            reads.policyIsCurrent(bid),
          ]);
          return { id: bid, guarantee, isCurrent };
        }),
      );

      setData({
        totalAssets,
        navPerShare,
        freeCapital,
        premiumIncome,
        totalSupply,
        stableAssets,
        coverageRequired,
        guarantees,
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
    fetchAll();
  }, [fetchAll]);

  const loading = data.loading;
  const error = data.error;

  // Model-backed economics derived from the live book, under the live reserve's
  // currency peg (lib/economics.ts + lib/reserves.ts).
  const econ = useMemo(
    () =>
      computeEconomics(
        {
          guarantees: data.guarantees,
          coverageRequired: data.coverageRequired,
          totalAssets: data.totalAssets,
        },
        reserve.assumptions,
      ),
    [data.guarantees, data.coverageRequired, data.totalAssets, reserve.assumptions],
  );
  const hasBook = !loading && data.totalAssets > 0n;

  // Reserve allocation (donut): committed (coverage) + buffer (free) = total.
  const totalNum = Number(data.totalAssets);
  const committedFrac = totalNum > 0 ? Number(data.coverageRequired) / totalNum : 0;
  const bufferFrac = totalNum > 0 ? Number(data.freeCapital) / totalNum : 0;
  // Arc geometry must stay within the ring even when the reserve is insolvent
  // (coverage > total → committedFrac > 1, freeCapital < 0 → bufferFrac < 0),
  // otherwise the committed arc overruns and overlaps the buffer arc. Clamp the
  // GEOMETRY only — the pct labels below keep the true ratio so ">100%" still
  // surfaces the danger.
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  const refreshControl = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
      <button
        onClick={fetchAll}
        disabled={loading}
        style={{
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-2)",
          padding: "8px 16px",
          fontSize: "12px",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: "0.04em",
        }}
      >
        {loading ? "LOADING…" : "↻ REFRESH"}
      </button>
      {lastRefreshed && (
        <span
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
        >
          {lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      )}
    </div>
  );

  const body = (
    <>
      {/* ── Header: compact (embedded) or full page title (standalone) ─── */}
      {embedded ? null : (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div>
            <p className="font-body" style={{ ...LABEL, margin: "0 0 8px" }}>
              MUTAV PULSE PROTOCOL
            </p>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(1.75rem, 1.278rem + 0.751vw, 2.25rem)",
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              RESERVE TRANSPARENCY
            </h1>
            <p
              className="font-body"
              style={{
                fontSize: "14px",
                color: "var(--color-text-2)",
                lineHeight: 1.5,
                marginTop: "8px",
                maxWidth: "520px",
              }}
            >
              Testnet on-chain reserve metrics, guarantee registry, yield venues, and contract verification — all reads from Soroban testnet. This is a proof-of-concept; values are not from a production reserve.
            </p>
          </div>
          {refreshControl}
        </div>
      )}

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-error)",
            marginBottom: "24px",
          }}
        >
          <p className="font-mono" style={{ fontSize: "12px", color: "var(--color-error)", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* ── Live reserve detail header ────────────────────────────────── */}
      <div
        style={{
          marginBottom: "16px",
          paddingTop: embedded ? undefined : "4px",
          borderTop: embedded ? undefined : "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: embedded ? "50%" : undefined, minWidth: embedded ? "240px" : undefined }}>
          <h2 className="font-display" style={{ ...LABEL, fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: embedded ? "0 0 4px" : "16px 0 4px" }}>
            <span style={{ color: "var(--color-accent)" }}>{reserve.currency}</span> RESERVE OVERVIEW
          </h2>
          <p
            className="font-body"
            style={{ fontSize: "13px", color: "var(--color-text-3)", margin: 0, lineHeight: 1.5 }}
          >
            On-chain metrics for the deployed {reserve.currency} reserve.
          </p>
        </div>
        <SolvencyChip
          stableAssets={data.stableAssets}
          coverageRequired={data.coverageRequired}
          money={reserve}
          loading={loading}
          error={error ?? undefined}
        />
      </div>

      {/* ── Refresh control (swapped with the solvency chip) ──────────── */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "flex-end" }}>
        {embedded && refreshControl}
      </div>

      {/* ── Allocation donut (left) + remaining metrics (right) ───────────
           Reserve value splits into Committed (coverage) + Buffer (free) →
           the donut. The metrics that aren't part of that split sit right. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "28px",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}
      >
        {/* Reserve allocation donut + legend — left */}
        <div style={{ flex: "0 0 auto" }}>
          <AllocationDonut
            loading={loading}
            centerDisplay={fmtFiat(data.totalAssets, reserve)}
            centerLabel="Reserve value"
            segments={[
              {
                label: "Committed to guarantees",
                display: fmtFiat(data.coverageRequired, reserve),
                pct: `${(committedFrac * 100).toFixed(1)}%`,
                fraction: clamp01(committedFrac),
                color: "var(--color-accent)",
              },
              {
                label: "Liquidity buffer",
                display: fmtFiat(data.freeCapital, reserve),
                pct: `${(bufferFrac * 100).toFixed(1)}%`,
                fraction: clamp01(bufferFrac),
                color: "var(--color-text-3)",
              },
            ]}
          />
        </div>

        {/* Soft vertical divider between the chart and the metrics */}
        <div
          aria-hidden="true"
          style={{ width: "1px", alignSelf: "stretch", backgroundColor: "var(--color-border)", margin: "6px 0" }}
        />

        {/* Right: metrics not encoded in the chart */}
        <div
          style={{
            flex: "1 1 260px",
            maxWidth: "300px",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "20px",
          }}
        >
          <MetricCard
            label="Modeled APY"
            value={hasBook ? fmtPct2(econ.modeledApy) : "—"}
            unit={`${fmtPct2(econ.underlyingYield)} yield ${fmtSignedPct(econ.underwritingSpread)} underwriting`}
            tooltip={`The projected annual return: underlying yield (${fmtPct2(econ.underlyingYield)}, assumed) plus the underwriting spread (premiums minus expected defaults, from the live book). Default risk is modeled at ${fmtPct2(econ.rho)} monthly delinquency (Índice Superlógica, South). See the whitepaper for the method.`}
            accentValue
            compact
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label={`NAV / ${reserve.currency}`}
            value={loading ? "—" : fmtNav(data.navPerShare)}
            unit={`${reserve.depositToken} per ${reserve.currency} share`}
            compact
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Premiums Collected"
            value={loading ? "—" : fmtFiat(data.premiumIncome, reserve)}
            // Value is an indicative fiat conversion (fmtFiat applies unitPriceFiat),
            // so the unit must NOT claim the deposit-token ticker — that mislabels
            // an R$ figure as a TESOURO amount for non-1:1 reserves.
            unit={`cumulative premium income · indicative ${reserve.fiatSymbol}`}
            compact
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Shares Outstanding"
            value={loading ? "—" : fmtShares(data.totalSupply)}
            unit={`${reserve.currency} shares issued`}
            compact
            loading={loading}
            error={error ?? undefined}
          />
        </div>
      </div>

      {/* ── Section label: underwriting economics ────────────────────── */}
      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <h2 className="font-display" style={{ ...LABEL, fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
          UNDERWRITING ECONOMICS
        </h2>
        <InfoTooltip label="Underwriting economics assumptions">
          The model uses two estimates: {fmtPct2(econ.rho)} of rents default each month
          (Índice Superlógica) and a {fmtPct2(econ.underlyingYield)} base yield. The spread on top
          is measured from real on-chain guarantees, not assumed. Method in the whitepaper.
        </InfoTooltip>
      </div>

      {/* ── Underwriting decomposition: 4 cards ───────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1px",
          backgroundColor: "var(--color-border)",
          border: "1px solid var(--color-border)",
          marginBottom: "32px",
        }}
      >
        <MetricCard
          label="Underlying Yield"
          value={fmtPct2(econ.underlyingYield)}
          accentValue
          unit="modeled base rate"
          tooltip="The base return on the reserve's capital before underwriting, set by the currency's reference rate (USD stablecoin DeFi ≈ 5.5%; a BRL reserve would use Selic ≈ 14%). A stated assumption, not an on-chain reading."
          loading={loading}
          error={error ?? undefined}
        />
        <MetricCard
          label="Underwriting Spread"
          value={hasBook ? fmtSignedPct(econ.underwritingSpread) : "—"}
          accentValue
          unit="premiums − expected defaults"
          tooltip="The additional return earned from underwriting guarantees: annual premiums minus expected default payouts, divided by total reserve assets. Computed from the live guarantee book and added on top of the underlying yield."
          loading={loading}
          error={error ?? undefined}
        />
        <MetricCard
          label="Loss Ratio"
          value={hasBook ? fmtPct2(econ.lossRatio) : "—"}
          accentValue
          unit="expected payout ÷ premiums"
          tooltip="Expected annual default payouts as a share of premium income. Below 100% indicates premiums fully cover expected losses; a healthy insurance book typically runs well under 50%."
          loading={loading}
          error={error ?? undefined}
        />
        <MetricCard
          label="Cushion"
          value={hasBook ? fmtMult(econ.cushion) : "—"}
          accentValue
          unit="vs break-even delinquency"
          tooltip={`The safety margin before underwriting becomes unprofitable: how far the monthly default rate can rise before premiums stop covering payouts. Break-even is ${fmtPct2(econ.breakevenRho)}, against the ${fmtPct2(econ.rho)} currently modeled.`}
          loading={loading}
          error={error ?? undefined}
        />
      </div>

      {/* ── Section label: guarantee registry ────────────────────────── */}
      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="font-display" style={{ ...LABEL, fontSize: "15px", fontWeight: 700, color: "var(--color-text)" }}>
          GUARANTEE REGISTRY
        </h2>
        <span
          className="font-mono"
          style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
        >
          {loading ? "…" : `${data.guarantees.length} active`}
        </span>
      </div>

      {/* ── Guarantee table ───────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <GuaranteeTable
          guarantees={data.guarantees}
          money={reserve}
          loading={loading}
          error={error ?? undefined}
        />
      </div>

      {/* ── Section label: yield venues ──────────────────────────────── */}
      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 className="font-display" style={{ ...LABEL, fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            PROTOCOL INTEGRATIONS
          </h2>
          <InfoTooltip label="Protocol integrations">
            On the deployed testnet reserve, capital is routed to on-chain yield venues via strategy adapters. The DeFindex adapter is live on testnet.
          </InfoTooltip>
        </div>
        <span
          className="font-mono"
          style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
        >
          1 live · 2 planned
        </span>
      </div>

      {/* ── Venue directory ───────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <VenueDirectory vaultId={reserve.contracts?.vault} />
      </div>

      {/* ── Verification panel ────────────────────────────────────────── */}
      <VerificationPanel />
    </>
  );

  // Embedded (left column of the 2-col hub): no <main>, no max-width centering.
  if (embedded) {
    return <div style={{ color: "var(--color-text)" }}>{body}</div>;
  }

  // Standalone page.
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "40px 32px 80px" }}>
        {body}
      </div>
    </main>
  );
}
