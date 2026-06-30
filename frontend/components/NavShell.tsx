"use client";

/**
 * NavShell — shared top navigation bar for all pages.
 *
 * Hierarchy:
 *   MUTAV (logo) · home · reserves · protocol
 *   Right: ConnectButton
 *
 * Active-route: current link gets an amber underline + full-brightness text
 * (investidor front). On the terminal front (/protocol) the active link gets a
 * copper underline. The logo is a fixed-color brand mark — identical on both fronts.
 *
 * Responsive: below 768px the link row collapses behind a hamburger disclosure
 * (the ConnectButton stays in the bar). Links live in a real <ul>/<li> so each
 * keeps its link role in the a11y tree.
 *
 * Front detection: reads `data-front` from the nearest ancestor, or defaults
 * to "investidor". The layout passes the front to <html>, so NavShell can
 * always resolve it from the DOM.
 *
 * Design: Precision Brutalism — 56px height, border-bottom only, no shadows.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/ConnectButton";
import { Button } from "@/components/ui/button";
import { PRIMARY_RESERVE } from "@/lib/reserves";

interface NavLink {
  href: string;
  label: string;
  /** Match strategy: "exact" (default) | "prefix" */
  match?: "exact" | "prefix";
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "home", match: "exact" },
  { href: "/reserves", label: "reserves", match: "prefix" },
  { href: `/protocol/${PRIMARY_RESERVE.address}`, label: "protocol", match: "prefix" },
  { href: "/admin", label: "admin", match: "prefix" },
];

/** Resolve whether this front is the terminal register */
function isTerminalFront(pathname: string): boolean {
  return pathname.startsWith("/protocol") || pathname.startsWith("/admin");
}

export function NavShell() {
  const pathname = usePathname();
  const terminal = isTerminalFront(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  // When the mobile panel is open, Escape closes it and returns focus to the
  // hamburger (queried by class so it works regardless of Button ref-forwarding).
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        (document.querySelector(".nav-hamburger") as HTMLElement | null)?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /** True when this link is the current page */
  function isActive(link: NavLink): boolean {
    if (link.match === "prefix") return pathname.startsWith(link.href);
    return pathname === link.href;
  }

  const accentVar = terminal ? "var(--color-copper)" : "var(--color-accent)";

  function renderLink(link: NavLink, mobile: boolean) {
    const active = isActive(link);
    return (
      <li key={link.href} style={{ listStyle: "none", display: "flex" }}>
        <Link
          href={link.href}
          aria-current={active ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
          className="font-mono"
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: active ? "var(--color-text)" : "var(--color-text-2)",
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            // Active underline — amber for investidor, copper for terminal
            borderBottom: active ? `1px solid ${accentVar}` : "1px solid transparent",
            // Mobile rows get full-width 44px tap targets; desktop stays inline.
            ...(mobile
              ? { width: "100%", minHeight: "44px", alignItems: "center", display: "flex" }
              : { paddingBottom: "1px" }),
          }}
        >
          {link.label}
        </Link>
      </li>
    );
  }

  return (
    <nav
      style={{
        backgroundColor: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
      aria-label="Main navigation"
    >
      <div
        style={{
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--page-pad, 32px)",
        }}
      >
        {/* Left: logo + desktop nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          {/* Logo — fixed-color brand mark, identical on both fronts */}
          <Link
            href="/"
            aria-label="MUTAV, home"
            onClick={() => setMenuOpen(false)}
            style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mutav.svg"
              alt="MUTAV"
              height={28}
              style={{ display: "block", height: "28px", width: "auto" }}
            />
          </Link>

          {/* Desktop nav links — hidden < 768px (see .nav-links-desktop) */}
          <ul
            className="nav-links-desktop"
            style={{ alignItems: "center", gap: "24px", margin: 0, padding: 0 }}
          >
            {NAV_LINKS.map((link) => renderLink(link, false))}
          </ul>
        </div>

        {/* Right: wallet connect + mobile hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <ConnectButton />
          {/*
           * Mobile hamburger — migrated to the shared <Button> primitive (ghost).
           * Visibility (display none/inline-flex by breakpoint) is owned by the
           * `.nav-hamburger` rule in globals.css, which is unlayered and so wins
           * over the primitive's layered `inline-flex` utility. Inline styles
           * reproduce the original look exactly (44px box, token border, text-2
           * color, transparent fill, no hover change) and override the ghost
           * variant's hover/text utilities (inline > class specificity).
           */}
          <Button
            type="button"
            variant="ghost"
            className="nav-hamburger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="nav-mobile-panel"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              width: "44px",
              height: "44px",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-2)",
              cursor: "pointer",
            }}
          >
            {/* Inline 18px keeps the icon at its original size, opting out of the
                primitive's `[&_svg:not([class*='size-'])]:size-4` (16px) default. */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={{ width: "18px", height: "18px" }}>
              {menuOpen ? (
                <>
                  <path d="M5 5l14 14" />
                  <path d="M19 5L5 19" />
                </>
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </Button>
        </div>
      </div>

      {/* Mobile dropdown panel — only rendered/visible < 768px when open */}
      {menuOpen && (
        <ul
          id="nav-mobile-panel"
          className="nav-mobile-panel"
          style={{
            margin: 0,
            padding: "8px var(--page-pad, 32px) 16px",
            borderTop: "1px solid var(--color-border)",
            backgroundColor: "var(--color-canvas)",
          }}
        >
          {NAV_LINKS.map((link) => renderLink(link, true))}
        </ul>
      )}
    </nav>
  );
}
