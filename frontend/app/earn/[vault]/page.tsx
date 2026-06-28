"use client";

/**
 * /earn/[vault] — Per-reserve investor hub (fund-investment layout)
 *
 * Resolves the [vault] address param, then dispatches:
 *   - "invalid"    → notFound() (not a Stellar contract address)
 *   - "unverified" → <UnverifiedReserve address={vault} />
 *   - "verified"   → 2-column hub: fund information (left) + sticky invest/
 *                    withdraw rail (right), Goldfinch-style. Collapses to one
 *                    column below 1024px with the invest rail first.
 *
 * The shell owns the single <main>; ReserveTransparency renders in `embedded`
 * mode (a plain <div>, no <main>, no page title) and InvestCard is an <aside>.
 *
 * Each reserve keeps its own admin cockpit at /protocol/[vault] (linked in the
 * header), so this page is purely the investor surface.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { resolveAddress, getReserve } from "@/lib/discovery";
import { isLiveReserve, type LiveReserve } from "@/lib/reserves";
import { reserveReads } from "@/lib/contracts";
import { useReserveData } from "@/lib/use-reserve-data";
import { InvestCard } from "@/components/InvestCard";
import { ReserveTransparency } from "@/components/ReserveTransparency";
import { RefreshControl } from "@/components/RefreshControl";
import { UnverifiedReserve } from "@/components/UnverifiedReserve";
import { CurrencyLogo } from "@/components/CurrencyLogo";
import { SiteFooter } from "@/components/SiteFooter";

export default function ReserveHub() {
  const params = useParams<{ vault: string }>();
  const vault = String(params.vault);

  // Resolution: invalid → 404 | unverified → notice | verified → hub
  const resolution = resolveAddress(vault);
  const reserve = getReserve(vault); // may be undefined (unverified/unknown)

  if (resolution === "invalid") notFound();
  if (resolution === "unverified" || !reserve || !isLiveReserve(reserve)) {
    return <UnverifiedReserve address={vault} />;
  }

  // Verified path — reserve + contracts are present. The data hook lives in a
  // child so it's never called conditionally (rules of hooks).
  return <VerifiedHub reserve={reserve} vault={vault} />;
}

/** The verified reserve hub. Owns the live read cycle + the page-level refresh. */
function VerifiedHub({
  reserve,
  vault,
}: {
  reserve: LiveReserve;
  vault: string;
}) {
  const reads = useMemo(() => reserveReads(reserve.contracts), [reserve.contracts]);
  const { data, loading, error, lastRefreshed, refresh } = useReserveData(reads);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* ── Reserve header (full width) ─────────────────────────────────── */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "24px",
            marginBottom: "32px",
            paddingBottom: "24px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div>
            <p
              className="font-body"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--color-text-2)",
                textTransform: "uppercase",
                margin: "0 0 6px",
              }}
            >
              Mutav Pulse Protocol
              {" · "}
              <span style={{ color: "var(--color-accent)" }}>TESTNET</span>
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <CurrencyLogo currency={reserve.currency} width={28} />
              <h1
                className="font-display"
                style={{
                  fontSize: "28px",
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                  margin: 0,
                  color: "var(--color-text)",
                }}
              >
                {reserve.currency} Reserve
              </h1>
            </div>
            <p
              className="font-body"
              style={{
                fontSize: "13px",
                color: "var(--color-text-2)",
                margin: "8px 0 0",
                lineHeight: 1.5,
              }}
            >
              {reserve.underlying.replace(" · stablecoin DeFi (DeFindex)", " (Stablecoin DeFi · DeFindex)")}
            </p>
          </div>

          {/* Page actions — refresh (live reads) + cockpit link */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <RefreshControl onRefresh={refresh} loading={loading} lastRefreshed={lastRefreshed} />
            <Link
              href={`/protocol/${vault}`}
              className="font-mono"
              style={{
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--color-text-3)",
                textDecoration: "none",
                border: "1px solid var(--color-border)",
                padding: "8px 14px",
              }}
            >
              Cockpit ↗
            </Link>
          </div>
        </header>

        {/* ── 2-column body: fund info (left) + invest rail (right) ────────── */}
        <div className="reserve-hub-grid">
          <div className="reserve-hub-info" id="transparency">
            <ReserveTransparency reserve={reserve} data={data} loading={loading} error={error} />
          </div>
          <div className="reserve-hub-invest">
            <InvestCard reads={reads} reserve={reserve} />
          </div>
        </div>

        {/* ── Shared brand footer ─────────────────────────────────────────── */}
        <div style={{ marginTop: "64px" }}>
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
