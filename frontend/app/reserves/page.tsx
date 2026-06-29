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

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getReserves } from "@/lib/discovery";
import { standardProductEconomics } from "@/lib/economics";
import { fmtPct } from "@/lib/format";
import { useLiveAum } from "@/lib/use-live-aum";
import { CurrencyLogo } from "@/components/CurrencyLogo";
import { LockIcon } from "@/components/LockIcon";

export default function ReservesPage() {
  const router = useRouter();
  const reserves = getReserves();
  const liveCount = reserves.filter((r) => r.status === "live").length;
  const plannedCount = reserves.filter((r) => r.status === "planned").length;

  const { primaryLabel, aumFor } = useLiveAum();

  return (
    <main
      data-front="terminal"
      className="texture-terminal"
      style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}
    >
      <div style={{ width: "100%", padding: "56px var(--page-pad) 80px" }}>
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
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.01em", textTransform: "uppercase", lineHeight: 1.05, margin: "0 0 12px", color: "var(--color-text)" }}
        >
          Reserves directory
        </h1>
        <p
          className="font-body"
          style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--color-text-2)", margin: "0 0 8px", maxWidth: "62ch" }}
        >
          Every currency gets its own Mutav reserve: solvency-gated, independently capitalized, and
          never cross-subsidized.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "16px",
            margin: "0 0 32px",
          }}
        >
          <p
            className="font-body"
            style={{ fontSize: "14px", lineHeight: 1.5, color: "var(--color-text-3)", margin: 0, maxWidth: "62ch" }}
          >
            The APYs below are modeled from each currency&apos;s peg, not live returns.
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: "12px",
              letterSpacing: "0.02em",
              color: "var(--color-text-3)",
              margin: 0,
              fontFeatureSettings: '"tnum" 1',
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {liveCount} live (testnet PoC) · {plannedCount} coming · live AUM{" "}
            <span style={{ color: "var(--color-text-2)" }}>{primaryLabel}</span>
          </p>
        </div>

        {/* Reserve comparison table */}
        <div className="scroll-fade-x" style={{ overflowX: "auto", border: "1px solid var(--color-border)" }}>
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
                    scope="col"
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
                const href = clickable ? `/earn/${r.address}` : undefined;
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
                    // Whole-row click is a pointer convenience only; the real
                    // keyboard/AT-navigable control is the <Link> in the last
                    // cell (faked role="link" on a <tr> was stripped — 4.1.2).
                    onClick={href ? () => router.push(href) : undefined}
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
                    style={{
                      opacity: live ? 1 : 0.8,
                      cursor: clickable ? "pointer" : "default",
                      backgroundColor: "transparent",
                      transition: "background-color 0.1s",
                    }}
                  >
                    <td style={cell}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                        <CurrencyLogo currency={r.currency} width={24} muted={!live} />
                        <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <span className="font-display" style={{ fontSize: "15px", color: "var(--color-text)", lineHeight: 1 }}>
                            {r.currency}
                          </span>
                          <span className="font-mono" style={{ fontSize: "10px", color: "var(--color-text-3)", lineHeight: 1 }}>
                            {r.name}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td style={cell}>
                      <span
                        className="font-mono"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "9px",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "2px 7px",
                          border: `1px solid ${live ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: live ? "var(--color-accent)" : "var(--color-text-3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {!live && <LockIcon size={9} strokeWidth={2.5} />}
                        {r.tag ?? (live ? "Live" : "Planned")}
                      </span>
                    </td>
                    <td style={{ ...num, fontSize: "15px", color: live ? "var(--color-accent)" : "var(--color-text)" }}>
                      {fmtPct(econ.modeledApy)}
                    </td>
                    <td style={num}>{fmtPct(econ.underlyingYield)}</td>
                    <td style={num}>{fmtPct(econ.underwritingSpread)}</td>
                    <td className="font-mono" style={{ ...cell, fontSize: "11px", color: "var(--color-text-3)", whiteSpace: "nowrap" }}>
                      {r.underlying}
                    </td>
                    <td className="font-mono" style={{ ...cell, fontSize: "11px", color: "var(--color-text-2)", whiteSpace: "nowrap" }}>
                      {live ? `AUM ${aumFor(r)}` : r.market}
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      {clickable && href ? (
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`View ${r.name} vault`}
                          className="font-mono"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            minHeight: "24px",
                            fontSize: "12px",
                            color: "var(--color-accent)",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          view ↗
                        </Link>
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
