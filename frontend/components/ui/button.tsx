import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Precision Brutalism: squared (radius 0), no shadow, no gradient, no glow ring.
// Keyboard focus is the GLOBAL amber `:focus-visible` outline in globals.css — we
// deliberately add no competing ring/border-focus utility here.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // amber fill (scarce, primary intent)
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // token border + transparent; hover fills amber (preserves .connect-cta intent)
        outline:
          "[border-color:var(--color-border)] bg-transparent text-foreground hover:bg-primary hover:text-primary-foreground hover:[border-color:var(--color-accent)]",
        // neutral surface-2 fill
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // transparent; neutral surface-2 hover
        ghost:
          "bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground",
        // error fill
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // amber text link
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        default: "h-9 px-3.5",
        lg: "h-11 px-5 text-base",
        icon: "size-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
