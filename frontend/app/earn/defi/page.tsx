"use client";

/**
 * /earn/defi — Venue Directory
 *
 * A "coming soon" directory of yield venues the SGR reserve allocates across.
 * Modelled after OnRe's DeFi-page IA: categorized table with protocol name,
 * role, description, status badge, and action link.
 *
 * Venues:
 *   - DeFindex  — Yield    — Live    — link to DeFindex adapter on Stellar Explorer
 *   - Soroswap  — Swap     — Planned — disabled "Soon"
 *   - Blend     — Lending  — Planned — disabled "Soon"
 *
 * Design: Precision Brutalism / Investidor (dark + amber).
 * Static/presentational: no wallet or contract writes required.
 */

import { VenueDirectory } from "@/components/VenueDirectory";

export default function DefiPage() {
  return (
    <main
      className="texture-investidor"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* ── Page content ────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "40px 32px 80px",
        }}
      >
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-2)",
              textTransform: "uppercase",
              margin: "0 0 10px",
            }}
          >
            MUTAV SGR RESERVE
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(1.75rem, 1.278rem + 0.751vw, 2.25rem)",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: "0 0 12px",
              textWrap: "balance",
            }}
          >
            Yield Venues
          </h1>
          <p
            className="font-body"
            style={{
              fontSize: "14px",
              color: "var(--color-text-2)",
              lineHeight: 1.6,
              maxWidth: "560px",
              margin: 0,
            }}
          >
            The reserve is a diversified allocator. Capital earns across multiple on-chain
            venues — DeFindex is live today; additional integrations are in progress and
            will be enabled as they reach production readiness.
          </p>
        </div>

        {/* ── Venue directory ───────────────────────────────────────────── */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
              }}
            >
              ALLOCATION VENUES
            </p>
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-text-3)",
                letterSpacing: "0.02em",
              }}
            >
              1 live · 2 planned
            </span>
          </div>

          <VenueDirectory />
        </div>

        {/* ── Coming soon note ──────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 20px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p
            className="font-body"
            style={{
              fontSize: "13px",
              color: "var(--color-text-3)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Venue integrations are gated on smart-contract audits and testnet validation.
            Each venue goes live when its adapter passes the full test suite and is wired
            into the reserve vault on Soroban.
          </p>
        </div>

        {/* ── Footer: network indicator ─────────────────────────────────── */}
        <div
          style={{
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span className="live-dot" aria-hidden="true" />
          <span
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-text-3)",
              letterSpacing: "0.02em",
            }}
          >
            Stellar Testnet · DeFindex live
          </span>
        </div>
      </div>
    </main>
  );
}
