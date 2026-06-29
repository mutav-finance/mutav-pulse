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
import { SiteFooter } from "@/components/SiteFooter";
import { useLiveAum } from "@/lib/use-live-aum";
import { ReserveCard } from "@/components/ReserveCard";
import { ProtocolDiagram } from "@/components/ProtocolDiagram";
import { ConnectButton } from "@/components/ConnectButton";

/** Section label — Inter, ALL CAPS (Explanation layer). */
function SectionLabel({
  children,
  size = 13,
  color = "var(--color-text-2)",
  subtitle,
  as: Tag = "p",
  display = false,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  subtitle?: React.ReactNode;
  as?: React.ElementType;
  display?: boolean;
}) {
  return (
    <div style={{ margin: "0 0 20px" }}>
      <Tag
        className={display ? "font-display" : "font-body"}
        style={{
          fontSize: `${size}px`,
          fontWeight: display ? 700 : 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color,
          margin: subtitle ? "0 0 7px" : 0,
        }}
      >
        {children}
      </Tag>
      {subtitle && (
        <p
          className="font-body"
          style={{
            fontSize: "15px",
            lineHeight: 1.45,
            letterSpacing: "0.01em",
            color: "var(--color-text-2)",
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const reserves = getReserves();
  const liveCount = reserves.filter((r) => r.status === "live").length;
  const plannedCount = reserves.filter((r) => r.status === "planned").length;

  // Live reserve AUM (primary only) — shared hook; "…" until the read lands.
  const { primaryLabel, aumFor } = useLiveAum();

  return (
    <main
      data-front="terminal"
      className="texture-terminal"
      style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}
    >
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          padding: "88px var(--section-pad-x) 72px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/hero-6.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            height: "100%",
            width: "auto",
            maxWidth: "48%",
            objectFit: "contain",
            objectPosition: "right center",
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
        <SectionLabel>Mutav Pulse Protocol</SectionLabel>

        <h1
          className="font-display"
          style={{
            fontSize: "clamp(40px, 6vw, 66px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            margin: "0 0 24px",
            maxWidth: "17ch",
            color: "var(--color-text)",
          }}
        >
          The reserve protocol behind Brazil&apos;s rental guarantees
        </h1>

        <p
          className="font-body"
          style={{ fontSize: "18px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 36px", maxWidth: "54ch" }}
        >
          A solvency-gated on-chain reserve that backs real rental guarantees and turns
          their fees into yield.
        </p>

        {/* CTAs — exactly one amber */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          <Link
            href="/reserves"
            className="font-body cta-fill"
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
            className="font-body cta-outline"
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
        </div>
      </section>

      {/* ── WHAT THIS IS (testnet / PoC) ─────────────────────────────────── */}
      <section
        style={{
          width: "100%",
          padding: "72px var(--section-pad-x)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Centered header */}
        <div style={{ maxWidth: "62ch", margin: "0 auto 44px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent)",
              padding: "3px 9px",
              marginBottom: "20px",
            }}
          >
            Stellar Pulso Hackathon · Proof of Concept
          </span>
          <h2
            className="font-display"
            style={{ fontSize: "clamp(26px, 3.6vw, 38px)", lineHeight: 1.1, letterSpacing: "-0.01em", textTransform: "uppercase", margin: "0 0 16px", color: "var(--color-text)", maxWidth: "18ch" }}
          >
            A working demo on Stellar testnet
          </h2>
          <p className="font-body" style={{ fontSize: "17px", lineHeight: 1.55, color: "var(--color-text-2)", margin: 0 }}>
            A proof-of-concept of{" "}
            <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>Mutav Pulse Protocol</strong>, built for the Stellar Pulso Hackathon
            and running end-to-end on Stellar testnet.
          </p>
        </div>

        {/* Detail cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1px",
            backgroundColor: "var(--color-border)",
            border: "1px solid var(--color-border)",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-2)" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true">
                  <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ),
              title: "No black box",
              body: "Every value on the site reads directly from the deployed contracts.",
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-2)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                  <path d="M9 3h6" />
                  <path d="M10 3v5L5.5 18A1.5 1.5 0 0 0 7 20.2h10A1.5 1.5 0 0 0 18.5 18L14 8V3" />
                  <path d="M7.5 14h9" />
                </svg>
              ),
              title: "Testnet today, pilot Q3 2026",
              body: "Testnet only, no real funds, not yet investable. Production pilot opens Q3 2026 with a BRL vault. APYs shown are modeled, not live.",
            },
          ].map((c) => (
            <div key={c.title} style={{ backgroundColor: "var(--color-surface)", padding: "26px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {c.icon}
              <h3 className="font-body" style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text)", margin: 0 }}>
                {c.title}
              </h3>
              <p className="font-mono" style={{ fontSize: "12px", lineHeight: 1.55, color: "var(--color-text-2)", margin: 0 }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── RESERVES showcase (section #2 — fast access) ─────────────────── */}
      <section
        id="reserves"
        style={{
          width: "100%",
          padding: "72px var(--section-pad-x)",
          borderBottom: "1px solid var(--color-border)",
          scrollMarginTop: "72px",
        }}
      >
        <SectionLabel as="h2" display size={17} color="var(--color-text)" subtitle="One protocol, one vault per currency (PoC)">Reserves</SectionLabel>
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            letterSpacing: "0.02em",
            color: "var(--color-text-3)",
            margin: "0 0 24px",
            fontFeatureSettings: '"tnum" 1',
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {liveCount} live · {plannedCount} coming · live AUM{" "}
          <span style={{ color: "var(--color-text)" }}>{primaryLabel}</span>
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
          width: "100%",
          padding: "72px var(--section-pad-x)",
          borderBottom: "1px solid var(--color-border)",
          scrollMarginTop: "72px",
        }}
      >
        <SectionLabel as="h2" display size={17} color="var(--color-text)">How it works</SectionLabel>
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
            { n: "01", t: "Deposit, receive shares", d: "Deposit the reserve's underlying token and receive its currency shares (MUSD, MBRL, …), your tokenized claim on the whole reserve at NAV (SEP-0041 token)." },
            { n: "02", t: "Reserve backs rental guarantees", d: "The reserve underwrites rental guarantees (fianças in Brazil), earning a fee on every active, fee-current guarantee. The PoC demos the mechanic on Stellar testnet." },
            { n: "03", t: "Idle float earns yield", d: "Capital not locked behind coverage is allocated to DeFi adapters. Exits come from surplus. Solvency comes first, always." },
          ].map((s) => (
            <div key={s.n} style={{ backgroundColor: "var(--color-surface)", padding: "28px 26px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <span className="font-mono" style={{ fontSize: "12px", letterSpacing: "0.1em", color: "var(--color-accent)", fontFeatureSettings: '"tnum" 1' }}>
                {s.n}
              </span>
              <h3 className="font-display" style={{ fontSize: "19px", letterSpacing: "0.01em", textTransform: "uppercase", margin: 0, color: "var(--color-text)" }}>
                {s.t}
              </h3>
              <p className="font-body" style={{ fontSize: "14px", lineHeight: 1.55, color: "var(--color-text-2)", margin: 0 }}>
                {s.d}
              </p>
            </div>
          ))}
        </div>
        <p
          className="font-mono"
          style={{
            display: "inline-block",
            fontSize: "12px",
            letterSpacing: "0.02em",
            color: "var(--color-text-2)",
            margin: "24px 0 0",
            lineHeight: 1.5,
            border: "1px solid var(--color-accent)",
            padding: "8px 12px",
          }}
        >
          <span style={{ color: "var(--color-accent)" }}>solvency-gated:</span> stable assets ≥ guarantee coverage, always.
        </p>
      </section>

      {/* ── PROTOCOL FLOW (diagram + gates) ──────────────────────────────── */}
      <section
        id="protocol-flow"
        style={{
          width: "100%",
          padding: "72px var(--section-pad-x)",
          borderBottom: "1px solid var(--color-border)",
          scrollMarginTop: "72px",
        }}
      >
        <SectionLabel as="h2" display size={17} color="var(--color-text)">Protocol flow</SectionLabel>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 14px", maxWidth: "60ch" }}
        >
          The reserve does everything in one place: it holds custody, mints shares at NAV, runs an async
          redemption queue, and allocates idle float across strategy adapters for yield.
        </p>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 28px", maxWidth: "60ch" }}
        >
          Three safety checks, marked{" "}
          <span style={{ color: "var(--color-accent)" }}>◇</span>, keep it solvent at every step.
        </p>
        <ProtocolDiagram />
      </section>

      {/* ── ONBOARD ──────────────────────────────────────────────────────── */}
      <section style={{ width: "100%", padding: "72px var(--section-pad-x) 96px" }}>
        <SectionLabel>Try the proof-of-concept</SectionLabel>
        <h2
          className="font-display"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.08, letterSpacing: "-0.01em", textTransform: "uppercase", margin: "0 0 16px", color: "var(--color-text)", maxWidth: "26ch" }}
        >
          Connect a wallet and watch the protocol move
        </h2>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 28px", maxWidth: "52ch" }}
        >
          Connect a wallet to deposit and drive the full cycle yourself, or explore the live
          reserve first.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", marginBottom: "14px" }}>
          <ConnectButton />
          <Link
            href="/reserves"
            className="font-body cta-outline"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--color-accent)",
              backgroundColor: "transparent",
              border: "1px solid var(--color-accent)",
              padding: "12px 22px",
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            Explore the live reserve →
          </Link>
        </div>
        <p
          className="font-mono"
          style={{ fontSize: "12px", letterSpacing: "0.04em", color: "var(--color-text-3)", margin: "0 0 40px" }}
        >
          Testnet demo · no real funds
        </p>

        {/* ── Footer ── */}
        <SiteFooter />
      </section>
    </main>
  );
}
