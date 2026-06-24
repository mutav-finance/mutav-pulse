"use client";

/**
 * ReserveTransparency — live-detail body for a single reserve.
 *
 * Layout (top → bottom):
 *   - Live-reserve detail header (currency + tag)
 *   - SolvencyChip (invariant: stable_assets >= coverage_required)
 *   - Metric card grid (7 cards)
 *   - Underwriting economics panel (4 cards + assumptions caption)
 *   - GuaranteeTable (active guarantees from registry)
 *   - VenueDirectory + caption
 *   - VerificationPanel
 *   - Footer: network indicator
 *
 * Data: all reads from the `reads` prop (no wallet required).
 * Reserve-specific: economics assumptions and currency label come from `reserve`.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import type { Reads } from "@/lib/contracts";
import type { Reserve } from "@/lib/reserves";
import { MetricCard } from "@/components/MetricCard";
import { GuaranteeTable } from "@/components/GuaranteeTable";
import { SolvencyChip } from "@/components/SolvencyChip";
import { VerificationPanel } from "@/components/VerificationPanel";
import { VenueDirectory } from "@/components/VenueDirectory";
import { fmtUsd, fmtNav } from "@/lib/format";
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

/** Format a share count (bigint, stroops) as a plain integer with commas.
 *  Uses exact bigint division to avoid float precision issues on large supplies. */
function fmtShares(v: bigint): string {
  // 1 mtvR share = 10_000_000 stroops (7 decimal places)
  const whole = v / 10_000_000n;
  return whole.toLocaleString("en-US");
}

/** Format a rate (0.2493) as a percentage string ("24.93%") */
function fmtApy(v: number): string {
  return (v * 100).toFixed(2) + "%";
}

/** Format a signed rate with an explicit + sign for the spread contribution */
function fmtSignedPct(v: number): string {
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
}

/** Format a multiple ("4.9×") */
function fmtMult(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) + "×" : "∞";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReserveTransparency({ reads, reserve }: { reads: Reads; reserve: Reserve }) {
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
        error: err instanceof Error ? err.message : "Failed to load reserve data",
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

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* ── Page content ────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "40px 32px 80px",
        }}
      >
        {/* ── Page header ───────────────────────────────────────────────── */}
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
            <p
              className="font-body"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--color-text-2)",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
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

          {/* Refresh + last-updated */}
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
        </div>

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
            paddingTop: "4px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-2)",
              textTransform: "uppercase",
              margin: "16px 0 4px",
            }}
          >
            {reserve.currency}
            {reserve.tag ? ` (${reserve.tag})` : ""} RESERVE · TESTNET LIVE DETAIL
          </p>
          <p
            className="font-body"
            style={{ fontSize: "13px", color: "var(--color-text-3)", margin: 0, lineHeight: 1.5 }}
          >
            On-chain metrics for the deployed {reserve.currency} reserve —{" "}
            {reserve.underlying}. Other currencies share this contract shape,
            pegged to their own underlying and default market.
          </p>
        </div>

        {/* ── Solvency chip ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: "24px" }}>
          <SolvencyChip
            stableAssets={data.stableAssets}
            coverageRequired={data.coverageRequired}
            loading={loading}
            error={error ?? undefined}
          />
        </div>

        {/* ── Metric grid: 4 top / 3 bottom ─────────────────────────────── */}
        <div
          style={{
            backgroundColor: "var(--color-border)",
            border: "1px solid var(--color-border)",
            marginBottom: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "1px",
          }}
        >
          {/* Top row — 4 cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1px",
              backgroundColor: "var(--color-border)",
            }}
          >
          {/* 1. Reserve Value */}
          <MetricCard
            label="Reserve Value"
            value={loading ? "—" : fmtUsd(data.totalAssets)}
            unit="total assets · MUSD vault (USDC)"
            accentValue
            loading={loading}
            error={error ?? undefined}
          />

          {/* 2. NAV per mtvR */}
          <MetricCard
            label="NAV / MTVR"
            value={loading ? "—" : fmtNav(data.navPerShare)}
            unit="USDC per MTVR share"
            loading={loading}
            error={error ?? undefined}
          />

          {/* 3. Modeled APY — amber accent */}
          <MetricCard
            label="Modeled APY"
            value={hasBook ? fmtApy(econ.modeledApy) : "—"}
            unit={`${fmtApy(econ.underlyingYield)} yield ${fmtSignedPct(econ.underwritingSpread)} u/w`}
            tooltip={`Underlying yield (${fmtApy(econ.underlyingYield)}, assumed) + underwriting spread (premiums − expected defaults, on the live book). Default risk modeled at ${fmtApy(econ.rho)} monthly delinquency (Índice Superlógica, South). See whitepaper.`}
            accentValue
            loading={loading}
            error={error ?? undefined}
          />

          {/* 4. Committed to Guarantees */}
          <MetricCard
            label="Committed to Guarantees"
            value={loading ? "—" : fmtUsd(data.coverageRequired)}
            unit="coverage required · MUSD vault (USDC)"
            loading={loading}
            error={error ?? undefined}
          />
          </div>

          {/* Bottom row — 3 cards (centered/balanced) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1px",
              backgroundColor: "var(--color-border)",
            }}
          >
          {/* 5. Liquidity Buffer */}
          <MetricCard
            label="Liquidity Buffer"
            value={loading ? "—" : fmtUsd(data.freeCapital)}
            unit="free capital · USDC"
            tooltip="Surplus above guarantee coverage — backs redemptions and new guarantees."
            loading={loading}
            error={error ?? undefined}
          />

          {/* 6. Premiums Collected */}
          <MetricCard
            label="Premiums Collected"
            value={loading ? "—" : fmtUsd(data.premiumIncome)}
            unit="cumulative premium income · USDC"
            loading={loading}
            error={error ?? undefined}
          />

          {/* 7. Shares Outstanding */}
          <MetricCard
            label="Shares Outstanding"
            value={loading ? "—" : fmtShares(data.totalSupply)}
            unit="MTVR shares issued"
            loading={loading}
            error={error ?? undefined}
          />
          </div>
        </div>

        {/* ── Section label: underwriting economics ────────────────────── */}
        <div style={{ marginBottom: "12px" }}>
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-2)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            UNDERWRITING ECONOMICS
          </p>
        </div>

        {/* ── Underwriting decomposition: 4 cards ───────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            backgroundColor: "var(--color-border)",
            border: "1px solid var(--color-border)",
            marginBottom: "12px",
          }}
        >
          <MetricCard
            label="Underlying Yield"
            value={fmtApy(econ.underlyingYield)}
            unit="modeled base rate"
            tooltip="The assumed underlying yield for this reserve's currency peg (USD stablecoin DeFi ~5.5%). For reference, a BRL reserve would use Selic ~14%. A stated assumption, not an on-chain read."
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Underwriting Spread"
            value={hasBook ? fmtSignedPct(econ.underwritingSpread) : "—"}
            unit="premiums − expected defaults"
            tooltip="The protocol's edge over the base rate: annualized premium run-rate minus expected default payout, divided by total reserve. Computed from the live book."
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Loss Ratio"
            value={hasBook ? fmtApy(econ.lossRatio) : "—"}
            unit="expected payout ÷ premiums"
            tooltip="Expected annual default payout as a share of premium income. Below 100% means premiums cover expected defaults; insurer-healthy books run well under 50%."
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Cushion"
            value={hasBook ? fmtMult(econ.cushion) : "—"}
            unit="vs break-even delinquency"
            tooltip={`How far delinquency can rise before premiums stop covering defaults. Break-even is ${fmtApy(econ.breakevenRho)} monthly delinquency vs the ${fmtApy(econ.rho)} modeled.`}
            loading={loading}
            error={error ?? undefined}
          />
        </div>

        {/* ── Assumptions caption ───────────────────────────────────────── */}
        <p
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-text-3)",
            lineHeight: 1.5,
            margin: "0 0 32px",
            maxWidth: "720px",
          }}
        >
          Modeled at {fmtApy(econ.rho)} monthly delinquency (Índice Superlógica, South
          region, 60+ days overdue) and {fmtApy(econ.underlyingYield)} underlying yield
          ({reserve.currency} peg). The spread is computed from the live
          guarantee book; default and yield rates are stated assumptions. Method: see whitepaper.
        </p>

        {/* ── Section label: guarantee registry ────────────────────────── */}
        <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-2)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            GUARANTEE REGISTRY
          </p>
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
            loading={loading}
            error={error ?? undefined}
          />
        </div>

        {/* ── Section label: yield venues ──────────────────────────────── */}
        <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-2)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            PROTOCOL INTEGRATIONS
          </p>
          <span
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
          >
            1 live · 2 planned
          </span>
        </div>

        {/* ── Venue directory ───────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <VenueDirectory />
          <p
            className="font-body"
            style={{
              fontSize: "13px",
              color: "var(--color-text-3)",
              lineHeight: 1.5,
              margin: "16px 0 0",
            }}
          >
            On the deployed testnet reserve, capital is routed to on-chain yield venues via strategy adapters. The DeFindex adapter is live on testnet; Soroswap and Blend integrations are planned.
          </p>
        </div>

        {/* ── Verification panel ────────────────────────────────────────── */}
        <VerificationPanel />

        {/* ── Footer: network indicator ─────────────────────────────────── */}
        <div
          style={{
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span className="live-dot" aria-hidden="true" />
          <span
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
          >
            Stellar Testnet · PoC · live reads
          </span>
        </div>
      </div>
    </main>
  );
}
