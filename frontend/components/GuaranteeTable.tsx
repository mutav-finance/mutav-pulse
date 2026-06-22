"use client";

/**
 * GuaranteeTable — table of active rental guarantees from the registry.
 *
 * Data shape per guarantee:
 *   { id, landlord, monthly_amount, months_covered, months_used, fee_bps,
 *     period_secs, paid_until, active }
 *
 * Columns: ID, Landlord, Monthly, Used/Cap, Status, Exposure
 * Badge system per STYLE.md §3.5: 6px square + JetBrains Mono label
 *
 * Design: Precision Brutalism / Investidor.
 */

import { fmtUsd, fmtBps, truncAddr } from "@/lib/format";
import { Mono } from "@/components/Mono";
import type { Guarantee } from "policy";

interface GuaranteeTableProps {
  guarantees: Array<{ id: bigint; guarantee: Guarantee; isCurrent: boolean }>;
  loading?: boolean;
  error?: string;
}

/** Status badge: square + label */
function StatusBadge({ active, isCurrent }: { active: boolean; isCurrent: boolean }) {
  let color: string;
  let label: string;

  if (!active) {
    // Closed/settled state — neutral grey. Amber would read as active/warning.
    color = "var(--color-text-3)";
    label = "LIQUIDADO";
  } else if (!isCurrent) {
    color = "var(--color-error)"; // overdue = error red
    label = "EM_DEFAULT";
  } else {
    color = "var(--color-success)"; // current & active = success
    label = "ATIVO";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        aria-hidden="true"
        style={{ width: "6px", height: "6px", flexShrink: 0, backgroundColor: color }}
      />
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-text-2)",
          letterSpacing: "0.06em",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {label}
      </span>
    </div>
  );
}

const COL_STYLE: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const HEADER_STYLE: React.CSSProperties = {
  ...COL_STYLE,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--color-text-3)",
  fontFamily: "var(--font-body)",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface-2)",
};

export function GuaranteeTable({ guarantees, loading = false, error }: GuaranteeTableProps) {
  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading guarantees"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <span className="live-dot" aria-hidden="true" />
          <span className="font-body" style={{ fontSize: "13px", color: "var(--color-text-2)" }}>
            Loading guarantees…
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-error)",
          padding: "16px 24px",
        }}
      >
        <p className="font-mono" style={{ fontSize: "12px", color: "var(--color-error)", margin: 0 }}>
          {error}
        </p>
      </div>
    );
  }

  if (guarantees.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <p className="font-body" style={{ fontSize: "13px", color: "var(--color-text-3)", margin: 0 }}>
          No active guarantees registered.
        </p>
        <p
          className="font-mono"
          style={{ fontSize: "11px", color: "var(--color-text-3)", margin: "8px 0 0", letterSpacing: "0.02em" }}
        >
          registry.active_ids() = []
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        overflowX: "auto",
      }}
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}
        aria-label="Active guarantee registry"
      >
        <thead>
          <tr>
            <th style={HEADER_STYLE} scope="col">ID</th>
            <th style={HEADER_STYLE} scope="col">LANDLORD</th>
            <th style={{ ...HEADER_STYLE, textAlign: "right" }} scope="col">MONTHLY</th>
            <th style={{ ...HEADER_STYLE, textAlign: "right" }} scope="col">FEE</th>
            <th style={{ ...HEADER_STYLE, textAlign: "center" }} scope="col">USED / CAP</th>
            <th style={{ ...HEADER_STYLE, textAlign: "right" }} scope="col">EXPOSURE</th>
            <th style={HEADER_STYLE} scope="col">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {guarantees.map(({ id, guarantee, isCurrent }, i) => {
            const {
              landlord,
              monthly_amount,
              months_covered,
              months_used,
              fee_bps,
              active,
            } = guarantee;

            // Remaining exposure = (months_covered - months_used) * monthly_amount
            const monthsRemaining = Math.max(0, months_covered - months_used);
            const exposureStroops = BigInt(monthsRemaining) * monthly_amount;

            const rowBg =
              i % 2 === 0
                ? "var(--color-surface)"
                : "var(--color-canvas)";

            return (
              <tr
                key={String(id)}
                style={{
                  backgroundColor: rowBg,
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                {/* ID */}
                <td style={COL_STYLE}>
                  <Mono dim>#{String(id)}</Mono>
                </td>

                {/* Landlord */}
                <td style={COL_STYLE}>
                  <span
                    className="font-mono"
                    title={landlord}
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-2)",
                      fontFeatureSettings: '"tnum" 1',
                      letterSpacing: "0.01em",
                    }}
                  >
                    {truncAddr(landlord)}
                  </span>
                </td>

                {/* Monthly amount */}
                <td style={{ ...COL_STYLE, textAlign: "right" }}>
                  <Mono>{fmtUsd(monthly_amount)}</Mono>
                </td>

                {/* Fee bps */}
                <td style={{ ...COL_STYLE, textAlign: "right" }}>
                  <Mono dim>{fmtBps(fee_bps)}</Mono>
                </td>

                {/* Used / Cap */}
                <td style={{ ...COL_STYLE, textAlign: "center" }}>
                  <Mono>
                    <span style={{ color: "var(--color-text)" }}>{months_used}</span>
                    <span style={{ color: "var(--color-text-3)" }}>/{months_covered}</span>
                  </Mono>
                </td>

                {/* Remaining exposure */}
                <td style={{ ...COL_STYLE, textAlign: "right" }}>
                  <Mono dim={monthsRemaining === 0}>{fmtUsd(exposureStroops)}</Mono>
                </td>

                {/* Status */}
                <td style={COL_STYLE}>
                  <StatusBadge active={active} isCurrent={isCurrent} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
