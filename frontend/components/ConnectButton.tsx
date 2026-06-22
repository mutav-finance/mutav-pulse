"use client";

/**
 * components/ConnectButton.tsx
 *
 * Connects / disconnects the Stellar wallet. Renders:
 *   - Disconnected: "Connect Wallet" — amber-accented primary CTA
 *   - Connected:    truncated address (first 4 + last 4 chars) + "Disconnect" text
 *   - Connecting:   loading state with muted label
 *
 * Design: Precision Brutalism — no rounded corners, no shadows,
 * amber used sparingly (<5% of pixels), JetBrains Mono for address data.
 * See .design/branding/tga/identity/palettes.json for token source.
 */

import { useWallet } from "./WalletProvider";

// Truncate a Stellar G-address to "G1AB…XY4Z"
function truncateAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, connecting, error, connect, disconnect } = useWallet();

  // ── Connected state ──────────────────────────────────────────────────────
  if (address) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Address badge */}
        <span
          className="font-mono"
          style={{
            fontSize: "12px",
            color: "var(--color-text)",
            letterSpacing: "0.02em",
            padding: "4px 8px",
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
            lineHeight: 1,
          }}
          aria-label={`Connected wallet: ${address}`}
          title={address}
        >
          {truncateAddress(address)}
        </span>

        {/* Disconnect */}
        <button
          onClick={disconnect}
          className="font-body"
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--color-text-3)",
            background: "none",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            letterSpacing: "0.01em",
          }}
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // ── Connecting / disconnected state ──────────────────────────────────────
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "6px" }}>
      <button
        onClick={() => { connect().catch(() => { /* error surfaced via context */ }); }}
        disabled={connecting}
        className="font-body"
        aria-label="Connect Stellar wallet"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.01em",

          // Amber CTA — scarce, intentional
          color: connecting ? "var(--color-text-3)" : "var(--color-canvas)",
          backgroundColor: connecting
            ? "var(--color-surface)"
            : "var(--color-accent)",
          border: connecting
            ? "1px solid var(--color-border)"
            : "1px solid var(--color-accent)",

          padding: "7px 16px",
          cursor: connecting ? "not-allowed" : "pointer",
          // No border-radius (Precision Brutalism)
          // No box-shadow, no gradient
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {/* Animated dot — only while connecting */}
        {connecting && (
          <span className="live-dot" aria-hidden="true" />
        )}
        <span>{connecting ? "Connecting…" : "Connect Wallet"}</span>
      </button>

      {/* Error feedback — brand-styled, shown only when a connect attempt failed */}
      {error && (
        <span
          className="font-mono"
          role="alert"
          style={{
            fontSize: "11px",
            color: "var(--color-error)",
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
