"use client";

/**
 * ReserveCard — one currency reserve in the multi-currency overview strip.
 *
 * Live reserve: amber accent, real AUM. Planned reserve: muted, shows the
 * currency peg (underlying + modeled APY) without live balances.
 *
 * Design: Precision Brutalism / Investidor front. Geist value, Inter label,
 * JetBrains Mono evidence. No rounded corners, no shadows.
 */

import { standardProductEconomics } from "@/lib/economics";
import type { Reserve } from "@/lib/reserves";

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

export function ReserveCard({
  reserve,
  aum,
  loading = false,
}: {
  reserve: Reserve;
  /** Formatted live AUM string (live reserves only). */
  aum?: string;
  loading?: boolean;
}) {
  const live = reserve.status === "live";
  const econ = standardProductEconomics(reserve.assumptions);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        opacity: live ? 1 : 0.82,
      }}
    >
      {/* Header: ticker + status badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          className="font-display"
          style={{ fontSize: "18px", color: "var(--color-text)", letterSpacing: "-0.01em" }}
        >
          {reserve.currency}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "9px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "2px 7px",
            border: `1px solid ${live ? "var(--color-accent)" : "var(--color-border)"}`,
            color: live ? "var(--color-accent)" : "var(--color-text-3)",
          }}
        >
          {reserve.tag ?? (live ? "Live" : "Planned")}
        </span>
      </div>

      {/* Modeled APY — the headline, model-backed from the currency peg */}
      <div>
        <p
          className="font-display"
          style={{
            fontSize: "26px",
            lineHeight: 1,
            margin: 0,
            color: live ? "var(--color-accent)" : "var(--color-text)",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {pct(econ.modeledApy)}
        </p>
        <p
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-text-3)", margin: "4px 0 0" }}
        >
          {pct(econ.underlyingYield)} yield + {pct(econ.underwritingSpread)} u/w · modeled
        </p>
      </div>

      {/* Underlying (evidence) */}
      <p
        className="font-mono"
        style={{ fontSize: "11px", color: "var(--color-text-2)", margin: 0, lineHeight: 1.4 }}
      >
        {reserve.underlying}
      </p>

      {/* Footer: live AUM, or market for planned */}
      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "8px", marginTop: "2px" }}>
        {live ? (
          <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-2)", margin: 0 }}>
            AUM{" "}
            <span style={{ color: "var(--color-text)" }}>
              {loading ? "—" : (aum ?? "—")}
            </span>
          </p>
        ) : (
          <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)", margin: 0 }}>
            {reserve.market}
          </p>
        )}
      </div>
    </div>
  );
}
