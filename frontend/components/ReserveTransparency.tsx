"use client";

/**
 * ReserveTransparency — the reserve hub's story body (fund-detail layout).
 *
 * Presentational: data + refresh are owned by the hub page via `useReserveData`,
 * so the refresh control can live up in the page header. This component just
 * tells the reserve's story in four anchored sections, Goldfinch-Prime style:
 *
 *   Overview  — what the reserve is + headline KPIs + solvency invariant
 *   Policy    — underwriting: reserve allocation, economics, guarantee book
 *   Strategy  — yield deployment: strategy allocation + venues
 *   Contracts — every on-chain contract, described, with explorer links
 *
 * A sticky sub-nav (scroll-spy) sits under the global nav and tracks the section
 * in view. Two donuts split the story: the reserve allocation (committed vs
 * buffer) lives in Policy; the yield-strategy allocation lives in Strategy.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber). Brand tokens only,
 * no rounded corners, no shadows, amber kept scarce (solvency + live state).
 */

import { useEffect, useMemo, useState } from "react";
import type { Reserve } from "@/lib/reserves";
import type { ReserveData } from "@/lib/use-reserve-data";
import { MetricCard } from "@/components/MetricCard";
import { AllocationDonut } from "@/components/AllocationDonut";
import { AllocationBar, type BarSegment } from "@/components/AllocationBar";
import { InfoTooltip } from "@/components/InfoTooltip";
import { GuaranteeTable } from "@/components/GuaranteeTable";
import { SolvencyChip } from "@/components/SolvencyChip";
import { fmtFiat, fmtNav, fmtPct2, fmtSignedPct, fmtShares, fmtBps, truncAddr } from "@/lib/format";
import { computeEconomics } from "@/lib/economics";
import { resolveProvider, venueName } from "@/lib/providers";
import { config, contractUrl } from "@/lib/config";

// ── Layout constants ───────────────────────────────────────────────────────────

const NAV_H = 56; // global NavShell height
const SUBNAV_H = 49; // this section sub-nav
const ANCHOR_OFFSET = NAV_H + SUBNAV_H + 16; // scrollMarginTop for section anchors

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "policy", label: "Policy" },
  { id: "strategy", label: "Strategy" },
  { id: "contracts", label: "Contracts" },
] as const;
const SECTION_IDS = SECTIONS.map((s) => s.id);

const DONUT_SIZE = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--color-text-2)",
  textTransform: "uppercase",
  margin: 0,
};

/** Format a multiple ("4.9×"). */
function fmtMult(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) + "×" : "∞";
}

/** Highlight the section currently in view. */
function useScrollSpy(ids: readonly string[], offset: number): string {
  const [active, setActive] = useState<string>(ids[0]);
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: `-${offset}px 0px -55% 0px`, threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids, offset]);
  return active;
}

// ── Sub-nav ─────────────────────────────────────────────────────────────────

function SubNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Reserve sections"
      style={{
        position: "sticky",
        top: `${NAV_H}px`,
        zIndex: 40, // below the global nav (100), above content
        display: "flex",
        gap: "4px",
        alignItems: "stretch",
        margin: "0 0 32px",
        backgroundColor: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-border)",
        overflowX: "auto",
      }}
    >
      {SECTIONS.map((s) => {
        const on = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="font-body"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "13px 16px",
              fontSize: "13px",
              fontWeight: on ? 600 : 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              textDecoration: "none",
              color: on ? "var(--color-accent)" : "var(--color-text-2)",
              borderBottom: `2px solid ${on ? "var(--color-accent)" : "transparent"}`,
              marginBottom: "-1px",
            }}
          >
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}

// ── Section primitives ─────────────────────────────────────────────────────────

function Section({
  id,
  title,
  intro,
  aside,
  children,
}: {
  id: string;
  title: string;
  intro: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        scrollMarginTop: `${ANCHOR_OFFSET}px`,
        paddingTop: "8px",
        marginBottom: "56px",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
          margin: "20px 0 24px",
        }}
      >
        <div style={{ maxWidth: "62ch" }}>
          <h2
            className="font-display"
            style={{
              fontSize: "20px",
              letterSpacing: "0.01em",
              textTransform: "uppercase",
              color: "var(--color-text)",
              margin: "0 0 10px",
            }}
          >
            {title}
          </h2>
          <p
            className="font-body"
            style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--color-text-2)", margin: 0 }}
          >
            {intro}
          </p>
        </div>
        {aside && <div style={{ flexShrink: 0, maxWidth: "100%", minWidth: 0 }}>{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Donut on the left, a metric grid filling the rest — separated, big-screen safe. */
function ChartRow({ donut, cards }: { donut: React.ReactNode; cards: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "28px",
        alignItems: "flex-start",
        marginBottom: "28px",
      }}
    >
      <div style={{ flex: "0 0 auto", maxWidth: "100%", minWidth: 0, paddingTop: "4px" }}>{donut}</div>
      <div style={{ flex: "1 1 320px", minWidth: 0, ...hairlineGrid(160) }}>
        {cards}
      </div>
    </div>
  );
}

/** Brutalist hairline grid — 1px gaps over the border color, no radius/shadow. */
const hairlineGrid = (minPx: number): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(${minPx}px, 1fr))`,
  gap: "1px",
  backgroundColor: "var(--color-border)",
  border: "1px solid var(--color-border)",
});

const SUBHEAD: React.CSSProperties = {
  ...LABEL,
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--color-text)",
};

// AllocationBar + BarSegment now live in components/AllocationBar.tsx (shared
// with the operator Strategies tab so both render the same allocation picture).

// ── Strategy allocation table row ─────────────────────────────────────────────

/** Right-aligned mono numeric cell — repeated across the allocation table. */
const numCell: React.CSSProperties = {
  padding: "14px",
  fontSize: "13px",
  textAlign: "right",
  fontFeatureSettings: '"tnum" 1',
};

/** One row of the allocation table — a strategy venue OR the in-vault asset. */
interface AllocRow {
  key: string;
  name: string;
  url: string;
  blurb: string;
  /** Adapter address to show as an "Adapter … ↗" sub-line (venues only). */
  adapterAddr?: string;
  type: string;
  targetBps: number;
  /** Live amount; undefined renders "—". */
  amount?: bigint;
  yieldPct: number;
  yieldModeled: boolean;
  status: "live" | "liquid";
}

function AllocRowView({ row, reserve }: { row: AllocRow; reserve: Reserve }) {
  return (
    <tr
      style={{
        borderTop: "1px solid var(--color-border)",
        verticalAlign: "top",
        backgroundColor: row.status === "liquid" ? "var(--color-surface)" : undefined,
      }}
    >
      <td style={{ padding: "14px", maxWidth: "320px" }}>
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body"
          style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", textDecoration: "none" }}
        >
          {row.name}
        </a>
        <p className="font-body" style={{ fontSize: "11px", lineHeight: 1.45, color: "var(--color-text-3)", margin: row.adapterAddr ? "4px 0 6px" : "4px 0 0" }}>
          {row.blurb}
        </p>
        {row.adapterAddr && (
          <a
            href={contractUrl(row.adapterAddr)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{ fontSize: "10px", color: "var(--color-text-3)", textDecoration: "none", letterSpacing: "0.02em" }}
          >
            Adapter {truncAddr(row.adapterAddr)} ↗
          </a>
        )}
      </td>
      <td className="font-body" style={{ padding: "14px", fontSize: "12px", color: "var(--color-text-2)" }}>
        {row.type}
      </td>
      <td className="font-mono" style={{ ...numCell, color: "var(--color-text-2)" }}>
        {fmtBps(row.targetBps)}
      </td>
      <td className="font-mono" style={{ ...numCell, color: "var(--color-text)" }}>
        {row.amount === undefined ? "—" : fmtFiat(row.amount, reserve)}
      </td>
      <td className="font-mono" style={{ ...numCell, color: row.yieldModeled ? "var(--color-accent)" : "var(--color-text-3)" }}>
        {fmtPct2(row.yieldPct)}
        {row.yieldModeled && (
          <div style={{ fontSize: "9px", color: "var(--color-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>modeled</div>
        )}
      </td>
      <td style={{ padding: "14px" }}>
        {row.status === "live" ? (
          <span className="font-mono" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-accent)" }}>
            <span className="live-dot" aria-hidden="true" /> Live
          </span>
        ) : (
          <span className="font-mono" style={{ fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-3)" }}>
            Liquid
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Contract directory data ────────────────────────────────────────────────────

interface ContractRow {
  role: string;
  id: string;
  desc: string;
}

function contractRows(): ContractRow[] {
  const rows: ContractRow[] = [
    { role: "Vault", id: config.contracts.vault, desc: "Custody, tokenized shares & NAV, the redemption queue, and the strategy allocator." },
    { role: "Policy", id: config.contracts.policy, desc: "The underwriting brain — fee-gated coverage and default payouts." },
    { role: "Registry", id: config.contracts.registry, desc: "Writer-gated store of the active guarantee book." },
    { role: "USDC", id: config.contracts.usdc, desc: "The reserve's underlying asset (Stellar asset contract)." },
  ];
  if (config.contracts.adapter) {
    rows.push({ role: "DeFindex adapter", id: config.contracts.adapter, desc: "Strategy adapter that deploys reserve capital into DeFindex yield." });
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReserveTransparency({
  reserve,
  data,
  loading,
  error,
}: {
  reserve: Reserve;
  data: ReserveData;
  loading: boolean;
  error: string | null;
}) {
  const active = useScrollSpy(SECTION_IDS, ANCHOR_OFFSET);

  // Model-backed economics derived from the live book.
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

  // Reserve allocation (Policy donut): committed (coverage) + buffer (free) = total.
  const totalNum = Number(data.totalAssets);
  const committedFrac = totalNum > 0 ? Number(data.coverageRequired) / totalNum : 0;
  const bufferFrac = totalNum > 0 ? Number(data.freeCapital) / totalNum : 0;
  // Clamp geometry only (insolvency can push coverage > total); labels keep truth.
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  // Strategy ALLOCATION — where the reserve's capital actually sits right now,
  // broken across each venue + idle cash. The vault identity is
  //   total_assets = availableHeld + Σ strategy balances
  // so these REAL balances partition the reserve and sum to total. This is the
  // allocation (live), distinct from the allocator's TARGET weights (weight_bps).
  const TOTAL_BPS = 10_000;
  const stratSum = data.strategies.reduce((a, s) => a + s.weight_bps, 0);
  const idleBps = Math.max(0, TOTAL_BPS - stratSum);

  const idleFrac = totalNum > 0 ? Number(data.availableHeld) / totalNum : 0;

  // One allocation slice per strategy (real balance) + the undeployed remainder,
  // which the vault holds directly as its underlying asset; sums to total.
  const ALLOC_COLORS = ["var(--color-accent)", "var(--color-text-2)", "var(--color-copper, var(--color-text-2))"];
  const allocationSegments: BarSegment[] = [
    ...data.strategies.map((s, i) => {
      const bal = data.strategyBalances[s.address] ?? 0n;
      return {
        label: venueName(s.address),
        display: fmtFiat(bal, reserve),
        fraction: totalNum > 0 ? Number(bal) / totalNum : 0,
        color: ALLOC_COLORS[i % ALLOC_COLORS.length],
      };
    }),
    {
      label: `${reserve.depositToken} · in vault`,
      display: fmtFiat(data.availableHeld, reserve),
      fraction: idleFrac,
      color: "var(--color-text-3)",
    },
  ];

  // Same allocation as table rows: one per strategy venue + the in-vault asset.
  const heldYieldBearing = reserve.underlyingYieldBearing;
  const allocRows: AllocRow[] = [
    ...data.strategies.map((s) => {
      const provider = resolveProvider(s.address);
      return {
        key: s.address,
        name: provider?.name ?? venueName(s.address),
        url: provider?.url ?? contractUrl(s.address),
        blurb: provider?.blurb ?? "On-chain strategy adapter wired to this vault.",
        adapterAddr: s.address,
        type: s.volatile ? "Volatile yield" : "Stable yield",
        targetBps: s.weight_bps,
        amount: data.strategyBalances[s.address],
        yieldPct: econ.underlyingYield,
        yieldModeled: true,
        status: "live" as const,
      };
    }),
    {
      key: "in-vault",
      name: reserve.depositToken,
      url: contractUrl(config.contracts.usdc),
      blurb: heldYieldBearing
        ? `Held directly in the vault. ${reserve.depositToken} is yield-bearing, so it accrues its base yield even when not deployed.`
        : "Held directly in the vault — not deployed to any venue. Liquid for operations and redemptions.",
      type: heldYieldBearing ? "Yield-bearing asset" : "Cash · underlying",
      targetBps: idleBps,
      amount: data.availableHeld,
      yieldPct: heldYieldBearing ? reserve.assumptions.underlyingYield : 0,
      yieldModeled: heldYieldBearing,
      status: "liquid" as const,
    },
  ];

  return (
    <div style={{ color: "var(--color-text)" }}>
      <SubNav active={active} />

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

      {/* ══ OVERVIEW ════════════════════════════════════════════════════ */}
      <Section
        id="overview"
        title="Overview"
        intro={
          <>
            The <span style={{ color: "var(--color-accent)" }}>{reserve.currency}</span> reserve is a
            solvency-gated, tokenized vault that backs Brazilian rental guarantees and turns their
            fees into yield. Deposit {reserve.depositToken}, receive {reserve.currency} shares at
            NAV, and redeem from surplus. Running on Stellar testnet as a proof of concept — values are
            live on-chain reads, not a production reserve.
          </>
        }
        aside={
          <SolvencyChip
            stableAssets={data.stableAssets}
            coverageRequired={data.coverageRequired}
            money={reserve}
            loading={loading}
            error={error ?? undefined}
          />
        }
      >
        <div style={hairlineGrid(170)}>
          <MetricCard
            label="Reserve Value"
            value={loading ? "—" : fmtFiat(data.totalAssets, reserve)}
            unit={`total assets · ${reserve.fiatSymbol}`}
            accentValue
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Modeled APY"
            value={hasBook ? fmtPct2(econ.modeledApy) : "—"}
            unit="underlying + underwriting"
            tooltip={`Projected annual return: underlying yield (${fmtPct2(econ.underlyingYield)}, assumed) plus the underwriting spread from the live book. Default risk modeled at ${fmtPct2(econ.rho)} monthly delinquency.`}
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label={`NAV / ${reserve.currency}`}
            value={loading ? "—" : fmtNav(data.navPerShare)}
            unit={`${reserve.depositToken} per share`}
            loading={loading}
            error={error ?? undefined}
          />
          <MetricCard
            label="Shares Outstanding"
            value={loading ? "—" : fmtShares(data.totalSupply)}
            unit={`${reserve.currency} issued`}
            loading={loading}
            error={error ?? undefined}
          />
        </div>
      </Section>

      {/* ══ POLICY ══════════════════════════════════════════════════════ */}
      <Section
        id="policy"
        title="Policy"
        intro={
          <>
            The underwriting brain. The reserve writes fee-gated coverage on rental guarantees and
            pays tenant defaults — while the solvency invariant keeps committed coverage at or below
            stable assets, always.
          </>
        }
        aside={
          <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}>
            {loading ? "…" : `${data.guarantees.length} active`}
          </span>
        }
      >
        <ChartRow
          donut={
            <AllocationDonut
              loading={loading}
              size={DONUT_SIZE}
              ariaLabel="Reserve allocation — committed coverage vs liquidity buffer"
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
          }
          cards={
            <>
              <MetricCard
                label="Underlying Yield"
                value={fmtPct2(econ.underlyingYield)}
                accentValue
                unit="modeled base rate"
                tooltip="Base return on the reserve's capital before underwriting, set by the currency's reference rate. A stated assumption, not an on-chain reading."
                loading={loading}
                error={error ?? undefined}
              />
              <MetricCard
                label="Underwriting Spread"
                value={hasBook ? fmtSignedPct(econ.underwritingSpread) : "—"}
                accentValue
                unit="fees − expected defaults"
                tooltip="Extra return from underwriting: annual fees minus expected default payouts, over total assets. From the live book."
                loading={loading}
                error={error ?? undefined}
              />
              <MetricCard
                label="Loss Ratio"
                value={hasBook ? fmtPct2(econ.lossRatio) : "—"}
                accentValue
                unit="expected payout ÷ fees"
                tooltip="Expected annual default payouts as a share of fee income. Below 100% means fees cover expected losses."
                loading={loading}
                error={error ?? undefined}
              />
              <MetricCard
                label="Cushion"
                value={hasBook ? fmtMult(econ.cushion) : "—"}
                accentValue
                unit="vs break-even delinquency"
                tooltip={`How far monthly defaults can rise before fees stop covering payouts. Break-even ${fmtPct2(econ.breakevenRho)} vs ${fmtPct2(econ.rho)} modeled.`}
                loading={loading}
                error={error ?? undefined}
              />
              <MetricCard
                label="Fees Collected"
                value={loading ? "—" : fmtFiat(data.feeIncome, reserve)}
                unit={`cumulative · indicative ${reserve.fiatSymbol}`}
                loading={loading}
                error={error ?? undefined}
              />
              <MetricCard
                label="Coverage Required"
                value={loading ? "—" : fmtFiat(data.coverageRequired, reserve)}
                unit="committed to active guarantees"
                loading={loading}
                error={error ?? undefined}
              />
            </>
          }
        />

        <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 className="font-display" style={SUBHEAD}>Guarantee Registry</h3>
          <InfoTooltip label="Guarantee registry">
            Active guarantees underwritten by this reserve, read live from the registry contract.
          </InfoTooltip>
        </div>
        <GuaranteeTable
          guarantees={data.guarantees}
          money={reserve}
          loading={loading}
          error={error ?? undefined}
        />
      </Section>

      {/* ══ STRATEGY ════════════════════════════════════════════════════ */}
      <Section
        id="strategy"
        title="Strategy"
        intro={
          <>
            Mutav vaults put reserve capital to work through <strong style={{ color: "var(--color-text-2)" }}>strategies</strong> and{" "}
            <strong style={{ color: "var(--color-text-2)" }}>adapters</strong>. A strategy is a target
            allocation — the weight the vault&apos;s allocator aims to hold in a venue. An adapter is the
            on-chain contract that actually moves capital into that venue (DeFindex, for example) and
            reports its live balance back. The allocator rebalances toward the targets while keeping the
            rest liquid in the vault. Everything below is read live on-chain.
          </>
        }
        aside={
          <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}>
            {loading ? "…" : `${data.strategies.length} wired`}
          </span>
        }
      >
        {/* Chart — allocation across each venue + the asset held in-vault, summing to total. */}
        <AllocationBar loading={loading} segments={allocationSegments} />

        {/* Table — each strategy option: provider, adapter, amount, yield. */}
        <div className="scroll-fade-x" style={{ overflowX: "auto", marginBottom: "16px", border: "1px solid var(--color-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "680px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-surface-2)" }}>
                {["Provider", "Type", "Target", "Amount", "Yield", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className="font-body"
                    style={{
                      textAlign: i >= 2 && i <= 4 ? "right" : "left",
                      padding: "10px 14px",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--color-text-3)",
                      borderBottom: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="font-mono" style={{ padding: "16px 14px", fontSize: "12px", color: "var(--color-text-3)" }}>
                    Loading strategies…
                  </td>
                </tr>
              ) : (
                allocRows.map((row) => <AllocRowView key={row.key} row={row} reserve={reserve} />)
              )}
            </tbody>
          </table>
        </div>
        <p className="font-mono" style={{ fontSize: "10px", color: "var(--color-text-3)", margin: 0, letterSpacing: "0.02em", lineHeight: 1.5 }}>
          Target = allocator intent (weight). Amount = live on-chain balance. Yield = modeled annual rate, not realized. Idle {reserve.depositToken} earns no yield on this reserve.
        </p>
      </Section>

      {/* ══ CONTRACTS ═══════════════════════════════════════════════════ */}
      <Section
        id="contracts"
        title="Contracts"
        intro={
          <>
            No black box. Every number above reads from these Soroban contracts — open any of them on
            the explorer to verify.
          </>
        }
      >
        <div style={hairlineGrid(280)}>
          {contractRows().map(({ role, id, desc }) => (
            <a
              key={role}
              href={contractUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${role} contract on Stellar Explorer`}
              className="contract-row"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "18px 18px",
                backgroundColor: "var(--color-surface)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
                <span
                  className="font-body"
                  style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text)" }}
                >
                  {role}
                </span>
                <span
                  data-contract-id
                  className="font-mono"
                  style={{ fontSize: "12px", color: "var(--color-text-2)", letterSpacing: "0.01em", fontFeatureSettings: '"tnum" 1' }}
                >
                  {truncAddr(id)}
                </span>
              </div>
              <p className="font-body" style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--color-text-3)", margin: 0 }}>
                {desc}
              </p>
              <span
                aria-hidden="true"
                className="font-mono"
                style={{ fontSize: "10px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
              >
                → stellar.expert / testnet
              </span>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}
