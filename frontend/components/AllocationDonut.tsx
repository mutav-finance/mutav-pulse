"use client";

/**
 * AllocationDonut — reserve allocation as a brutalist SVG donut.
 *
 * Renders the split of total reserve assets into its segments (e.g. capital
 * committed to guarantees vs free liquidity buffer), with the total in the
 * center and a legend below. The arcs sweep in on mount (staggered) — a quiet
 * entrance animation, Goldfinch-style.
 *
 * Precision Brutalism: butt line-caps, a thin dark gap between segments, no
 * rounded corners, amber used as the scarce accent on the primary segment.
 */

import { useEffect, useState } from "react";

export interface DonutSegment {
  label: string;
  /** Formatted value, e.g. "$36,000.00" */
  display: string;
  /** Formatted share, e.g. "71.4%" */
  pct: string;
  /** 0..1 — arc length as a fraction of the ring */
  fraction: number;
  color: string;
}

const GAP = 3; // dark gap between segments (circumference units)

export function AllocationDonut({
  centerDisplay,
  centerLabel,
  segments,
  loading = false,
  size = 262,
  ariaLabel = "Reserve allocation",
}: {
  centerDisplay: string;
  centerLabel: string;
  segments: DonutSegment[];
  loading?: boolean;
  /** Ring diameter in px. Stroke + center type scale with it. Default 262. */
  size?: number;
  /** Accessible name for the chart (distinguish multiple donuts on a page). */
  ariaLabel?: string;
}) {
  const [shown, setShown] = useState(false);

  // Geometry derives from `size` so paired donuts can render compactly.
  const SIZE = size;
  const STROKE = Math.round(size * 0.202);
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const CENTER = SIZE / 2;
  const centerFont = Math.max(18, Math.round(size * 0.099));

  // Double rAF so the 0-length initial paint commits before the transition runs.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Cumulative fraction → rotation offset per segment (precomputed, no mutation
  // during render so the value stays stable across re-renders).
  const rotations: number[] = [];
  segments.reduce((acc, s) => {
    rotations.push(acc * 360);
    return acc + s.fraction;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: "28px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel}>
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {/* Base track (shows only if segments don't fill the ring) */}
            <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth={STROKE} />
            {segments.map((s, i) => {
              const len = Math.max(0, s.fraction * C - GAP);
              const rot = rotations[i];
              return (
                <circle
                  key={s.label}
                  cx={CENTER}
                  cy={CENTER}
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  strokeDasharray={`${shown && !loading ? len : 0} ${C}`}
                  transform={`rotate(${rot} ${CENTER} ${CENTER})`}
                  style={{
                    transition: `stroke-dasharray 850ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + i * 260}ms`,
                  }}
                />
              );
            })}
          </g>
        </svg>

        {/* Total — below the donut, outside the ring */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: `${centerFont}px`,
              color: "var(--color-text)",
              letterSpacing: "-0.01em",
              fontFeatureSettings: '"tnum" 1',
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {loading ? "—" : centerDisplay}
          </span>
          <span
            className="font-body"
            style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-3)" }}
          >
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px", width: "150px", flexShrink: 0 }}>
        {[...segments].reverse().map((s) => {
          const accent = s.color === "var(--color-accent)";
          return (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
              {/* Percentage — leads, swatch aligned to it */}
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span
                  aria-hidden="true"
                  style={{ width: "8px", height: "8px", flexShrink: 0, backgroundColor: s.color }}
                />
                <span
                  className="font-mono"
                  style={{
                    fontSize: "15px",
                    color: accent ? "var(--color-accent)" : "var(--color-text)",
                    letterSpacing: "-0.01em",
                    fontFeatureSettings: '"tnum" 1',
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {loading ? "—" : s.pct}
                </span>
              </div>
              {/* Label — below the percentage, smaller and faded */}
              <span
                className="font-body"
                style={{ fontSize: "9px", color: "var(--color-text-3)", lineHeight: 1.3, textAlign: "right" }}
              >
                {s.label}
              </span>
              {/* Value — its own line below the label */}
              {!loading && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: "9px",
                    color: "var(--color-text-2)",
                    textAlign: "right",
                    fontFeatureSettings: '"tnum" 1',
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.display}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
