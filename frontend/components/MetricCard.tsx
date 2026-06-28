"use client";

/**
 * MetricCard — a single metric in the reserve dashboard metric grid.
 *
 * Design: Precision Brutalism / Investidor front.
 * - Geist Bold value (Declaration layer)
 * - Inter label, ALL CAPS (Explanation layer)
 * - JetBrains Mono unit annotation (Evidence layer)
 * - Optional tooltip on label
 * - No rounded corners, no shadows, surface-1 background
 */

import { Mono } from "@/components/Mono";
import { InfoTooltip } from "@/components/InfoTooltip";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  tooltip?: string;
  /** amber accent on the value — use only for Net APY */
  accentValue?: boolean;
  /** quieter borderless variant (smaller value, no box) — supporting metrics */
  compact?: boolean;
  /** loading skeleton */
  loading?: boolean;
  /** error message */
  error?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  tooltip,
  accentValue = false,
  compact = false,
  loading = false,
  error,
}: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: compact ? "transparent" : "var(--color-surface)",
        border: compact ? "none" : "1px solid var(--color-border)",
        padding: compact ? 0 : "20px 24px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        // Become a sizing container + allow the grid item to shrink, so the
        // value below can scale to the card width (long R$ figures overflowed).
        containerType: "inline-size",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Label row — Inter Medium, ALL CAPS, with optional tooltip trigger */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          position: "relative",
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
            margin: 0,
            lineHeight: 1,
          }}
        >
          {label}
        </p>
        {tooltip && (
          <InfoTooltip label={`Info: ${label}`} width={220}>
            {tooltip}
          </InfoTooltip>
        )}
      </div>

      {/* Value — Geist Bold, large */}
      {loading ? (
        <div
          aria-hidden="true"
          style={{
            height: "32px",
            width: "80%",
            backgroundColor: "var(--color-surface-2)",
            opacity: 0.6,
          }}
        />
      ) : error ? (
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-error)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          —
        </p>
      ) : (
        <p
          className="font-display"
          style={{
            // Scale to the card width (cqi) so any value length fits, capped at
            // the original size; floor keeps it legible on the narrowest card.
            fontSize: compact
              ? "clamp(13px, 8cqi, 22px)"
              : "clamp(14px, 9cqi, 28px)",
            color: accentValue ? "var(--color-accent)" : "var(--color-text)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <Mono>{value}</Mono>
        </p>
      )}

      {/* Unit annotation — JetBrains Mono, dim */}
      {unit && !loading && !error && (
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text-3)",
            fontFamily: "var(--font-mono)",
            fontFeatureSettings: '"tnum" 1',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {unit}
        </p>
      )}
    </div>
  );
}
