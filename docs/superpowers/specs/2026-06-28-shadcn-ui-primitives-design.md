# shadcn UI Primitives, Themed to MUTAV Tokens

**Date:** 2026-06-28
**Branch:** `chore/frontend-ui-polish`
**Status:** Design — approved, pending spec review

## Problem

The frontend styles every component with inline `style={{ ... }}` over `var(--color-*)`
brand tokens. Interactive controls (buttons, inputs, tabs, the custom tooltip) are
hand-built, so each one re-implements focus, keyboard, and ARIA behavior — inconsistently
and with accessibility gaps. We want a small, accessible primitive layer without abandoning
the "Precision Brutalism" look or the three-front token system.

## Goal

Adopt **shadcn/ui** (which is just **Radix UI + Tailwind + CVA**, with the component source
copied into our repo) as the base for UI primitives, with all theming driven by the existing
MUTAV brand tokens. Then migrate the existing form/control surfaces onto these primitives at
**visual + behavioral parity** (not a redesign), gaining Radix accessibility.

Non-goals: no design changes to the controls' appearance; no migration of non-form surfaces
(cards, tables, badges) in this pass; no `lucide-react` (we keep custom brand icons).

## Context / constraints

- **Tailwind v4** (no config file; `@theme` block in `app/globals.css`), **Next 16**, React 19.
  shadcn supports all three. `frontend/AGENTS.md` warns Next 16 differs from training data —
  consult `node_modules/next/dist/docs/` before writing app code.
- **No shadcn prerequisites present**: no `components.json`, no `cn()`, no Radix/CVA/clsx/
  tailwind-merge.
- **Three-front token system** in `globals.css`: brand semantic tokens (`--color-canvas`,
  `--color-surface`, `--color-surface-2/3`, `--color-text`, `--color-text-2/3`, `--color-border`,
  `--color-border-input`, `--color-accent`, `--color-copper`, `--color-success`, `--color-error`)
  are defined per `[data-front="investidor|imobiliarias|terminal"]` and swap automatically.
- **Brutalism rules:** `--radius: 0` (no rounded corners), no shadows, no gradients. Focus is a
  global amber outline (`:focus-visible`).
- The repo uses **zero Tailwind utility classes** for component visuals today. This layer
  deliberately introduces utility classes (`bg-primary`, `border-input`, …) **scoped to
  `components/ui/` primitives only**. Existing components keep their inline-style approach.

## Approach

### 1. Setup

Run `npx shadcn@latest init` configured for the existing Tailwind v4 install. It creates:
- `frontend/components.json` (style: default; `cssVariables: true`; aliases `@/components`,
  `@/lib/utils`).
- `frontend/lib/utils.ts` exporting `cn()` (clsx + tailwind-merge).
- Adds deps: `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`.

Then add primitives: `npx shadcn@latest add button input label tabs tooltip` → `components/ui/`.

### 2. Token mapping (the heart of the theming)

shadcn semantic vars become **thin aliases of brand tokens**, defined once. Because CSS custom
properties resolve at use-site through the cascade, aliasing `--background: var(--color-canvas)`
inherits whichever `--color-canvas` the active `data-front` ancestor set — so the primitives
swap across all three fronts with **no duplicate palettes**.

| shadcn var | aliases brand token |
|------------|---------------------|
| `--background` | `var(--color-canvas)` |
| `--foreground` | `var(--color-text)` |
| `--card`, `--popover` | `var(--color-surface)` |
| `--card-foreground`, `--popover-foreground` | `var(--color-text)` |
| `--primary` | `var(--color-accent)` |
| `--primary-foreground` | `var(--color-canvas)` |
| `--secondary` | `var(--color-surface-2)` |
| `--secondary-foreground` | `var(--color-text)` |
| `--muted` | `var(--color-surface)` |
| `--muted-foreground` | `var(--color-text-2)` |
| `--accent` (shadcn hover-surface) | `var(--color-surface-2)` |
| `--accent-foreground` | `var(--color-text)` |
| `--border` | `var(--color-border)` |
| `--input` | `var(--color-border-input)` |
| `--ring` | `var(--color-accent)` |
| `--destructive` | `var(--color-error)` |
| `--destructive-foreground` | `var(--color-canvas)` |
| `--radius` | `0px` |

> **Naming note:** shadcn's "accent" is a neutral hover surface, **not** our amber accent.
> Our amber maps to shadcn's `--primary`. Keep this straight when reading component classes.

### 3. The `@theme inline` collision — explicit handling

shadcn's Tailwind-v4 init appends an `@theme inline` block exposing utilities
(`--color-background: var(--background)`, `--color-border: var(--border)`, …). Two names
**collide** with brand custom properties already in `:root`/front blocks:

- `--color-border` (brand: `#2A2D33`, used widely via inline `var(--color-border)`).
- `--color-accent` (brand: amber `#E8A020`, used by hundreds of inline `var(--color-accent)`
  calls). shadcn would try to point `--color-accent` at its neutral hover surface.

A naive `@theme inline { --color-border: var(--border) }` where `--border: var(--color-border)`
forms a **reference cycle** and/or silently re-defines amber — breaking the whole UI.

**Resolution:** for colliding names, do **not** introduce an intermediate `--border`/`--accent`
layer. In `@theme inline`, point the shadcn-consumed utility tokens **directly at brand tokens**
and avoid re-exposing the two collisions under their brand names. Concretely:
- shadcn components reference `border-border`, `bg-primary`, `border-input`, `bg-background`,
  etc. We ensure `@theme inline` defines `--color-primary: var(--color-accent)`,
  `--color-input: var(--color-border-input)`, `--color-background: var(--color-canvas)`,
  and leaves the existing `--color-border` brand definition as the single source for
  `border-border`. No new property may both reference and shadow `--color-accent`/`--color-border`.
- After init, **read the generated `@theme inline` block and reconcile it by hand**; verify amber
  is unchanged by spot-checking a rendered page (any inline `var(--color-accent)` element).

This reconciliation is the one fiddly step and is explicitly verified (see Verification).

### 4. Brutalism overrides on generated components

After `add`, edit each `components/ui/*` to:
- Remove `rounded-*` classes and any `shadow-*` (e.g. `shadow-xs` on Button/Input). `--radius: 0`
  covers radius-derived rounding; hardcoded classes are stripped.
- Confirm focus uses the global amber `:focus-visible` outline (don't add a competing ring).

### 5. Variants mapped to brand

- **Button** (`cva`): `default` = amber fill (`bg-primary text-primary-foreground`), `outline`
  = token border + transparent, hover fills amber (preserves today's `connect-cta` behavior),
  `ghost`, `secondary` (`--color-surface-2`), `destructive` (`--color-error`), `link`.
  Sizes: `sm`, `default`, `lg`, `icon`. Squared, no shadow.
- **Input / Label** — `--color-border-input` boundary, amber focus; numeric inputs add
  `font-mono` + tabular-nums to match existing data styling.
- **Tabs** — Radix `Tabs`, underline-active style matching current tab bars (amber/copper
  active border, no pill background).
- **Tooltip** — Radix `Tooltip`; one `TooltipProvider` added near the root layout.

### 6. Migration (parity — same look, same behavior)

| Primitive | Sites |
|-----------|-------|
| Button | Connect, Invest, Redeem, Faucet, RefreshControl, protocol actions (~12 `<button>`/`role=button`) |
| Input + Label | `DepositWidget`, `RedeemPanel`, `BuyTesouro`, `ProtocolActionForm` |
| Tabs | `InvestCard` (invest/withdraw/fund) and the **protocol section tabs** |
| Tooltip | `InfoTooltip` reworked onto Radix internals; `?` trigger API preserved so `MetricCard` / `ReserveTransparency` call sites are unchanged |

**Deliberate exclusion — ReserveTransparency `SubNav`:** it is scroll-spy **anchor navigation**
(deep-linkable `#overview`/`#policy`/…, scroll-to-section + `IntersectionObserver` scroll-spy),
not a stateful tabs widget. Radix `Tabs` would break deep-linking and scroll behavior, so it
stays as nav links. It may optionally share the new tab *styling*, but not the Tabs primitive.

Each migration preserves exact appearance (including the warm `terminal` front now applied to
home/reserves) and keyboard behavior; no control is visually redesigned.

## Risks

1. **`@theme inline` collisions** (`--color-border`, `--color-accent`) — highest risk; handled in
   §3, verified by confirming amber is unchanged post-init.
2. **Tabs vs nav** — addressed by excluding the scroll-spy SubNav (§6).
3. **Tailwind v4 + shadcn init** writing unexpected globals — review the diff to `globals.css`
   before keeping it; our `@theme` brand block must remain intact.
4. **Next 16 specifics** — consult `node_modules/next/dist/docs/` per `AGENTS.md`.

## Verification

- `npx tsc --noEmit` clean after setup and after each migrated component.
- `npm run build` (Next 16) succeeds.
- Dev-server visual parity check per migrated surface across at least one page on the
  `terminal` front; amber accent spot-checked unchanged after the `@theme inline` reconciliation.
- Keyboard pass: Tab/Shift-Tab focus order, Tabs arrow-key nav, Tooltip focus-open + Escape.
