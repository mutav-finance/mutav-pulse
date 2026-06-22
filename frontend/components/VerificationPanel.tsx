"use client";

/**
 * VerificationPanel — on-chain verification links for all four contracts.
 *
 * Design: Precision Brutalism / Investidor.
 * - Links open Stellar Explorer in new tab
 * - JetBrains Mono for contract IDs (truncated)
 * - Inter for role labels
 * - No rounded corners, amber only on hover link color
 */

import { config } from "@/lib/config";
import { truncAddr } from "@/lib/format";

const CONTRACTS = [
  { role: "VAULT", id: config.contracts.vault },
  { role: "POLICY", id: config.contracts.policy },
  { role: "REGISTRY", id: config.contracts.registry },
  { role: "USDC", id: config.contracts.usdc },
] as const;

export function VerificationPanel() {
  return (
    <section
      aria-label="Contract verification"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "20px 24px",
      }}
    >
      {/* Section header */}
      <p
        className="font-body"
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          color: "var(--color-text-2)",
          textTransform: "uppercase",
          marginBottom: "16px",
          margin: "0 0 16px",
        }}
      >
        ON-CHAIN VERIFICATION
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1px",
          backgroundColor: "var(--color-border)",
          border: "1px solid var(--color-border)",
        }}
      >
        {CONTRACTS.map(({ role, id }) => (
          <a
            key={role}
            href={`${config.explorerBase}/contract/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${role} contract on Stellar Explorer`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "14px 16px",
              backgroundColor: "var(--color-surface)",
              textDecoration: "none",
              color: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--color-surface-2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--color-surface)";
            }}
          >
            {/* Role label */}
            <span
              className="font-body"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--color-text-3)",
                textTransform: "uppercase",
              }}
            >
              {role}
            </span>

            {/* Contract ID — mono, truncated */}
            <span
              className="font-mono"
              style={{
                fontSize: "12px",
                color: "var(--color-accent)",
                fontFeatureSettings: '"tnum" 1',
                letterSpacing: "0.01em",
                wordBreak: "break-all",
              }}
            >
              {truncAddr(id)}
            </span>

            {/* Full ID for screen readers, visual hint */}
            <span
              aria-hidden="true"
              style={{
                fontSize: "9px",
                color: "var(--color-text-3)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.01em",
                opacity: 0.7,
              }}
            >
              → stellar.expert
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
