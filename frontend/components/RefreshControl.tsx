"use client";

import { Button } from "@/components/ui/button";

/**
 * RefreshControl — re-runs the reserve read cycle. Lives in the hub header next
 * to the Cockpit link so "refresh" reads as a page-level action, not a metric
 * that belongs to one section.
 *
 * Design: Precision Brutalism / Investidor. Neutral border button, mono
 * timestamp underneath. Amber only via the spinning indicator while loading.
 *
 * Migrated onto the shared Button primitive (`outline` variant). The inline
 * `style` below intentionally pins border/background/color/opacity/pointer-
 * events so the variant's amber hover-fill and `disabled:opacity-40` do NOT
 * apply — preserving this control's exact original look (no hover, no dim).
 */

export function RefreshControl({
  onRefresh,
  loading,
  lastRefreshed,
}: {
  onRefresh: () => void;
  loading: boolean;
  lastRefreshed: Date | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "6px",
      }}
    >
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh on-chain reserve data"
        className="h-auto font-body"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-2)",
          padding: "8px 14px",
          fontSize: "13px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          opacity: 1,
          pointerEvents: "auto",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            color: loading ? "var(--color-accent)" : "var(--color-text-3)",
            animation: loading ? "mtv-spin 0.9s linear infinite" : "none",
          }}
        >
          ↻
        </span>
        {loading ? "Loading" : "Refresh"}
      </Button>
      {lastRefreshed && (
        <span
          className="font-mono"
          style={{ fontSize: "10px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
        >
          {lastRefreshed.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}
