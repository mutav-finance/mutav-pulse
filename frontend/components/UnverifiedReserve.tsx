"use client";

import Link from "next/link";
import { contractUrl } from "@/lib/config";

/**
 * Shown for a /earn/[vaultAddr] route whose address is a valid contract but NOT
 * in the verified registry. Refuses to present it as a MUTAV reserve.
 */
export function UnverifiedReserve({ address }: { address: string }) {
  return (
    <main
      data-front="terminal"
      className="texture-terminal"
      style={{ minHeight: "100vh", backgroundColor: "var(--color-canvas)", color: "var(--color-text)" }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "64px var(--page-pad)" }}>
        <p className="font-body" style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--color-error)", textTransform: "uppercase", margin: "0 0 8px" }}>
          UNVERIFIED RESERVE
        </p>
        <h1 className="font-display" style={{ fontSize: "24px", letterSpacing: "-0.02em", margin: "0 0 16px" }}>
          This contract is not a recognized MUTAV reserve
        </h1>
        <p className="font-body" style={{ fontSize: "14px", color: "var(--color-text-2)", lineHeight: 1.6, margin: "0 0 16px" }}>
          The address below is a valid Stellar contract but is not in MUTAV&apos;s verified
          reserve registry. It may be an impersonation. <strong>Do not deposit.</strong>
        </p>
        <p className="font-mono" style={{ fontSize: "12px", color: "var(--color-text-3)", wordBreak: "break-all", border: "1px solid var(--color-border)", padding: "12px", margin: "0 0 24px" }}>
          {address}
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link href="/" className="font-mono" style={{ fontSize: "13px", color: "var(--color-accent)", textDecoration: "none" }}>
            ← Verified reserves
          </Link>
          <a href={contractUrl(address)} target="_blank" rel="noreferrer" className="font-mono" style={{ fontSize: "13px", color: "var(--color-text-3)", textDecoration: "none" }}>
            Inspect on explorer ↗
          </a>
        </div>
      </div>
    </main>
  );
}
