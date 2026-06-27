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

import Link from "next/link";
import { standardProductEconomics } from "@/lib/economics";
import { fmtPct } from "@/lib/format";
import { CurrencyLogo } from "@/components/CurrencyLogo";
import { LockIcon } from "@/components/LockIcon";
import type { Reserve } from "@/lib/reserves";

export function ReserveCard({
  reserve,
  aum,
}: {
  reserve: Reserve;
  /** Formatted live AUM string (live reserves only); "…" while loading, "—" if absent. */
  aum?: string;
}) {
  const live = reserve.status === "live";
  const econ = standardProductEconomics(reserve.assumptions);

  const card = (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        // Live reserve gets the scarce amber outline; planned stay neutral.
        border: `1px solid ${live ? "var(--color-accent)" : "var(--color-border)"}`,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        opacity: live ? 1 : 0.82,
      }}
    >
      {/* Header: fiat logo + ticker + status badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "9px" }}>
          <CurrencyLogo currency={reserve.currency} width={26} muted={!live} />
          <span
            className="font-display"
            style={{ fontSize: "18px", color: "var(--color-text)", letterSpacing: "-0.01em" }}
          >
            {reserve.currency}
          </span>
          {/* Lock — planned reserves are not yet available */}
          {!live && <LockIcon size={12} stroke="var(--color-text-3)" label="Not yet available" />}
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
          {fmtPct(econ.modeledApy)}
        </p>
        <p
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-text-3)", margin: "4px 0 0" }}
        >
          {fmtPct(econ.underlyingYield)} yield + {fmtPct(econ.underwritingSpread)} underwriting · modeled
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-2)", margin: 0 }}>
              AUM{" "}
              <span style={{ color: "var(--color-text)" }}>
                {aum ?? "—"}
              </span>
            </p>
            <span
              className="font-mono"
              aria-hidden="true"
              style={{ fontSize: "11px", color: "var(--color-text-2)", letterSpacing: "0.02em", flexShrink: 0 }}
            >
              view ↗
            </span>
          </div>
        ) : (
          <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)", margin: 0 }}>
            {reserve.market}
          </p>
        )}
      </div>
    </div>
  );

  // Live reserves with a vault address are click-through to their hub.
  // Planned reserves render exactly as before — non-interactive.
  if (live && reserve.address) {
    return (
      <Link
        href={`/earn/${reserve.address}`}
        aria-label={`View ${reserve.name} vault`}
        style={{ textDecoration: "none", cursor: "pointer", display: "block" }}
      >
        {card}
      </Link>
    );
  }

  return card;
}
