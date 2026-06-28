"use client";

/**
 * ReserveHealthHeader — compact reserve health strip for the /protocol cockpit.
 *
 * Design: Terminal front, copper accent (#B87010). Dense/utilitarian.
 * Shows: total_assets, free_capital, coverage_required, pending count, strategies.
 *
 * No rounded corners. JetBrains Mono numbers. Surface stacking only, no shadows.
 */

import type { ReactNode, CSSProperties } from "react";
import { fmtFiat, truncAddr, type Money } from "@/lib/format";
import { Mono } from "@/components/Mono";
import type { StrategyAlloc } from "vault";

interface ReserveHealthHeaderProps {
  totalAssets: bigint;
  freeCapital: bigint;
  coverageRequired: bigint;
  /** Reserve money context — denominates the value cells in the reserve's fiat. */
  money: Money;
  pendingCount: number;
  strategies: StrategyAlloc[];
  loading?: boolean;
  error?: string | null;
  /** Rendered below the metrics grid in the left column (e.g. the admin gate). */
  children?: ReactNode;
}

/** Single metric cell */
function HealthCell({
  label,
  value,
  copper = false,
  loading = false,
}: {
  label: string;
  value: string;
  copper?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: 0,
      }}
    >
      <p
        className="font-body"
        style={{
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.10em",
          color: "var(--color-text-3)",
          textTransform: "uppercase",
          margin: 0,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </p>
      {loading ? (
        <div
          aria-hidden="true"
          style={{
            height: "20px",
            width: "72px",
            backgroundColor: "var(--color-surface-3)",
          }}
        />
      ) : (
        <Mono copper={copper} style={{ fontSize: "15px", fontWeight: 500 }}>
          {value}
        </Mono>
      )}
    </div>
  );
}

export function ReserveHealthHeader({
  totalAssets,
  freeCapital,
  coverageRequired,
  money,
  pendingCount,
  strategies,
  loading = false,
  error,
  children,
}: ReserveHealthHeaderProps) {
  const utilization =
    totalAssets > 0n
      ? Math.round(
          (Number(coverageRequired) / Number(totalAssets)) * 100,
        )
      : 0;

  return (
    <div data-front="terminal">
      {/* Error overlay */}
      {error && !loading && (
        <div
          role="alert"
          style={{
            padding: "10px 20px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-error)",
            marginBottom: "16px",
          }}
        >
          <p
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-error)", margin: 0 }}
          >
            {error}
          </p>
        </div>
      )}

      {/* ── Two separate blocks: metrics grid (left) · strategy allocs (right) ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "stretch" }}>
        {/* Left column: metrics grid + the gate (children) below it */}
        <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              border: "1px solid var(--color-border)",
              display: "grid",
              // Collapse from 3 cols to 2/1 on narrow widths so the values don't
              // overflow on mobile (was a fixed repeat(3, 1fr)).
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1px",
              backgroundColor: "var(--color-border)",
            }}
          >
          {/* Total Assets */}
          <div style={{ backgroundColor: "var(--color-surface)" }}>
            <HealthCell
              label="Total Assets"
              value={loading ? "—" : fmtFiat(totalAssets, money)}
              loading={loading}
            />
          </div>

          {/* Free Capital — copper (it's the deployable buffer) */}
          <div style={{ backgroundColor: "var(--color-surface)" }}>
            <HealthCell
              label="Free Capital"
              value={loading ? "—" : fmtFiat(freeCapital, money)}
              copper
              loading={loading}
            />
          </div>

          {/* Coverage Required */}
          <div style={{ backgroundColor: "var(--color-surface)" }}>
            <HealthCell
              label="Coverage Required"
              value={loading ? "—" : fmtFiat(coverageRequired, money)}
              loading={loading}
            />
          </div>

          {/* Utilization % */}
          <div style={{ backgroundColor: "var(--color-surface)" }}>
            <HealthCell
              label="Utilization"
              value={loading ? "—" : `${utilization}%`}
              copper={utilization >= 80}
              loading={loading}
            />
          </div>

          {/* Pending Redemptions */}
          <div style={{ backgroundColor: "var(--color-surface)" }}>
            <HealthCell
              label="Pending Redemptions"
              value={loading ? "—" : String(pendingCount)}
              copper={pendingCount > 0}
              loading={loading}
            />
          </div>

          {/* Strategy Count */}
          <div style={{ backgroundColor: "var(--color-surface)" }}>
            <HealthCell
              label="Strategies"
              value={loading ? "—" : String(strategies.length)}
              loading={loading}
            />
          </div>
          </div>
          {children}
        </div>

        {/* Right card: strategy allocations as a list */}
        {!loading && strategies.length > 0 && (
          <div
            style={{
              flex: "1 1 320px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              className="font-body"
              style={{
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--color-text-3)",
                textTransform: "uppercase",
                padding: "14px 16px 12px",
              }}
            >
              Strategy Allocs
            </span>
            <div className="scroll-dark scroll-fade-y" style={{ overflow: "auto", maxHeight: "152px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFeatureSettings: '"tnum" 1' }}>
              <thead>
                <tr>
                  {["#", "Adapter", "Vault", "Alloc"].map((h, idx) => (
                    <th
                      key={h}
                      className="font-body"
                      style={{
                        textAlign: idx === 3 ? "right" : "left",
                        fontSize: "10px",
                        fontWeight: 500,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: "var(--color-text-3)",
                        padding: "8px 14px",
                        borderTop: "1px solid var(--color-border)",
                        borderBottom: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface-2)",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(3, strategies.length) }, (_, i) => {
                  const s = strategies[i];
                  const rowBg = i % 2 === 0 ? "var(--color-surface)" : "var(--color-canvas)";
                  const cell: CSSProperties = {
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--color-border)",
                    whiteSpace: "nowrap",
                  };
                  return (
                    <tr key={i} style={{ backgroundColor: rowBg }}>
                      <td style={cell}>
                        <Mono dim style={{ fontSize: "12px" }}>#{i + 1}</Mono>
                      </td>
                      {s ? (
                        <>
                          <td style={cell}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span className="font-body" style={{ fontSize: "12px", color: "var(--color-text)" }}>
                                DeFindex
                              </span>
                              {s.volatile && (
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: "8px",
                                    color: "var(--color-copper)",
                                    border: "1px solid var(--color-copper)",
                                    padding: "0 3px",
                                    letterSpacing: "0.06em",
                                  }}
                                >
                                  VOL
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={cell}>
                            <Mono dim style={{ fontSize: "11px" }}>
                              {truncAddr(s.address)}
                            </Mono>
                          </td>
                          <td style={{ ...cell, textAlign: "right" }}>
                            <Mono copper style={{ fontSize: "13px", fontWeight: 600 }}>
                              {(s.weight_bps / 100).toFixed(0)}%
                            </Mono>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={cell}>
                            <Mono dim style={{ fontSize: "12px", color: "var(--color-text-3)" }}>—</Mono>
                          </td>
                          <td style={cell}>
                            <Mono dim style={{ fontSize: "11px", color: "var(--color-text-3)" }}>—</Mono>
                          </td>
                          <td style={{ ...cell, textAlign: "right" }}>
                            <Mono dim style={{ fontSize: "13px", color: "var(--color-text-3)" }}>—</Mono>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Loading strategies placeholder card */}
        {loading && (
          <div style={{ flex: "1 1 240px", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "14px 20px", display: "flex", alignItems: "center" }}>
            <div
              aria-hidden="true"
              style={{
                height: "14px",
                width: "200px",
                backgroundColor: "var(--color-surface-3)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
