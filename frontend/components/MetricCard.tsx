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

import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  tooltip?: string;
  /** amber accent on the value — use only for Net APY */
  accentValue?: boolean;
  /** loading skeleton */
  loading?: boolean;
  /** error message */
  error?: string;
}

/** Mono span with mandatory tabular-nums */
function Mono({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{
        fontFeatureSettings: '"tnum" 1',
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  tooltip,
  accentValue = false,
  loading = false,
  error,
}: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "20px 24px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
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
          <span
            role="button"
            aria-label={`Info: ${label}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            tabIndex={0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "14px",
              height: "14px",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-3)",
              fontSize: "9px",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              cursor: "default",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ?
          </span>
        )}

        {/* Tooltip bubble */}
        {tooltip && showTooltip && (
          <div
            role="tooltip"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 10,
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              padding: "8px 12px",
              maxWidth: "220px",
              pointerEvents: "none",
            }}
          >
            <p
              className="font-body"
              style={{
                fontSize: "11px",
                color: "var(--color-text-2)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {tooltip}
            </p>
          </div>
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
            fontSize: "28px",
            color: accentValue ? "var(--color-accent)" : "var(--color-text)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            margin: 0,
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
