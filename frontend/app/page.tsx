"use client";

/**
 * / — Homepage: Mutav Pulse, the protocol PoC (the product's front door).
 *
 * This reads as the PROTOCOL project (Mutav Pulse), not a "come earn yield"
 * app: the USDC testnet vault is a live demo, not investable, and the real
 * pilot is a BRL vault in Q3 2026. Two PoC vaults (USDC live, BRL next)
 * demonstrate the multi-currency protocol on Stellar testnet.
 *
 * Sections: HERO (Pulse identity) → RESERVES (#2, fast access) → HOW IT WORKS
 * → PROTOCOL FLOW (diagram + gates) → ONBOARD (try the PoC).
 *
 * Positioning borrows mutav.finance's language (institutional guarantor under
 * Art. 37 II of Lei 8.245/91; solvency-verifiable, no black box). APYs shown
 * are MODELED from each currency's peg — never presented as live returns.
 *
 * Design: Precision Brutalism / Investidor front. Brand tokens only, no rounded
 * corners, no shadows, amber <5%.
 */

import Link from "next/link";
import { getReserves } from "@/lib/discovery";
import { PRIMARY_RESERVE } from "@/lib/reserves";
import { standardProductEconomics } from "@/lib/economics";
import { contractUrl } from "@/lib/config";
import { fmtPct } from "@/lib/format";
import { useLiveAum } from "@/lib/use-live-aum";
import { ReserveCard } from "@/components/ReserveCard";
import { ProtocolDiagram } from "@/components/ProtocolDiagram";
import { ConnectButton } from "@/components/ConnectButton";

const MAX_W = "1280px";

/** Section label — Inter, ALL CAPS (Explanation layer). */
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
  const reserves = getReserves();
  const liveCount = reserves.filter((r) => r.status === "live").length;
  const plannedCount = reserves.filter((r) => r.status === "planned").length;

  // Modeled APYs (peg-derived, no chain read) — labeled as modeled, not live.
  const usdcApy = standardProductEconomics(PRIMARY_RESERVE.assumptions).modeledApy;
  const brl = reserves.find((r) => r.currency === "MBRL");
  const brlApy = brl ? standardProductEconomics(brl.assumptions).modeledApy : null;

  // Live reserve AUM (primary only) — shared hook; "…" until the read lands.
  const { primaryLabel, aumFor } = useLiveAum();

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "88px 32px 72px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Pulse / hackathon identity badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              padding: "3px 9px",
            }}
          >
            Stellar Pulso Hackathon · Proof of Concept
          </span>
        </div>
        <SectionLabel>Mutav Pulse Protocol — onchain rental guarantees</SectionLabel>

        <h1
          className="font-display"
          style={{
            fontSize: "clamp(40px, 6vw, 66px)",
            lineHeight: 1.03,
            letterSpacing: "-0.03em",
            margin: "0 0 24px",
            maxWidth: "17ch",
            color: "var(--color-text)",
          }}
        >
          The reserve protocol behind Brazil&apos;s rental guarantees
        </h1>

        <p
          className="font-body"
          style={{ fontSize: "18px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 18px", maxWidth: "58ch" }}
        >
          A testnet proof-of-concept of{" "}
          <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>Mutav&apos;s Pulse Protocol</strong>{" "}
          — an on-chain, solvency-gated reserve that backs rental fianças (institutional guarantor, Art. 37 II of
          Lei 8.245/91), pays tenant defaults, and routes idle float to yield adapters. No black box: every
          number traces on-chain.
        </p>

        <p
          className="font-mono"
          style={{ fontSize: "12.5px", lineHeight: 1.6, color: "var(--color-text-3)", margin: "0 0 36px", maxWidth: "62ch" }}
        >
          Two PoC vaults — <span style={{ color: "var(--color-text-2)" }}>MUSD (live)</span> and{" "}
          <span style={{ color: "var(--color-text-2)" }}>MBRL (next)</span> — demo the protocol on Stellar
          testnet. <span style={{ color: "var(--color-text-2)" }}>Not investable</span>; the production
          pilot opens <span style={{ color: "var(--color-accent)" }}>Q3 2026</span> with a BRL vault. Modeled
          yield {fmtPct(usdcApy)} (MUSD){brlApy !== null ? ` · ${fmtPct(brlApy)} (MBRL)` : ""} — projected from
          premiums + DeFi yield, not live returns.
        </p>

        {/* CTAs — exactly one amber */}
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
            Explore the live reserve →
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

      {/* ── RESERVES showcase (section #2 — fast access) ─────────────────── */}
      <section
        id="reserves"
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "72px 32px",
          borderBottom: "1px solid var(--color-border)",
          scrollMarginTop: "72px",
        }}
      >
        <SectionLabel>Reserves — one protocol, one vault per currency (PoC)</SectionLabel>
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
          {liveCount} live (testnet PoC) · {plannedCount} coming · APYs modeled from each peg, not
          live returns · live AUM <span style={{ color: "var(--color-text)" }}>{primaryLabel}</span>
        </p>
        <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "4px" }}>
          {reserves.map((r) => (
            <div key={r.id} style={{ flex: "1 1 0", minWidth: "240px" }}>
              <ReserveCard
                reserve={r}
                aum={r.status === "live" ? aumFor(r) : undefined}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "72px 32px",
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
            { n: "01", t: "Deposit, receive shares", d: "Deposit the reserve's currency and receive mtvR shares — your tokenized claim on the whole reserve at NAV (SEP-0041 token)." },
            { n: "02", t: "Reserve backs fianças", d: "The reserve underwrites rental fianças (the PoC demos the mechanic on Stellar testnet), earning a premium on every active, premium-current policy." },
            { n: "03", t: "Idle float earns yield", d: "Capital not locked behind coverage is allocated to DeFi adapters. Exits come from surplus — solvency comes first, always." },
          ].map((s) => (
            <div key={s.n} style={{ backgroundColor: "var(--color-surface)", padding: "28px 26px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <span className="font-mono" style={{ fontSize: "12px", letterSpacing: "0.1em", color: "var(--color-text-3)", fontFeatureSettings: '"tnum" 1' }}>
                {s.n}
              </span>
              <h3 className="font-display" style={{ fontSize: "19px", letterSpacing: "-0.01em", margin: 0, color: "var(--color-text)" }}>
                {s.t}
              </h3>
              <p className="font-body" style={{ fontSize: "14px", lineHeight: 1.55, color: "var(--color-text-2)", margin: 0 }}>
                {s.d}
              </p>
            </div>
          ))}
        </div>
        <p className="font-mono" style={{ fontSize: "12px", letterSpacing: "0.02em", color: "var(--color-text-2)", margin: "24px 0 0", lineHeight: 1.5 }}>
          <span style={{ color: "var(--color-accent)" }}>solvency-gated:</span> stable assets ≥ guarantee coverage, always.
        </p>
      </section>

      {/* ── PROTOCOL FLOW (diagram + gates) ──────────────────────────────── */}
      <section
        id="protocol-flow"
        style={{
          maxWidth: MAX_W,
          margin: "0 auto",
          padding: "72px 32px",
          borderBottom: "1px solid var(--color-border)",
          scrollMarginTop: "72px",
        }}
      >
        <SectionLabel>Protocol flow</SectionLabel>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 28px", maxWidth: "60ch" }}
        >
          The reserve is the vault: it holds custody, mints shares at NAV, runs an async redemption
          queue, and allocates idle float across strategy adapters for yield. Three gates keep it
          solvent — marked <span style={{ color: "var(--color-accent)" }}>◇</span> on the flows they
          govern.
        </p>
        <ProtocolDiagram />
      </section>

      {/* ── ONBOARD ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: MAX_W, margin: "0 auto", padding: "72px 32px 96px" }}>
        <SectionLabel>Try the proof-of-concept</SectionLabel>
        <h2
          className="font-display"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em", margin: "0 0 16px", color: "var(--color-text)", maxWidth: "20ch" }}
        >
          Connect a wallet and watch the protocol move
        </h2>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 28px", maxWidth: "52ch" }}
        >
          Claim demo USDC from the on-ramp inside the live reserve, deposit, and drive premiums,
          defaults, and redemptions on Stellar testnet. It&apos;s a demonstration — no real funds, no
          earnings. Every value reads directly from the contracts.
        </p>

        <div style={{ marginBottom: "40px" }}>
          <ConnectButton />
        </div>

        {/* Verification footer */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", paddingTop: "24px", borderTop: "1px solid var(--color-border)" }}>
          {[
            { label: "Verify vault ↗", href: contractUrl(PRIMARY_RESERVE.address!), ext: true },
            { label: "Transparency ↗", href: `/earn/${PRIMARY_RESERVE.address}?tab=transparency`, ext: false },
            { label: "GitHub ↗", href: "https://github.com/mutav-finance", ext: true },
          ].map((l) =>
            l.ext ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono"
                style={{ fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-3)", textDecoration: "none" }}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                className="font-mono"
                style={{ fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-3)", textDecoration: "none" }}
              >
                {l.label}
              </Link>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
