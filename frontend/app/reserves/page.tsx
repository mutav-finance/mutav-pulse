"use client";

/**
 * /reserves — the reserves directory.
 *
 * A dedicated, discoverable list of every Mutav vault (MUSD live, MBRL/MARS
 * coming) — redundant with the homepage strip on purpose, so a reserve is
 * always one nav click away. Live reserves click through to their hub.
 *
 * Design: Precision Brutalism / Investidor front. Brand tokens only.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getReserves } from "@/lib/discovery";
import { PRIMARY_RESERVE } from "@/lib/reserves";
import { reserveReads } from "@/lib/contracts";
import { standardProductEconomics } from "@/lib/economics";
import { fmtUsd } from "@/lib/format";
import { CurrencyLogo } from "@/components/CurrencyLogo";

const MAX_W = "1280px";

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

export default function ReservesPage() {
  const router = useRouter();
  const reserves = getReserves();
  const liveCount = reserves.filter((r) => r.status === "live").length;
  const plannedCount = reserves.filter((r) => r.status === "planned").length;

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
    <main style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}>
      <div style={{ maxWidth: MAX_W, margin: "0 auto", padding: "56px 32px 80px" }}>
        {/* Header */}
        <p
          className="font-body"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-2)",
            margin: "0 0 8px",
          }}
        >
          Mutav Pulse Protocol — reserves
        </p>
        <h1
          className="font-display"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em", lineHeight: 1.05, margin: "0 0 12px", color: "var(--color-text)" }}
        >
          Reserves directory
        </h1>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 8px", maxWidth: "62ch" }}
        >
          One protocol, one Mutav vault per fiat. Each reserve is solvency-gated and pays defaults in
          its own currency — never cross-subsidized. Live reserves are click-through; APYs are modeled
          from each currency&apos;s peg, not live returns.
        </p>
        <p
          className="font-mono"
          style={{
            fontSize: "12px",
            letterSpacing: "0.02em",
            color: "var(--color-text-3)",
            margin: "0 0 28px",
            fontFeatureSettings: '"tnum" 1',
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {liveCount} live (testnet PoC) · {plannedCount} coming · live AUM{" "}
          <span style={{ color: "var(--color-text-2)" }}>{aumLabel}</span>
        </p>

        {/* Reserve comparison table */}
        <div style={{ overflowX: "auto", border: "1px solid var(--color-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "880px" }}>
            <thead>
              <tr>
                {[
                  { h: "Reserve", a: "left" },
                  { h: "Status", a: "left" },
                  { h: "Modeled APY", a: "right" },
                  { h: "Yield", a: "right" },
                  { h: "Underwriting", a: "right" },
                  { h: "Underlying", a: "left" },
                  { h: "Market / AUM", a: "left" },
                  { h: "", a: "right" },
                ].map((c, i) => (
                  <th
                    key={i}
                    className="font-body"
                    style={{
                      textAlign: c.a as "left" | "right",
                      fontSize: "10px",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--color-text-3)",
                      padding: "11px 16px",
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reserves.map((r) => {
                const econ = standardProductEconomics(r.assumptions);
                const live = r.status === "live";
                const clickable = live && !!r.address;
                const href = `/earn/${r.address}`;
                const cell: React.CSSProperties = {
                  padding: "13px 16px",
                  borderBottom: "1px solid var(--color-border)",
                };
                const num: React.CSSProperties = {
                  ...cell,
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  textAlign: "right",
                  color: "var(--color-text-2)",
                  fontFeatureSettings: '"tnum" 1',
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                };
                return (
                  <tr
                    key={r.id}
                    onClick={clickable ? () => router.push(href) : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter") router.push(href);
                          }
                        : undefined
                    }
                    onMouseEnter={
                      clickable
                        ? (e) => {
                            e.currentTarget.style.backgroundColor = "var(--color-surface)";
                          }
                        : undefined
                    }
                    onMouseLeave={
                      clickable
                        ? (e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }
                        : undefined
                    }
                    role={clickable ? "link" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-label={clickable ? `View ${r.name} vault` : undefined}
                    style={{
                      opacity: live ? 1 : 0.8,
                      cursor: clickable ? "pointer" : "default",
                      backgroundColor: "transparent",
                      transition: "background-color 0.1s",
                    }}
                  >
                    <td style={cell}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "9px" }}>
                        <CurrencyLogo currency={r.currency} width={24} />
                        <span className="font-display" style={{ fontSize: "15px", color: "var(--color-text)" }}>
                          {r.currency}
                        </span>
                        <span className="font-mono" style={{ fontSize: "10px", color: "var(--color-text-3)" }}>
                          {r.name}
                        </span>
                      </span>
                    </td>
                    <td style={cell}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "9px",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "2px 7px",
                          border: `1px solid ${live ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: live ? "var(--color-accent)" : "var(--color-text-3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.tag ?? (live ? "Live" : "Planned")}
                      </span>
                    </td>
                    <td style={{ ...num, fontSize: "15px", color: live ? "var(--color-accent)" : "var(--color-text)" }}>
                      {pct(econ.modeledApy)}
                    </td>
                    <td style={num}>{pct(econ.underlyingYield)}</td>
                    <td style={num}>{pct(econ.underwritingSpread)}</td>
                    <td className="font-mono" style={{ ...cell, fontSize: "11px", color: "var(--color-text-3)", whiteSpace: "nowrap" }}>
                      {r.underlying}
                    </td>
                    <td className="font-mono" style={{ ...cell, fontSize: "11px", color: "var(--color-text-2)", whiteSpace: "nowrap" }}>
                      {live ? `AUM ${aumLabel}` : r.market}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      {clickable ? (
                        <span className="font-mono" style={{ fontSize: "12px", color: "var(--color-accent)", whiteSpace: "nowrap" }}>
                          view ↗
                        </span>
                      ) : (
                        <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
