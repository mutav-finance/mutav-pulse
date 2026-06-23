"use client";

/**
 * TxStatus — inline transaction confirmation, shown on the component that
 * triggered the transaction (deposit, redeem, faucet). Replaces a global
 * page-level banner so feedback stays next to the action.
 *
 * Design: Precision Brutalism. 6×6px success square (matches StatusBadge),
 * Inter label, JetBrains Mono hash linking to the explorer. Evidence layer.
 */

import { config } from "@/lib/config";

export function TxStatus({
  hash,
  label = "Confirmed",
}: {
  /** Confirmed transaction hash, or null to render nothing. */
  hash: string | null;
  /** Short status word before the hash. */
  label?: string;
}) {
  if (!hash) return null;
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <div
      role="status"
      style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "6px",
          height: "6px",
          backgroundColor: "var(--color-success)",
          flexShrink: 0,
        }}
      />
      <span
        className="font-body"
        style={{ fontSize: "12px", color: "var(--color-success)", letterSpacing: "0.01em" }}
      >
        {label}
      </span>
      <a
        href={`${config.explorerBase}/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-text-2)",
          letterSpacing: "0.02em",
          textDecoration: "none",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "1px",
        }}
      >
        {short} ↗
      </a>
    </div>
  );
}
