"use client";

/**
 * NavShell — shared top navigation bar for all pages.
 *
 * Hierarchy:
 *   MUTAV (logo) · earn · transparency · protocol
 *   Right: ConnectButton
 *
 * Active-route: current link gets an amber underline + full-brightness text
 * (investidor front). On the terminal front (/protocol) the active link gets a
 * copper underline. The logo is a fixed-color brand mark — identical on both fronts.
 *
 * Front detection: reads `data-front` from the nearest ancestor, or defaults
 * to "investidor". The layout passes the front to <html>, so NavShell can
 * always resolve it from the DOM.
 *
 * Design: Precision Brutalism — 56px height, border-bottom only, no shadows.
 */

import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/ConnectButton";

interface NavLink {
  href: string;
  label: string;
  /** Match strategy: "exact" | "prefix" */
  match?: "exact" | "prefix";
}

const NAV_LINKS: NavLink[] = [
  { href: "/earn", label: "earn", match: "exact" },
  { href: "/earn/transparency", label: "transparency", match: "exact" },
  { href: "/protocol", label: "protocol", match: "prefix" },
];

/** Resolve whether this front is the terminal register */
function isTerminalFront(pathname: string): boolean {
  return pathname.startsWith("/protocol");
}

export function NavShell() {
  const pathname = usePathname();
  const terminal = isTerminalFront(pathname);

  /** True when this link is the current page */
  function isActive(link: NavLink): boolean {
    if (link.match === "prefix") return pathname.startsWith(link.href);
    return pathname === link.href;
  }

  const accentVar = terminal ? "var(--color-copper)" : "var(--color-accent)";

  return (
    <nav
      style={{
        height: "56px",
        backgroundColor: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
      aria-label="Main navigation"
    >
      {/* Left: logo + nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        {/* Logo — fixed-color brand mark, identical on both fronts */}
        <a
          href="/"
          aria-label="MUTAV — home"
          style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-mutav.svg"
            alt="MUTAV"
            height={28}
            style={{ display: "block", height: "28px", width: "auto" }}
          />
        </a>

        {/* Nav links */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "24px" }}
          role="list"
        >
          {NAV_LINKS.map((link) => {
            const active = isActive(link);
            return (
              <a
                key={link.href}
                href={link.href}
                role="listitem"
                aria-current={active ? "page" : undefined}
                className={terminal ? "font-mono" : "font-body"}
                style={{
                  fontSize: terminal ? "13px" : "14px",
                  fontWeight: 500,
                  color: active ? "var(--color-text)" : "var(--color-text-2)",
                  textDecoration: "none",
                  letterSpacing: terminal ? "0.04em" : "0.01em",
                  // Active underline — amber for investidor, copper for terminal
                  borderBottom: active
                    ? `1px solid ${accentVar}`
                    : "1px solid transparent",
                  paddingBottom: "1px",
                }}
              >
                {link.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Right: wallet connect */}
      <ConnectButton />
    </nav>
  );
}
