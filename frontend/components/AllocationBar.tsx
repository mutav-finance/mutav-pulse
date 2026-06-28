"use client";

/**
 * AllocationBar — horizontal stacked bar reading left→right as capital actually
 * sits. The honest "where is my money" view: segments are real amounts that sum
 * to the total. Shared between the investor reserve overview
 * (ReserveTransparency) and the operator Strategies tab so the two never show a
 * different allocation picture.
 *
 * Precision Brutalism: butt caps, a thin dark gap between segments, no rounded
 * corners; amber is the scarce accent applied by the caller per segment color.
 */

export interface BarSegment {
  label: string;
  /** Formatted amount, e.g. "$36,000.00". */
  display: string;
  /** 0..1 — segment share; segments sum to ~1. */
  fraction: number;
  color: string;
}

export function AllocationBar({ segments, loading }: { segments: BarSegment[]; loading: boolean }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          height: "44px",
          gap: "2px",
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-border)",
          overflow: "hidden",
        }}
      >
        {loading
          ? <div style={{ flex: 1, backgroundColor: "var(--color-surface)" }} />
          : segments.map((s) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.display}`}
                style={{
                  flexGrow: Math.max(s.fraction, 0.0001),
                  flexBasis: 0,
                  minWidth: s.fraction > 0 ? "2px" : 0,
                  backgroundColor: s.color,
                  transition: "flex-grow 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            ))}
      </div>
      {/* Legend — swatch · label · amount · % */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginTop: "14px" }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span aria-hidden="true" style={{ width: "9px", height: "9px", flexShrink: 0, backgroundColor: s.color, transform: "translateY(1px)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span className="font-body" style={{ fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-2)" }}>
                {s.label}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: "13px", color: "var(--color-text)", fontFeatureSettings: '"tnum" 1', fontVariantNumeric: "tabular-nums" }}
              >
                {loading ? "—" : s.display}
                <span style={{ color: "var(--color-text-3)", marginLeft: "8px" }}>
                  {loading ? "" : `${(s.fraction * 100).toFixed(1)}%`}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
