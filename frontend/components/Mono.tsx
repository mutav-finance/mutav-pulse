/**
 * Mono — shared Evidence-layer span (JetBrains Mono, tabular nums).
 *
 * Use for all on-chain numbers, addresses, hashes, and terminal data values.
 * Layer 3 of the TGA three-layer typography system.
 */

import React from "react";

interface MonoProps {
  children: React.ReactNode;
  /** Inline style overrides (color, fontSize, etc.) */
  style?: React.CSSProperties;
  /** Additional Tailwind / CSS classes */
  className?: string;
  /** Dim variant — uses --color-text-3 instead of inheriting */
  dim?: boolean;
}

export function Mono({ children, style, className = "", dim = false }: MonoProps) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{
        fontFeatureSettings: '"tnum" 1',
        fontVariantNumeric: "tabular-nums",
        ...(dim ? { color: "var(--color-text-3)" } : {}),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
