"use client";

/**
 * /earn/[vault] — Per-reserve hub
 *
 * Resolves the [vault] address param, then dispatches:
 *   - "invalid"    → notFound() (not a Stellar contract address)
 *   - "unverified" → <UnverifiedReserve address={vault} />
 *   - "verified"   → hub: header + Invest/Transparency tab bar + active tab
 *
 * The outer shell is a <div>, NOT <main>, because InvestPanel and
 * ReserveTransparency each render their own <main>. Only one <main> per
 * document is permitted; the active tab component supplies it.
 *
 * useSearchParams is wrapped in <Suspense> as required by Next.js 16 for
 * production builds (prevents static-prerender bailout errors).
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { Suspense, useMemo } from "react";
import { useParams, useSearchParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { resolveAddress, getReserve } from "@/lib/discovery";
import { reserveReads } from "@/lib/contracts";
import { InvestPanel } from "@/components/InvestPanel";
import { ReserveTransparency } from "@/components/ReserveTransparency";
import { UnverifiedReserve } from "@/components/UnverifiedReserve";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "invest" | "transparency";

// ── Inner hub (needs Suspense wrapper for useSearchParams) ────────────────────

function ReserveHubInner() {
  const params = useParams<{ vault: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const vault = String(params.vault);

  // Resolution: invalid → 404 | unverified → notice | verified → hub
  const resolution = resolveAddress(vault);
  if (resolution === "invalid") notFound();
  if (resolution === "unverified") return <UnverifiedReserve address={vault} />;

  // Verified path
  const reserve = getReserve(vault)!; // guaranteed present when "verified"
  const reads = useMemo(() => reserveReads(reserve.contracts!), [reserve.contracts]);
  const tab: Tab = search.get("tab") === "transparency" ? "transparency" : "invest";

  const setTab = (t: Tab) => router.replace(`/earn/${vault}?tab=${t}`);

  return (
    // Outer: <div>, NOT <main> — the active tab panel supplies the single <main>
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* Reserve header + tab bar — above the <main> the tab supplies */}
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "32px 32px 0",
        }}
      >
        {/* Reserve identity */}
        <div style={{ marginBottom: "20px" }}>
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
            {reserve.name}
            {" · "}
            <span style={{ color: "var(--color-accent)" }}>VERIFIED</span>
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: "24px",
              letterSpacing: "-0.02em",
              margin: 0,
              color: "var(--color-text)",
            }}
          >
            {reserve.currency} Reserve
          </h1>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "24px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {(["invest", "transparency"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="font-mono"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: tab === t ? "var(--color-text)" : "var(--color-text-2)",
                borderBottom:
                  tab === t
                    ? "2px solid var(--color-accent)"
                    : "2px solid transparent",
                padding: "0 0 10px",
              }}
            >
              {t}
            </button>
          ))}

          {/* Cockpit link — right-aligned */}
          <Link
            href={`/protocol/${vault}`}
            className="font-mono"
            style={{
              marginLeft: "auto",
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-3)",
              textDecoration: "none",
              paddingBottom: "10px",
            }}
          >
            Cockpit ↗
          </Link>
        </div>
      </div>

      {/* Active tab — each supplies its own <main> */}
      {tab === "invest" ? (
        <InvestPanel reads={reads} reserve={reserve} />
      ) : (
        <ReserveTransparency reads={reads} reserve={reserve} />
      )}
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

/**
 * Suspense boundary is required around components that call useSearchParams
 * in Next.js 16 production builds. Without it, the build fails with:
 * "Missing Suspense boundary with useSearchParams".
 */
export default function ReserveHub() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "var(--color-canvas)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            className="live-dot"
            aria-hidden="true"
            style={{ marginRight: "8px" }}
          />
          <span
            className="font-mono"
            style={{ fontSize: "13px", color: "var(--color-text-2)" }}
          >
            Loading reserve…
          </span>
        </div>
      }
    >
      <ReserveHubInner />
    </Suspense>
  );
}
