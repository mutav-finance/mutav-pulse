"use client";

/**
 * PositionPanel — displays the connected user's mtvR share balance and
 * its USDC equivalent at current NAV.
 *
 * Design: Precision Brutalism — dark surface, Geist Bold declaration,
 * Inter explanation, JetBrains Mono evidence. Amber used only on the
 * label badge, <5% of pixels.
 */

import { fromStroops, fmtUsd } from "@/lib/format";

interface PositionPanelProps {
  /** Connected wallet's mtvR share balance in stroops (bigint) */
  balance: bigint;
  /** Current NAV per share, scaled 1e7 (bigint). 1e7 = 1.0000 USDC/mtvR */
  navPerShare: bigint;
}

/** Mono span with mandatory tabular-nums for numeric evidence layer */
function Mono({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{ fontFeatureSettings: '"tnum" 1', fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </span>
  );
}

export function PositionPanel({ balance, navPerShare }: PositionPanelProps) {
  const shareDisplay = fromStroops(balance);
  // USDC value = shares × (nav / 1e7)
  const usdcValueStroops = navPerShare > 0n
    ? (balance * navPerShare) / 10_000_000n
    : 0n;

  return (
    <section
      aria-label="Your position"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "24px",
      }}
    >
      {/* Section label — Declaration layer */}
      <p
        className="font-body"
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          color: "var(--color-text-2)",
          textTransform: "uppercase",
          marginBottom: "16px",
        }}
      >
        YOUR POSITION
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* mtvR balance */}
        <div>
          <p
            className="font-body"
            style={{
              fontSize: "12px",
              color: "var(--color-text-2)",
              marginBottom: "6px",
              letterSpacing: "0.01em",
            }}
          >
            mtvR SHARES
          </p>
          <p
            className="font-display"
            style={{
              fontSize: "28px",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            <Mono>{shareDisplay.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</Mono>
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "var(--color-text-3)",
              marginTop: "4px",
              fontFamily: "var(--font-mono)",
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            mtvR · Mutav Reserve
          </p>
        </div>

        {/* USDC value */}
        <div>
          <p
            className="font-body"
            style={{
              fontSize: "12px",
              color: "var(--color-text-2)",
              marginBottom: "6px",
              letterSpacing: "0.01em",
            }}
          >
            USDC VALUE
          </p>
          <p
            className="font-display"
            style={{
              fontSize: "28px",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            <Mono>{fmtUsd(usdcValueStroops)}</Mono>
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "var(--color-text-3)",
              marginTop: "4px",
              fontFamily: "var(--font-mono)",
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            at current NAV
          </p>
        </div>
      </div>
    </section>
  );
}
