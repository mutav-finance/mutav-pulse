"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Precision Brutalism: a 14px squared box, no radius/shadow. Resting state uses
// the `--color-border-input` boundary; checked fills copper (the terminal/ops
// accent, matching the original native checkbox's accent-color). Check glyph is
// an inline SVG — the project ships no lucide-react dependency.
function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-3.5 shrink-0 border border-input bg-transparent outline-none transition-colors",
        "data-[state=checked]:bg-[var(--color-copper)] data-[state=checked]:[border-color:var(--color-copper)] data-[state=checked]:text-[var(--color-canvas)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckGlyph className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
