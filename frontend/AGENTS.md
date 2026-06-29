<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Styling conventions (READ before writing UI)

This app has **two intentional styling layers** — match the one you're in:

1. **UI primitives — `components/ui/*`** (Button, Input, Label, Tabs, Tooltip): shadcn
   (Radix + Tailwind + CVA). These use **Tailwind utility classes**. **Build new
   interactive controls (buttons, inputs, tabs, tooltips, dialogs) from these primitives** —
   do not hand-roll a raw `<button>`/`<input>` with inline styles.
2. **Product components** (everything else): styled with **inline `style={{ ... }}`** over
   `var(--color-*)` brand tokens. Keep using this layer for layout/product UI; don't rewrite
   it into Tailwind utilities wholesale.

**Theming = brand tokens only.** shadcn semantic vars are thin aliases of `var(--color-*)`
in ONE `@theme inline` block in `app/globals.css` (so they swap per `data-front`). Never
invent hex colors. Primary CTA = amber (`--primary` → `--color-accent`); shadcn's `--accent`
is a neutral hover surface, NOT amber.

**Precision Brutalism:** radius `0`, no shadows, no gradients. Keyboard focus is the global
amber `:focus-visible` outline — don't add competing rings.

## Hard guardrails (these have bitten us)

- **NEVER redefine Tailwind's spacing scale** (`--spacing` / `--spacing-<n>`) in `@theme`.
  A custom 8px-grid override once made `h-10` resolve to **80px** and blew up every shadcn
  button/input/tab. Keep Tailwind's default `0.25rem` multiplier (`h-10` = 40px). Spacing
  for product components goes in inline `style`, not a global scale override.
- **NEVER let `@theme inline` redefine or cycle `--color-accent` or `--color-border`.** Those
  are brand custom properties read by hundreds of inline `var(--color-accent)` calls. shadcn
  utilities must reference brand tokens on their right-hand side only.
- **Don't add `lucide-react` / `tw-animate-css` / the `shadcn` CLI to runtime `dependencies`.**
  The shadcn "nova" init pulls them in; they're unused here.
- After any change to `globals.css` or a `components/ui/*` primitive, **verify rendered sizing**
  (a button should be ~36–44px tall, not 80px) — `tsc`/`build` will NOT catch a spacing blowup.
