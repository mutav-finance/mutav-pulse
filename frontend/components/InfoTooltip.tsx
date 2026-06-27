"use client";

/**
 * InfoTooltip — a small bordered "?" trigger that reveals an explanatory bubble
 * on hover/focus. Same visual language as the MetricCard tooltip; use it to tuck
 * away methodology/assumption notes next to a section heading.
 *
 * Design: Precision Brutalism — square trigger, hairline border, no shadow.
 */

import { useState, type ReactNode } from "react";

export function InfoTooltip({
  children,
  label = "More information",
  width = 320,
}: {
  children: ReactNode;
  label?: string;
  width?: number;
}) {
  const [show, setShow] = useState(false);

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span
        role="button"
        aria-label={label}
        tabIndex={0}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          backgroundColor: "var(--color-surface-3)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-2)",
          fontSize: "10px",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          cursor: "default",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ?
      </span>
      {show && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 20,
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            padding: "10px 14px",
            width: `${width}px`,
            maxWidth: "90vw",
          }}
        >
          <p className="font-body" style={{ fontSize: "11px", color: "var(--color-text-2)", lineHeight: 1.5, margin: 0 }}>
            {children}
          </p>
        </div>
      )}
    </span>
  );
}
