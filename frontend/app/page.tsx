"use client";

/**
 * / — Homepage: yield-forward onboarding (the product's front door).
 *
 * Four sections: HERO (showcases the live reserve's modeled APY as the
 * actionable number), HOW IT WORKS (3 steps + solvency guarantee), RESERVES
 * (the multi-currency showcase; live cards click through to their hub), and
 * ONBOARD (connect → faucet → deposit + verification links).
 *
 * Honesty rule: the hero APY is the LIVE (USDC) reserve's. Planned reserves
 * (BRL/ARS) keep their "Planned" badge and are never presented as investable.
 *
 * NOT the dense transparency dashboard — that lives on each reserve's hub
 * Transparency tab. This page is landing + conversion only.
 *
 * Design: Precision Brutalism / Investidor front (dark + amber). Three-typeface
 * system, brand tokens only, no rounded corners, no shadows, amber <5%.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getReserves } from "@/lib/discovery";
import { PRIMARY_RESERVE } from "@/lib/reserves";
import { standardProductEconomics } from "@/lib/economics";
import { reserveReads } from "@/lib/contracts";
import { config } from "@/lib/config";
import { fmtUsd } from "@/lib/format";
import { ReserveCard } from "@/components/ReserveCard";
import { ConnectButton } from "@/components/ConnectButton";

const MAX_W = "1280px";

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

// Section label — Inter, ALL CAPS (Explanation layer, used only on data labels)
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-body"
      style={{
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--color-text-2)",
        margin: "0 0 20px",
      }}
    >
      {children}
    </p>
  );
}

export default function Home() {
  // Hero APY: the LIVE reserve's modeled APY — model-backed from its currency
  // peg, no chain read needed. This is the actionable number.
  const heroApy = standardProductEconomics(PRIMARY_RESERVE.assumptions).modeledApy;

  const reserves = getReserves();
  const liveCount = reserves.filter((r) => r.status === "live").length;
  const plannedCount = reserves.filter((r) => r.status === "planned").length;

  // Real AUM of the live reserve — one read on mount; "…" until it lands.
  const [liveAum, setLiveAum] = useState<bigint | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!PRIMARY_RESERVE.contracts) return;
    reserveReads(PRIMARY_RESERVE.contracts)
      .vaultTotalAssets()
      .then((v) => {
        if (!cancelled) setLiveAum(v);
      })
      .catch(() => {
        /* leave as null → renders "…" */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const aumLabel = liveAum === null ? "…" : fmtUsd(liveAum);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "96px 32px 80px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <SectionLabel>Mutav · Solvency-gated reserve</SectionLabel>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(40px, 6vw, 68px)",
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            margin: "0 0 24px",
            maxWidth: "16ch",
            color: "var(--color-text)",
          }}
        >
          Earn yield backing Brazil&apos;s rental guarantees
        </h1>
        <p
          className="font-body"
          style={{
            fontSize: "18px",
            lineHeight: 1.5,
            color: "var(--color-text-2)",
            margin: "0 0 40px",
            maxWidth: "52ch",
          }}
        >
          The live USDC reserve targets a modeled{" "}
          <span
            className="font-mono"
            style={{
              color: "var(--color-accent)",
              fontFeatureSettings: '"tnum" 1',
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {pct(heroApy)} APY
          </span>{" "}
          — premiums + DeFi yield, solvency-gated. Planned BRL reserves model up
          to ~33% (coming, not yet investable).
        </p>

        {/* CTAs — exactly one amber (Start earning) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          <Link
            href={`/earn/${PRIMARY_RESERVE.address}`}
            className="font-body"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--color-canvas)",
              backgroundColor: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              padding: "12px 22px",
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            Start earning →
          </Link>
          <a
            href="#how-it-works"
            className="font-body"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--color-text-2)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border)",
              padding: "12px 22px",
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            How it works ↓
          </a>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "80px 32px",
          borderBottom: "1px solid var(--color-border)",
          scrollMarginTop: "72px",
        }}
      >
        <SectionLabel>How it works</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1px",
            backgroundColor: "var(--color-border)",
            border: "1px solid var(--color-border)",
          }}
        >
          {[
            {
              n: "01",
              t: "Deposit, receive shares",
              d: "Deposit USDC into the reserve and receive mtvR shares — your tokenized claim on the whole reserve at NAV.",
            },
            {
              n: "02",
              t: "Reserve backs fianças",
              d: "The reserve underwrites rental guarantees (fianças) across Brazil, earning a premium on every active, premium-current policy.",
            },
            {
              n: "03",
              t: "Idle float earns yield",
              d: "Capital not locked behind coverage is allocated to DeFi yield. You redeem from surplus — solvency comes first, always.",
            },
          ].map((s) => (
            <div
              key={s.n}
              style={{
                backgroundColor: "var(--color-surface)",
                padding: "28px 26px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  color: "var(--color-text-3)",
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                {s.n}
              </span>
              <h3
                className="font-display"
                style={{
                  fontSize: "19px",
                  letterSpacing: "-0.01em",
                  margin: 0,
                  color: "var(--color-text)",
                }}
              >
                {s.t}
              </h3>
              <p
                className="font-body"
                style={{
                  fontSize: "14px",
                  lineHeight: 1.55,
                  color: "var(--color-text-2)",
                  margin: 0,
                }}
              >
                {s.d}
              </p>
            </div>
          ))}
        </div>

        {/* The solvency invariant — stated as evidence */}
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            letterSpacing: "0.02em",
            color: "var(--color-text-2)",
            margin: "24px 0 0",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "var(--color-accent)" }}>solvency-gated:</span>{" "}
          stable assets ≥ guarantee coverage, always.
        </p>
      </section>

      {/* ── RESERVES showcase ────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "80px 32px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <SectionLabel>Reserves</SectionLabel>
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            letterSpacing: "0.02em",
            color: "var(--color-text-2)",
            margin: "0 0 24px",
            fontFeatureSettings: '"tnum" 1',
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {liveCount} live · {plannedCount} planned · total AUM{" "}
          <span style={{ color: "var(--color-text)" }}>{aumLabel}</span> (USD-equiv)
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {reserves.map((r) => (
            <ReserveCard
              key={r.id}
              reserve={r}
              aum={r.status === "live" ? aumLabel : undefined}
              loading={r.status === "live" && liveAum === null}
            />
          ))}
        </div>
      </section>

      {/* ── ONBOARD ──────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "80px 32px 96px",
        }}
      >
        <SectionLabel>Get started</SectionLabel>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            letterSpacing: "-0.02em",
            margin: "0 0 16px",
            color: "var(--color-text)",
            maxWidth: "18ch",
          }}
        >
          Connect wallet → get testnet USDC → deposit
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: "15px",
            lineHeight: 1.55,
            color: "var(--color-text-2)",
            margin: "0 0 28px",
            maxWidth: "48ch",
          }}
        >
          Connect a Stellar wallet, claim testnet USDC from the on-ramp inside the
          reserve, and deposit. Everything is on-chain and verifiable.
        </p>

        <div style={{ marginBottom: "40px" }}>
          <ConnectButton />
        </div>

        {/* Verification footer — evidence links, mono */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "24px",
            paddingTop: "24px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <a
            href={`${config.explorerBase}/contract/${PRIMARY_RESERVE.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{
              fontSize: "12px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--color-text-3)",
              textDecoration: "none",
            }}
          >
            Verify vault ↗
          </a>
          <Link
            href={`/earn/${PRIMARY_RESERVE.address}?tab=transparency`}
            className="font-mono"
            style={{
              fontSize: "12px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--color-text-3)",
              textDecoration: "none",
            }}
          >
            Contracts ↗
          </Link>
          <a
            href="https://github.com/mutav-finance"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{
              fontSize: "12px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--color-text-3)",
              textDecoration: "none",
            }}
          >
            Whitepaper ↗
          </a>
        </div>
      </section>
    </main>
  );
}
