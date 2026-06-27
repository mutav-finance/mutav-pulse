"use client";

/**
 * SolvencyChip — pass/fail badge for the core solvency invariant:
 *   stable_assets >= coverage_required
 *
 * Design: Precision Brutalism / Investidor.
 * - Badge pattern: 6px square + JetBrains Mono label (see STYLE.md §3.5)
 * - Shows both values alongside the status
 */

import { fmtFiat, type Money } from "@/lib/format";
import { Mono } from "@/components/Mono";

interface SolvencyChipProps {
  stableAssets: bigint;
  coverageRequired: bigint;
  /** Reserve money context — denominates STABLE / REQUIRED in the reserve's fiat. */
  money: Money;
  loading?: boolean;
  error?: string;
}

export function SolvencyChip({
  stableAssets,
  coverageRequired,
  money,
  loading = false,
  error,
}: SolvencyChipProps) {
  const solvent = stableAssets >= coverageRequired;
  const statusColor = solvent ? "var(--color-success)" : "var(--color-error)";
  const label = solvent ? "SOLVENT" : "UNDERCOLLATERALIZED";

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 16px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-busy="true"
        aria-label="Loading solvency status"
      >
        <div
          aria-hidden="true"
          style={{
            width: "6px",
            height: "6px",
            flexShrink: 0,
            backgroundColor: "var(--color-border)",
          }}
        />
        <span
          className="font-mono"
          style={{ fontSize: "12px", color: "var(--color-text-3)", letterSpacing: "0.06em" }}
        >
          LOADING…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 16px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-error)",
        }}
        role="alert"
      >
        <div
          aria-hidden="true"
          style={{ width: "6px", height: "6px", flexShrink: 0, backgroundColor: "var(--color-error)" }}
        />
        <span
          className="font-mono"
          style={{ fontSize: "12px", color: "var(--color-error)", letterSpacing: "0.06em" }}
        >
          ERROR
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "16px",
        padding: "12px 16px",
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${statusColor}`,
        width: "fit-content",
        maxWidth: "100%",
      }}
      role="status"
      aria-label={`Solvency status: ${label}`}
    >
      {/* Status badge: square + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          aria-hidden="true"
          style={{
            width: "6px",
            height: "6px",
            flexShrink: 0,
            backgroundColor: statusColor,
          }}
        />
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: statusColor,
          }}
        >
          {label}
        </span>
      </div>

      {/* Divider */}
      <div
        aria-hidden="true"
        style={{ width: "1px", height: "16px", backgroundColor: "var(--color-border)", flexShrink: 0 }}
      />

      {/* Collateral detail */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
          <span
            className="font-body"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            STABLE
          </span>
          <Mono>
            <span style={{ fontSize: "13px", color: "var(--color-text-2)" }}>
              {fmtFiat(stableAssets, money)}
            </span>
          </Mono>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
          <span
            className="font-body"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}
          >
            REQUIRED
          </span>
          <Mono>
            <span style={{ fontSize: "13px", color: "var(--color-text-2)" }}>
              {fmtFiat(coverageRequired, money)}
            </span>
          </Mono>
        </div>
        {coverageRequired > 0n && (
          <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
            <span
              className="font-body"
              style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              RATIO
            </span>
            <Mono>
              <span style={{ fontSize: "13px", color: solvent ? "var(--color-success)" : "var(--color-error)" }}>
                {(Number(stableAssets) / Number(coverageRequired) * 100).toFixed(1)}%
              </span>
            </Mono>
          </div>
        )}
      </div>
    </div>
  );
}
