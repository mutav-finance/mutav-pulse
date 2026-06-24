"use client";

/**
 * /earn/transparency — Reserve Dashboard
 *
 * Layout (top → bottom):
 *   - Nav bar (shared with /earn)
 *   - Page header
 *   - SolvencyChip (invariant: stable_assets >= coverage_required)
 *   - Metric card grid (7 cards)
 *   - GuaranteeTable (active guarantees from registry)
 *   - VerificationPanel (on-chain contract links)
 *
 * Data: all reads from lib/contracts.ts reads object (no wallet required).
 * NAV snapshots: persisted to localStorage for APY estimation.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useEffect, useState, useCallback } from "react";
import { reads, type Attestation } from "@/lib/contracts";
import { config } from "@/lib/config";
import { MetricCard } from "@/components/MetricCard";
import { GuaranteeTable } from "@/components/GuaranteeTable";
import { SolvencyChip } from "@/components/SolvencyChip";
import { ZkSolvencyBadge } from "@/components/ZkSolvencyBadge";
import { VerificationPanel } from "@/components/VerificationPanel";
import { VenueDirectory } from "@/components/VenueDirectory";
import { fmtUsd, fmtNav } from "@/lib/format";
import { estimateApy, type NavSnap } from "@/lib/apy";
import type { Guarantee } from "policy";

// ── localStorage key for NAV snapshots ──────────────────────────────────────
const NAV_SNAP_KEY = "mtv_nav_snaps";
const MAX_SNAPS = 90; // keep ~90 days of daily snapshots

function loadSnaps(): NavSnap[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NAV_SNAP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ navScaled: string; t: number }>;
    return parsed.map((s) => ({ navScaled: BigInt(s.navScaled), t: s.t }));
  } catch {
    return [];
  }
}

function appendSnap(navScaled: bigint): NavSnap[] {
  const snaps = loadSnaps();
  const last = snaps[snaps.length - 1];
  const now = Date.now();

  // Deduplicate: only push if nav changed OR > 1h since last snap
  if (last && last.navScaled === navScaled && now - last.t < 3_600_000) {
    return snaps;
  }

  const next = [...snaps, { navScaled, t: now }].slice(-MAX_SNAPS);
  try {
    localStorage.setItem(
      NAV_SNAP_KEY,
      JSON.stringify(next.map((s) => ({ navScaled: String(s.navScaled), t: s.t }))),
    );
  } catch {
    // storage full — proceed without persisting
  }
  return next;
}

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
  apy: number;
  attestation: Attestation | null;
  attestationError: string | undefined;
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
  apy: 0,
  attestation: null,
  attestationError: undefined,
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

/** Format APY as percentage string */
function fmtApy(v: number): string {
  return (v * 100).toFixed(2) + "%";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransparencyPage() {
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

      // Persist NAV snapshot + compute APY
      const snaps = appendSnap(navPerShare);
      const apy = estimateApy(snaps);

      // ZK solvency seal — isolated: it's an add-on, a failure here does NOT take the
      // dashboard down. Distinguishes a "read error" (badge error) from "no proof" (null).
      let attestation: Attestation | null = null;
      let attestationError: string | undefined;
      try {
        attestation = await reads.solvencyAttestation();
      } catch (e) {
        attestationError = e instanceof Error ? e.message : "Failed to read the ZK proof";
      }

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
        apy,
        attestation,
        attestationError,
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
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const loading = data.loading;
  const error = data.error;

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
              MUTAV RESERVE
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
              Live on-chain reserve metrics, guarantee registry, yield venues, and
              contract verification. All values read directly from Soroban testnet.
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

        {/* ── ZK solvency seal (proved, privacy-preserving) ─────────────── */}
        <div style={{ marginBottom: "12px" }}>
          <ZkSolvencyBadge
            attestation={data.attestation}
            loading={loading}
            error={data.attestationError}
            onReverify={fetchAll}
            explorerUrl={`${config.explorerBase}/contract/${config.contracts.attestor}`}
            nowMs={lastRefreshed?.getTime()}
          />
        </div>

        {/* ── Solvency chip (public, on-chain invariant) ────────────────── */}
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
            unit="total assets · USDC"
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

          {/* 3. Net APY — amber accent */}
          <MetricCard
            label="Net APY"
            value={loading ? "—" : (data.apy > 0 ? fmtApy(data.apy) : "—")}
            unit={data.apy > 0 ? "estimated since launch" : "awaiting snapshots"}
            tooltip="Annualized NAV growth estimated from snapshots stored locally since your first visit."
            accentValue
            loading={loading}
            error={error ?? undefined}
          />

          {/* 4. Committed to Guarantees */}
          <MetricCard
            label="Committed to Guarantees"
            value={loading ? "—" : fmtUsd(data.coverageRequired)}
            unit="coverage required · USDC"
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
            YIELD VENUES
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
            The reserve is a diversified allocator — capital earns across multiple on-chain
            venues. DeFindex is live today; additional integrations are enabled as they reach
            production readiness.
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
            Stellar Testnet · live reads
          </span>
        </div>
      </div>
    </main>
  );
}
