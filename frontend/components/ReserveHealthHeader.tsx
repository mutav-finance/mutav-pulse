"use client";

/**
 * ReserveHealthHeader — compact reserve health strip for the /protocol cockpit.
 *
 * Design: Terminal front, copper accent (#B87010). Dense/utilitarian.
 * Shows: total_assets, free_capital, coverage_required, pending count, strategies.
 *
 * No rounded corners. JetBrains Mono numbers. Surface stacking only, no shadows.
 */

import { fmtUsd } from "@/lib/format";
import { Mono } from "@/components/Mono";
import type { StrategyAlloc } from "vault";

interface ReserveHealthHeaderProps {
  totalAssets: bigint;
  freeCapital: bigint;
  coverageRequired: bigint;
  pendingCount: number;
  strategies: StrategyAlloc[];
  loading?: boolean;
  error?: string | null;
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
  pendingCount,
  strategies,
  loading = false,
  error,
}: ReserveHealthHeaderProps) {
  const utilization =
    totalAssets > 0n
      ? Math.round(
          (Number(coverageRequired) / Number(totalAssets)) * 100,
        )
      : 0;

  return (
    <div
      data-front="terminal"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        position: "relative",
      }}
    >
      {/* Error overlay */}
      {error && !loading && (
        <div
          role="alert"
          style={{
            padding: "10px 20px",
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-error)",
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

      {/* Metrics row — hairline-separated cells */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Separator between cells via box shadow on right */}
        <div
          style={{
            display: "contents",
          }}
        >
          {/* Total Assets */}
          <div style={{ borderRight: "1px solid var(--color-border)" }}>
            <HealthCell
              label="Total Assets"
              value={loading ? "—" : fmtUsd(totalAssets)}
              loading={loading}
            />
          </div>

          {/* Free Capital — copper (it's the deployable buffer) */}
          <div style={{ borderRight: "1px solid var(--color-border)" }}>
            <HealthCell
              label="Free Capital"
              value={loading ? "—" : fmtUsd(freeCapital)}
              copper
              loading={loading}
            />
          </div>

          {/* Coverage Required */}
          <div style={{ borderRight: "1px solid var(--color-border)" }}>
            <HealthCell
              label="Coverage Required"
              value={loading ? "—" : fmtUsd(coverageRequired)}
              loading={loading}
            />
          </div>

          {/* Utilization % */}
          <div style={{ borderRight: "1px solid var(--color-border)" }}>
            <HealthCell
              label="Utilization"
              value={loading ? "—" : `${utilization}%`}
              copper={utilization >= 80}
              loading={loading}
            />
          </div>

          {/* Pending Redemptions */}
          <div style={{ borderRight: "1px solid var(--color-border)" }}>
            <HealthCell
              label="Pending Redemptions"
              value={loading ? "—" : String(pendingCount)}
              copper={pendingCount > 0}
              loading={loading}
            />
          </div>

          {/* Strategy Count */}
          <div>
            <HealthCell
              label="Strategies"
              value={loading ? "—" : String(strategies.length)}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Strategy allocations strip — only when strategies exist */}
      {!loading && strategies.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0",
            padding: "8px 20px",
            alignItems: "center",
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
              marginRight: "16px",
              flexShrink: 0,
            }}
          >
            Strategy Allocs
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}
          >
            {strategies.map((s) => (
              <div
                key={s.address}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Mono
                  copper
                  style={{ fontSize: "12px" }}
                >
                  {(s.weight_bps / 100).toFixed(0)}%
                </Mono>
                <Mono
                  dim
                  style={{ fontSize: "11px" }}
                >
                  {s.address.slice(0, 6)}…{s.address.slice(-4)}
                </Mono>
                {s.volatile && (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "9px",
                      color: "var(--color-copper)",
                      border: "1px solid var(--color-copper)",
                      padding: "1px 4px",
                      letterSpacing: "0.06em",
                    }}
                  >
                    VOL
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading strategies placeholder */}
      {loading && (
        <div style={{ padding: "10px 20px" }}>
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
  );
}
