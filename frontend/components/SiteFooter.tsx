/**
 * SiteFooter — shared brand footer: logo + tagline (left), verification /
 * source links (right). Used across pages (home, reserve hub) so the footer
 * stays identical everywhere.
 *
 * Design: Precision Brutalism — hairline top border, no shadow.
 */

import Link from "next/link";
import { PRIMARY_RESERVE } from "@/lib/reserves";
import { contractUrl } from "@/lib/config";

export function SiteFooter() {
  const links = [
    { label: "Verify vault ↗", href: contractUrl(PRIMARY_RESERVE.address), ext: true },
    { label: "Transparency ↗", href: `/earn/${PRIMARY_RESERVE.address}#transparency`, ext: false },
    { label: "GitHub ↗", href: "https://github.com/mutav-finance", ext: true },
  ];

  return (
    <footer
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "32px",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingTop: "32px",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {/* Brand block */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-mutav.svg"
          alt="MUTAV"
          style={{ display: "block", height: "26px", width: "auto", alignSelf: "flex-start" }}
        />
        <p className="font-display" style={{ fontSize: "16px", letterSpacing: "-0.01em", color: "var(--color-text)", margin: 0 }}>
          Real asset. Real yield.
        </p>
        <p className="font-mono" style={{ fontSize: "12px", letterSpacing: "0.02em", color: "var(--color-text-3)", margin: 0 }}>
          On-chain rental guarantees.
        </p>
      </div>

      {/* Verify / transparency / source links — right-aligned */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
        {links.map((l) =>
          l.ext ? (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              style={{ fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-3)", textDecoration: "none" }}
            >
              {l.label}
            </a>
          ) : (
            <Link
              key={l.label}
              href={l.href}
              className="font-mono"
              style={{ fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-3)", textDecoration: "none" }}
            >
              {l.label}
            </Link>
          ),
        )}
      </div>
    </footer>
  );
}
