"use client";

/**
 * RefreshControl — re-runs the reserve read cycle. Lives in the hub header next
 * to the Cockpit link so "refresh" reads as a page-level action, not a metric
 * that belongs to one section.
 *
 * Design: Precision Brutalism / Investidor. Neutral border button, mono
 * timestamp underneath. Amber only via the spinning indicator while loading.
 */

export function RefreshControl({
  onRefresh,
  loading,
  lastRefreshed,
  align = "end",
}: {
  onRefresh: () => void;
  loading: boolean;
  lastRefreshed: Date | null;
  /** Cross-axis alignment of the timestamp under the button. */
  align?: "start" | "end";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "end" ? "flex-end" : "flex-start",
        gap: "6px",
      }}
    >
      <button
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh on-chain reserve data"
        className="font-body"
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
      </button>
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
