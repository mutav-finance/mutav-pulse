/**
 * StatusBadge — the brand status atom: a 6×6px square + JetBrains Mono label,
 * colored by status (see STYLE.md §3.5). Shared by SolvencyChip and the
 * operator cockpit's coverage status so the badge styling lives in one place.
 *
 * `bordered` wraps it in a surface box with a status-colored border (standalone
 * chip); without it, just the square + label (for embedding in a larger chip).
 */

interface StatusBadgeProps {
  /** Status color token, e.g. var(--color-success) / var(--color-error) / var(--color-copper). */
  color: string;
  label: string;
  /** Render as a standalone bordered chip with role="status". */
  bordered?: boolean;
  /** Accessible name when bordered (the bordered variant is the announced status). */
  ariaLabel?: string;
}

export function StatusBadge({ color, label, bordered = false, ariaLabel }: StatusBadgeProps) {
  const inner = (
    <>
      <span
        aria-hidden="true"
        style={{ width: "6px", height: "6px", flexShrink: 0, backgroundColor: color }}
      />
      <span
        className="font-mono"
        style={{ fontSize: "12px", fontWeight: 500, letterSpacing: "0.06em", color }}
      >
        {label}
      </span>
    </>
  );

  if (!bordered) {
    return <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{inner}</div>;
  }

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${color}`,
      }}
    >
      {inner}
    </div>
  );
}
