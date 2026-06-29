import * as React from "react"

import { cn } from "@/lib/utils"

// Precision Brutalism: squared, no shadow, no glow ring. The `--color-border-input`
// boundary is the resting state; amber focus comes from the global `:focus-visible`
// rule in globals.css (which sets both the outline and an amber border-color).
// Numeric fields render in the mono / tabular-nums data face to match MUTAV data styling.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isNumeric = type === "number"

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        isNumeric && "font-mono tabular-nums",
        className
      )}
      {...props}
    />
  )
}

export { Input }
