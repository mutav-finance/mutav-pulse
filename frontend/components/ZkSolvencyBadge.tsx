"use client";

/**
 * ZkSolvencyBadge — the ZK-proven solvency seal (zk-SNARK Groth16).
 *
 * Sits above the SolvencyChip on the transparency page. Where the SolvencyChip
 * proves solvency from what is PUBLIC on-chain, this seal proves — without
 * exposing anything — that the reserves (including what is secret) cover ALL
 * the guarantees.
 *
 * Reads `reads.solvencyAttestation()` (the attestor's last_attestation). The
 * contract only records `solvent:true` for coverage >= 100% (the MIN_RATIO_BPS
 * floor), so green carries on-chain meaning. The attestation exposes only the
 * BAND (`ratio_bps`) + freshness (`ts`/`ledger`) — never values, wallets, or clients.
 *
 * UX (abstracts the blockchain away): default view has no hashes/addresses; a
 * "How does it work?" drawer with 3 jargon-free bullets; technical details +
 * re-verification in the drawer; honest red state if the proof failed/expired.
 *
 * Design: Precision Brutalism / Investidor (dark + scarce amber). Amber marks the
 * "proven" identity (accent bar + actions); green/red is the state.
 */

import { useState } from "react";
import type { Attestation } from "@/lib/contracts";

/** Above this the proof is considered too old for the seal to stay green. */
const STALE_AFTER_S = 24 * 3600; // 24h
/** Coverage floor (bps) — mirrors the attestor's MIN_RATIO_BPS. */
const MIN_RATIO_BPS = 10_000;

interface ZkSolvencyBadgeProps {
  attestation: Attestation | null;
  loading?: boolean;
  error?: string;
  /** Re-reads the attestation on-chain (the "Re-verify now" button). */
  onReverify?: () => void;
  /** Attestor link on the explorer (technical details / independent re-verification). */
  explorerUrl?: string;
  /** "Now" in ms (epoch) — comes from the page's `lastRefreshed`. Keeps the render
   *  pure (no Date.now()) and the "Checked X ago" consistent with the last read. */
  nowMs?: number;
}

type Status = "loading" | "error" | "proven" | "stale" | "unproven";

function relTime(ageS: number): string {
  if (ageS < 90) return "moments ago";
  const m = Math.floor(ageS / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(ageS / 3600);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(ageS / 86400);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

/** Mono span with tabular-nums. */
function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="font-mono"
      style={{ fontFeatureSettings: '"tnum" 1', fontVariantNumeric: "tabular-nums", ...style }}
    >
      {children}
    </span>
  );
}

export function ZkSolvencyBadge({
  attestation,
  loading = false,
  error,
  onReverify,
  explorerUrl,
  nowMs,
}: ZkSolvencyBadgeProps) {
  const [open, setOpen] = useState(false);

  // ── Derive the state ─────────────────────────────────────────────────────────
  // `now` comes from the page (nowMs); pure render, no Date.now(). Without nowMs
  // (before the 1st read) the seal is in loading and doesn't use age — ageS is null.
  const nowS = nowMs != null ? Math.floor(nowMs / 1000) : null;
  const ageS = attestation && nowS != null ? nowS - Number(attestation.ts) : null;
  const meetsFloor = !!attestation && attestation.solvent && attestation.ratio_bps >= MIN_RATIO_BPS;

  let status: Status;
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!meetsFloor) status = "unproven";
  else if (ageS !== null && ageS > STALE_AFTER_S) status = "stale";
  else status = "proven";

  const band = attestation ? `${(attestation.ratio_bps / 100).toFixed(0)}%` : "100%";

  // Colors by state (amber = "proven" identity; green/red = state).
  const accent =
    status === "proven"
      ? "var(--color-success)"
      : status === "stale"
        ? "var(--color-accent)"
        : status === "unproven" || status === "error"
          ? "var(--color-error)"
          : "var(--color-border)";

  // ── Short states (loading / error) ───────────────────────────────────────────
  if (status === "loading") {
    return (
      <Shell accent="var(--color-border)" barColor="var(--color-border)">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }} aria-busy="true">
          <Dot color="var(--color-border)" />
          <span
            className="font-mono"
            style={{ fontSize: "12px", color: "var(--color-text-3)", letterSpacing: "0.06em" }}
          >
            VERIFYING PROOF…
          </span>
        </div>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell accent="var(--color-error)" barColor="var(--color-error)" role="alert">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Dot color="var(--color-error)" />
          <span
            className="font-mono"
            style={{ fontSize: "12px", color: "var(--color-error)", letterSpacing: "0.06em" }}
          >
            SEAL UNAVAILABLE
          </span>
          <span className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)" }}>
            could not read the on-chain proof
          </span>
        </div>
      </Shell>
    );
  }

  // ── Headline by state ────────────────────────────────────────────────────────
  const headline =
    status === "proven"
      ? "RESERVE PROVEN · BACKING VERIFIED"
      : status === "stale"
        ? "PROOF OUTDATED"
        : "BACKING NOT CONFIRMED";

  const body =
    status === "proven" ? (
      <>
        The fund&apos;s reserves cover at least <strong style={{ color: "var(--color-text)" }}>{band}</strong>{" "}
        of the issued guarantees — proven independently, without exposing wallets or client data.{" "}
        Your <Mono style={{ fontSize: "0.95em" }}>mtvR</Mono> shares are backed.
      </>
    ) : status === "stale" ? (
      <>
        The last solvency proof was recorded {ageS !== null ? relTime(ageS) : ""} and hasn&apos;t been
        reconfirmed in the last 24h. Coverage may be outdated — re-verify below.
      </>
    ) : (
      <>
        There is no valid solvency proof on record right now. This is honest by construction: if the
        numbers didn&apos;t add up, the seal would look like this automatically.
      </>
    );

  return (
    <Shell accent={accent} barColor={accent} role="status" ariaLabel={`ZK seal: ${headline}`}>
      {/* Status line */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Dot color={accent} />
        <span
          className="font-mono"
          style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", color: accent }}
        >
          {headline}
        </span>
        {/* "ZK" tag — proof identity (scarce amber) */}
        <span
          className="font-mono"
          style={{
            fontSize: "9.5px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent)",
            padding: "1px 5px",
            opacity: 0.9,
          }}
          title="Zero-knowledge proof (zk-SNARK Groth16) verified on-chain"
        >
          ZK
        </span>
        {status === "proven" && (
          <>
            <Divider />
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                className="font-body"
                style={{
                  fontSize: "10px",
                  color: "var(--color-text-3)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                COVERAGE
              </span>
              <Mono style={{ fontSize: "13px", color: "var(--color-success)" }}>≥ {band}</Mono>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <p
        className="font-body"
        style={{
          fontSize: "13.5px",
          lineHeight: 1.55,
          color: "var(--color-text-2)",
          margin: "12px 0 0",
          maxWidth: "640px",
        }}
      >
        {body}
      </p>

      {/* Freshness + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        {attestation && ageS !== null && (
          <span
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
          >
            Checked {relTime(ageS)}
          </span>
        )}

        {onReverify && (
          <button
            onClick={onReverify}
            className="font-body"
            style={{
              border: "1px solid var(--color-accent)",
              background: "transparent",
              color: "var(--color-accent)",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.03em",
              cursor: "pointer",
            }}
          >
            ↻ Re-verify now
          </button>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-body"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--color-text-2)",
            padding: "6px 4px",
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.03em",
            cursor: "pointer",
          }}
        >
          How does it work? {open ? "▴" : "▾"}
        </button>
      </div>

      {/* "How does it work?" drawer */}
      {open && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <ul
            className="font-body"
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxWidth: "640px",
            }}
          >
            {[
              "We prove mathematically that the reserves cover every guarantee — without revealing values, wallets, or client data.",
              "The check runs on its own inside a contract on the blockchain. No one has to take our word for it.",
              "If any number didn't add up, the seal would turn red automatically — it can't be forged.",
            ].map((t, i) => (
              <li key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "5px",
                    height: "5px",
                    marginTop: "7px",
                    flexShrink: 0,
                    backgroundColor: "var(--color-accent)",
                  }}
                />
                <span style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-2)" }}>
                  {t}
                </span>
              </li>
            ))}
          </ul>

          {/* Technical details */}
          <div
            style={{
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px dashed var(--color-border)",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: "10px", color: "var(--color-text-3)", letterSpacing: "0.04em" }}
            >
              zk-SNARK proof (Groth16 · BN254) verified on-chain
            </span>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-accent)",
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--color-accent-dim)",
                }}
              >
                re-verify it yourself on the explorer ↗
              </a>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── Visual primitives ────────────────────────────────────────────────────────

/** Seal shell: left accent bar (Precision Brutalism) + surface. */
function Shell({
  children,
  accent,
  barColor,
  role,
  ariaLabel,
}: {
  children: React.ReactNode;
  accent: string;
  barColor: string;
  role?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${barColor}`,
        padding: "16px 18px",
      }}
    >
      {children}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  // Static square colored by state (SolvencyChip pattern / STYLE.md §3.5).
  return (
    <span
      aria-hidden="true"
      style={{ width: "7px", height: "7px", flexShrink: 0, backgroundColor: color, display: "inline-block" }}
    />
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: "1px", height: "14px", backgroundColor: "var(--color-border)", flexShrink: 0 }}
    />
  );
}
