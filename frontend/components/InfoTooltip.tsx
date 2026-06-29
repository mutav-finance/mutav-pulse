"use client";

/**
 * InfoTooltip — a small bordered "?" trigger that reveals an explanatory bubble
 * on hover/focus. Same visual language as the MetricCard tooltip; use it to tuck
 * away methodology/assumption notes next to a section heading.
 *
 * Design: Precision Brutalism — square trigger, hairline border, no shadow.
 *
 * Internals migrated onto the shared Radix Tooltip primitive
 * (`@/components/ui/tooltip`); the public props (`children`, `label`, `width`)
 * are preserved exactly so MetricCard / ReserveTransparency need no changes.
 */

import { type ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InfoTooltip({
  children,
  label = "More information",
  width = 320,
}: {
  children: ReactNode;
  label?: string;
  width?: number;
}) {
  return (
    // delayDuration 0 preserves the original immediate hover/focus reveal.
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={label}
            tabIndex={0}
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
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          // Match the legacy bubble exactly: surface-2 fill, 10/14 padding,
          // fixed `width` (capped to viewport), overriding the primitive's
          // popover bg / max-w-xs / px-3 py-1.5 defaults.
          style={{
            backgroundColor: "var(--color-surface-2)",
            padding: "10px 14px",
            width: `${width}px`,
            maxWidth: "90vw",
          }}
        >
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              color: "var(--color-text-2)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {children}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
