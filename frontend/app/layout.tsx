import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { NavShell } from "@/components/NavShell";
import { TooltipProvider } from "@/components/ui/tooltip";

// Geist Bold (700) only — the Declaration layer font.
// Never load other weights; MUTAV uses Bold exclusively for headings.
const geist = Geist({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Inter and JetBrains Mono are loaded as variable fonts via @fontsource-variable
// in globals.css — no next/font needed; they ship as self-hosted WOFF2.

export const metadata: Metadata = {
  title: "Mutav Pulse: MUTAV Reserve",
  description: "Solvency-gated tokenized reserve vault on Stellar. Rental-guarantee infrastructure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} h-full antialiased`}
      data-front="investidor"
      // Stellar Wallets Kit injects `--swk-*` CSS custom properties onto
      // document.documentElement at import time (its themeEffect runs during
      // client bundle eval, before hydration) — see lib/wallet.ts → the kit's
      // state/effects.js. The server never renders those, so React flags an
      // <html> style mismatch. Suppress at this element only (one level deep,
      // not children); the injected vars are cosmetic and self-heal post-mount.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Skip link — first focusable element; jumps past the sticky nav to the
            page content (WCAG 2.4.1). Visually hidden until focused. */}
        <a href="#main-content" className="skip-link font-body">Skip to content</a>
        <WalletProvider>
          {/* Single app-wide Radix TooltipProvider (see components/ui/tooltip). */}
          <TooltipProvider>
            {/* Shared top nav — rendered on all pages */}
            <NavShell />
            <div id="main-content" tabIndex={-1} style={{ outline: "none", display: "flex", flexDirection: "column", flex: "1 1 auto", minWidth: 0 }}>
              {children}
            </div>
          </TooltipProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
