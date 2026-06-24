"use client";

/**
 * VenueDirectory — table of yield venues the MUTAV reserve allocates across.
 *
 * Columns: Protocol · Role · Status · Action
 *
 * Venues:
 *   - DeFindex  — Yield         — Live    — links to adapter on explorer
 *   - Soroswap  — Swap          — Planned — disabled "Soon"
 *   - Blend     — Lending       — Planned — disabled "Soon"
 *
 * Design: Precision Brutalism / Investidor.
 * - Amber badge ONLY on "Live" — scarce, meaningful.
 * - Muted/neutral for "Planned" badges.
 * - JetBrains Mono for status labels and action text.
 * - Inter for protocol names and role labels.
 * - No rounded corners, no shadows, depth via bg steps.
 */

import { config } from "@/lib/config";

// ── Venue definitions ─────────────────────────────────────────────────────────

type VenueStatus = "live" | "planned";

interface Venue {
  name: string;
  role: string;
  description: string;
  status: VenueStatus;
  /** href for the action link; undefined = no link (Planned) */
  href?: string;
  /** label shown on the action; overridden when "via reserve" fallback applies */
  actionLabel?: string;
}

// DeFindex: if NEXT_PUBLIC_ADAPTER_ID is configured, link to adapter;
// otherwise fall back to the vault contract with a "via reserve" label.
const adapterLink: { href: string; label: string } = (() => {
  const adapterId =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_ADAPTER_ID
      : undefined;
  if (adapterId) {
    return {
      href: `${config.explorerBase}/contract/${adapterId}`,
      label: "View adapter →",
    };
  }
  return {
    href: `${config.explorerBase}/contract/${config.contracts.vault}`,
    label: "via reserve →",
  };
})();

const VENUES: Venue[] = [
  {
    name: "DeFindex",
    role: "Yield",
    description: "Multi-strategy vault allocator. Reserve capital is routed to the DeFindex adapter wired to the MUTAV vault to generate yield in the testnet PoC.",
    status: "live",
    href: adapterLink.href,
    actionLabel: adapterLink.label,
  },
  {
    name: "Soroswap",
    role: "Swap",
    description: "AMM on Stellar for efficient on-chain USDC routing and reserve rebalancing.",
    status: "planned",
  },
  {
    name: "Blend",
    role: "Lending",
    description: "Lending protocol on Stellar enabling collateralized lending from reserve surplus.",
    status: "planned",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

/** Status badge: 6px square + mono label — amber ONLY for Live */
function StatusBadge({ status }: { status: VenueStatus }) {
  const isLive = status === "live";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        aria-hidden="true"
        style={{
          width: "6px",
          height: "6px",
          flexShrink: 0,
          backgroundColor: isLive ? "var(--color-accent)" : "var(--color-text-3)",
        }}
      />
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: isLive ? "var(--color-accent)" : "var(--color-text-3)",
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {isLive ? "LIVE" : "PLANNED"}
      </span>
    </div>
  );
}

/** Action cell: link for Live, disabled span for Planned */
function ActionCell({ venue }: { venue: Venue }) {
  if (venue.status === "live" && venue.href) {
    return (
      <a
        href={venue.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${venue.actionLabel ?? "View on explorer"} — opens Stellar Explorer`}
        className="font-mono venue-action-link"
        style={{
          fontSize: "12px",
          letterSpacing: "0.04em",
          color: "var(--color-text-2)",
          textDecoration: "none",
          fontFeatureSettings: '"tnum" 1',
          whiteSpace: "nowrap",
          transition: "color 150ms ease-out",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color =
            "var(--color-accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color =
            "var(--color-text-2)";
        }}
      >
        {venue.actionLabel ?? "View →"}
      </a>
    );
  }

  return (
    <span
      className="font-mono"
      aria-disabled="true"
      style={{
        fontSize: "12px",
        letterSpacing: "0.04em",
        color: "var(--color-text-3)",
        fontFeatureSettings: '"tnum" 1',
        cursor: "default",
      }}
    >
      Soon
    </span>
  );
}

// ── Column styles ─────────────────────────────────────────────────────────────

const HEADER_CELL: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--color-text-3)",
  fontFamily: "var(--font-body)",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface-2)",
  whiteSpace: "nowrap",
};

const BODY_CELL: React.CSSProperties = {
  padding: "16px 16px",
  verticalAlign: "top",
};

// ── Main component ────────────────────────────────────────────────────────────

export function VenueDirectory() {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        overflowX: "auto",
      }}
    >
      <table
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
        aria-label="Protocol integration directory"
      >
        <colgroup>
          <col style={{ width: "22%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "40%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={HEADER_CELL} scope="col">Protocol</th>
            <th style={HEADER_CELL} scope="col">Role</th>
            <th style={{ ...HEADER_CELL, width: "auto" }} scope="col">Description</th>
            <th style={HEADER_CELL} scope="col">Status</th>
            <th style={{ ...HEADER_CELL, textAlign: "right" }} scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {VENUES.map((venue, i) => {
            const rowBg = i % 2 === 0 ? "var(--color-surface)" : "var(--color-canvas)";
            const isLast = i === VENUES.length - 1;

            return (
              <tr
                key={venue.name}
                style={{
                  backgroundColor: rowBg,
                  borderBottom: isLast ? "none" : "1px solid var(--color-border)",
                }}
              >
                {/* Protocol name */}
                <td style={BODY_CELL}>
                  <span
                    className="font-body"
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: venue.status === "live"
                        ? "var(--color-text)"
                        : "var(--color-text-2)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {venue.name}
                  </span>
                </td>

                {/* Role */}
                <td style={BODY_CELL}>
                  <span
                    className="font-body"
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text-2)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {venue.role}
                  </span>
                </td>

                {/* Description */}
                <td style={{ ...BODY_CELL, paddingRight: "24px" }}>
                  <p
                    className="font-body"
                    style={{
                      fontSize: "13px",
                      color: "var(--color-text-3)",
                      lineHeight: 1.5,
                      margin: 0,
                      maxWidth: "480px",
                    }}
                  >
                    {venue.description}
                  </p>
                </td>

                {/* Status */}
                <td style={{ ...BODY_CELL, verticalAlign: "middle" }}>
                  <StatusBadge status={venue.status} />
                </td>

                {/* Action */}
                <td style={{ ...BODY_CELL, textAlign: "right", verticalAlign: "middle" }}>
                  <ActionCell venue={venue} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
