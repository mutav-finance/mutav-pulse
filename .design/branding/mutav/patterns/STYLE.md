# STYLE.md — MUTAV Agent Contract
> Token de Garantia de Aluguel · Brand System v1.0 · 2026-04-14
> Source of truth: `mutav.yml` — this document is a rendered contract for builders and agents.

---

## 1. Intensity

| Dimension | Score | Behavioral meaning |
|-----------|-------|--------------------|
| **variance** | 3 | Structured and predictable. Ruler archetype communicates through architecture, not surprise. Score is 3 (not 1) because three distinct front personalities exist. |
| **motion** | 2 | Minimal, functional only. One ambient animation in the entire system: the amber pulse dot (opacity, 2s). All other motion is instantaneous color/border change at 150ms ease-out. No transforms. |
| **density** | 6 | High information density. Investidor and Terminal pack data tables, live counters, and timestamps. Imobiliárias is lighter (~4) but drives the system average up. |

**Preset overrides:**
- minimal-dark `motion: 4` overridden to `2` — no glow shifts, no scale transforms
- minimal-dark `density: 2` overridden to `6` — MUTAV is not spacious, it is precise
- terminal `density: 7` pulled back to ~6 — operators need readability, not maximum compression

---

## 2. Philosophy

**Precision Brutalism.** MUTAV's visual grammar refuses every element that cannot carry information. No gradients. No shadows. No glass. No rounded corners. Each decision traces to a function.

**Three-layer hierarchy is the core law.** Every screen in every front must present information in exactly three typographic registers:

1. **Declaration** — Geist Bold. What happened. What the status is.
2. **Explanation** — Inter. Why it matters. Context.
3. **Evidence** — JetBrains Mono. Machine-verified proof: amounts, timestamps, hashes.

No screen is complete without all three layers. This is not a stylistic preference — it is the brand's argument about what trustworthy information looks like.

**Amber is scarce.** The amber accent (#E8A020 dark, #C47E10 light) occupies less than 5% of screen pixels at any moment. It appears on: CTAs, the logo, the live pulse dot, active nav states, status markers. Amber diluted is amber destroyed.

**Surface stacking creates depth.** There are no shadows in MUTAV. Depth reads through background steps: canvas → surface-1 → surface-2 → surface-3. Each step is a deliberate darker or lighter plane. The browser stacks them; the eye reads hierarchy.

**The system executes before it declares.** Voice is authoritative calm. Specific over general: "4h37m" not "fast". "R$2.847,00 · 18h22" not "paid". Verification as invitation, not as defense.

**Three fronts, one identity.** Investidor (dark/dense/precision), Imobiliárias (light/warm/structured), Terminal (monospace/operator). Same amber. Same 0px radius. Same three-layer hierarchy. Different color resolutions of the same semantic tokens.

---

## 3. Patterns

### 3.1 Card

| Property | Dashboard Investidor | Dashboard Imobiliárias |
|----------|---------------------|------------------------|
| background | `#16181C` | `#FFFFFF` |
| border | `1px solid #2A2D33` | `1px solid #D9D7D2` |
| border-radius | `0px` | `0px` |
| shadow | none | none |
| padding | `24px` | `24px` |
| label font | Inter Medium 12px ALL CAPS `+0.01em` `#8A8F99` | Inter Medium 14px `#1A1A1A` |
| value font | Geist Bold 48px `#F0F0EE` | JetBrains Mono Medium 16px `#1A1A1A` tabular-nums |
| sub-value font | JetBrains Mono 11px `#555B66` tabular-nums | — |
| status stripe | — | 4px top border: amber active / `#B83232` default / `#2E8B5A` paid |
| inadimplencia state | `#C94040` error semantics | card bg shifts to `#FFF8EE` |
| pagamento state | `#3DAB72` success semantics | amount: Geist Bold 32px `#2E8B5A` |

### 3.2 Button — Primary

| Property | Investidor | Imobiliárias | Terminal |
|----------|------------|--------------|---------|
| background | transparent | `#C47E10` | transparent |
| border | `1px solid #E8A020` | `1px solid #C47E10` | `1px solid #E8A020` |
| border-radius | `0px` | `0px` | `0px` |
| height | 40px | 48px | — |
| text color | `#E8A020` | `#1A1A1A` | `#E8A020` |
| font | Inter Medium 14px | Inter Medium 14px | JetBrains Mono Medium 13px |
| label format | label | label | `[ LABEL ]` |
| hover bg | `#E8A020` | `#9E6A10` | transparent |
| hover text | `#0E0F11` | `#1A1A1A` | — |
| hover border | — | — | `#B87010` |
| transition | 150ms ease-out color + bg | 150ms ease-out bg | 150ms ease-out border |

> **WCAG note (Imobiliárias):** `#1A1A1A` text on `#C47E10` = 5.3:1 AA. Do NOT use white text on amber fill — it fails.

### 3.3 Button — Secondary

| Property | Investidor | Imobiliárias |
|----------|------------|--------------|
| background | transparent | transparent |
| border | `1px solid #2A2D33` | `1px solid #C47E10` |
| border-radius | `0px` | `0px` |
| height | 40px | 48px |
| text color | `#8A8F99` | `#C47E10` |
| hover border | `#E8A020` | — |
| hover text | `#F0F0EE` | — |
| hover bg | — | `#FFF0D4` |

### 3.4 Input

| Property | Investidor | Imobiliárias |
|----------|------------|--------------|
| background | transparent | `#FFFFFF` |
| border | `1px solid #2A2D33` | `1px solid #D9D7D2` |
| border-radius | `0px` | `0px` |
| text color | `#F0F0EE` | `#1A1A1A` |
| label font | Inter Medium 13px `#8A8F99` | Inter Medium 13px `#6B6860` |
| input font (data) | JetBrains Mono Regular 14px | JetBrains Mono Regular 14px |
| input font (text) | Inter Regular 14px | Inter Regular 14px |
| placeholder | `#555B66` | `#9E9C98` |
| focus border | `1px solid #E8A020` | `1px solid #C47E10` |
| focus ring | none | none |
| focus glow | none | none |

> No ring, no glow, no box-shadow on focus — ever. The border color change alone signals focus.

### 3.5 Badge

```
[6px square] [8px gap] [JetBrains Mono 11px label]
```

| State | Square color | Label |
|-------|-------------|-------|
| ATIVO | `#3DAB72` | `ATIVO` |
| EM_DEFAULT | `#C94040` | `EM_DEFAULT` |
| LIQUIDADO | `#E8A020` | `LIQUIDADO` |

- Square: exactly 6×6px, `border-radius: 0px`
- Label: inherits `--color-text-2` (never amber)
- Never use pill shapes. Never use background-fill badges.
- This is the only badge shape in the system.

### 3.6 Nav (Dashboard Investidor)

| Element | Spec |
|---------|------|
| background | `#0E0F11` |
| height | 56px |
| border-bottom | `1px solid #2A2D33` |
| logo | Direction 1: `"mutav"` Geist Bold lowercase `#E8A020` |
| nav items | Inter Medium 14px `#8A8F99` |
| active item | `#F0F0EE` + 1px `#E8A020` bottom border |
| live dot | 6px circle `#E8A020`, opacity pulse 2s linear ∞ |
| counter | JetBrains Mono 12px |
| connect button | amber outline, 0px radius (see button-primary.investidor) |
| wallet address | JetBrains Mono 12px `#555B66` |

### 3.7 Layout

| Property | Value |
|----------|-------|
| grid | 12-column |
| gutter | 24px |
| margin | 32px |
| max-width | 1440px |
| base unit | 8px (all spacing is multiples of 8) |
| breakpoints | sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1440 |

---

## 4. Constraints

### Never

- Gradients as background fills on any surface in any front
- Drop shadows (`box-shadow`) on any UI element
- Rounded corners — `border-radius` must be `0px` on all elements: cards, buttons, inputs, badges, modals, tooltips, dropdowns
- Glass / `backdrop-filter: blur()` effects
- `#22C55E` ANSI green anywhere, especially in Terminal
- Amber-colored icons — amber is reserved for text, CTAs, and status markers only
- Photography inside Dashboard Investidor product UI
- Blockchain jargon in Dashboard Imobiliárias copy
- `text-shadow` effects (no phosphor glow, no text bloom)
- `scale()` or `translate` transforms on hover or active states
- `#000000` pure black as background color
- Glow orbs, ambient bloom, or decorative light effects
- ASCII art decorations
- Pill-shaped or rounded badges
- Inter font inside Terminal panes

### Always

- `border-radius: 0px` on every UI element, no exceptions
- `1px solid` borders — never 2px decorative, never dashed
- JetBrains Mono with `font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums;` on all numeric data
- Three-layer hierarchy present on every screen (Geist / Inter / JetBrains Mono)
- Amber occupying less than 5% of screen pixels on dark fronts
- Surface stacking for depth (canvas → surface-1 → surface-2 → surface-3)
- Success and error colors used semantically only, never decoratively
- `#1A1A1A` text on `#C47E10` amber fill in Imobiliárias (5.3:1 AA pass)
- Inter Semi-bold 600 minimum when `#2E8B5A` appears on light background
- Bold status labels ≥14px when `#C94040` appears on dark background
- Phosphor Icons at `weight="light"` only
- 1× cap-height clear space around logo on all sides
- 8px baseline grid for all spacing decisions

---

## 5. Effects

### Interaction vocabulary

| State | Surfaces | Buttons | Borders | Duration |
|-------|----------|---------|---------|----------|
| **hover** | bg shifts one level up (surface-1 → surface-2) | fill transitions in (Investidor) or deepens (Imob.) | shifts to accent or lighter | 150ms ease-out |
| **active** | — | opacity 0.85 | — | 80ms |
| **focus** | — | — | 1px amber border | immediate |
| **disabled** | opacity 0.4 | opacity 0.4, cursor: not-allowed | — | — |

### Transition properties

Only these properties may transition:
- `color`
- `background-color`
- `border-color`
- `opacity`

Transform properties (`scale`, `translate`, `rotate`) never transition on interaction.

### The pulse animation (only ambient animation)

```css
@keyframes mutav-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

.live-dot {
  width: 6px;
  height: 6px;
  background-color: #E8A020;
  border-radius: 0px; /* square, not circle — matches 0px system */
  animation: mutav-pulse 2s linear infinite;
}
```

> No `box-shadow` pulse. No `scale` animation. Opacity only.

---

## 6. Bold Bets

Five non-negotiable implementation techniques that define MUTAV's precision:

**1. Zero-radius enforcement on every element.**
`border-radius: 0` on cards, buttons, inputs, badges, modals, dropdowns, tooltips, select menus, checkboxes (custom), radio buttons (custom), and icon containers. The only exception: SVG glyph paths inside Phosphor icons (curves are fine on icon shapes). Tailwind v4: add `rounded-none` to every interactive element in shadcn base components. Override shadcn defaults globally.

**2. Amber as precious metal.**
Count amber pixels before shipping every screen. The live dot (6px × 56px nav = 336px²), logo (~200px²), one CTA button (~1200px²), one or two active badges (~36px²). At 1440×900 = 1,296,000px² total, amber should occupy under 65,000px². If amber appears on more than 5% of the screen, the layout has a problem — remove amber from wherever it crept in decoratively.

**3. Tabular numerals on every number, without exception.**
No number may appear without `font-feature-settings: "tnum" 1; font-variant-numeric: tabular-nums;`. This includes: balances, timestamps, contract IDs, hashes, percentages, counter badges, table cells, chart labels. Create a `<Mono>` component that enforces this and never render numeric data without it.

**4. Three-layer hierarchy enforcement at the screen level.**
Every route must have exactly one Geist Bold declaration (the heading/status), at least one Inter explanation, and at least one JetBrains Mono evidence element. If a screen design has no JetBrains Mono visible, it is missing the evidence layer — the protocol's proof. This is a design review checklist item, not a guideline.

**5. Surface stacking without shadows.**
When a modal, drawer, or popover opens, it must sit on a higher surface color — not cast a shadow. Modal background: `#1E2126` (surface-2) on top of page canvas `#0E0F11`. The color difference is the depth. If you feel the need to add a `box-shadow`, that is a signal the surface color step is missing or too subtle — fix the color, do not add a shadow.

---

## 7. Implementation

### CSS custom properties (semantic tokens)

```css
/* Investidor front */
[data-front="investidor"] {
  --color-canvas:     #0E0F11;
  --color-surface:    #16181C;
  --color-surface-2:  #1E2126;
  --color-surface-3:  #252830;
  --color-border:     #2A2D33;
  --color-text:       #F0F0EE;
  --color-text-2:     #8A8F99;
  --color-text-3:     #555B66;
  --color-accent:     #E8A020;
  --color-accent-dim: #9E6A10;
  --color-success:    #3DAB72;
  --color-error:      #C94040;
}

/* Imobiliárias front */
[data-front="imobiliarias"] {
  --color-canvas:     #F7F6F3;
  --color-surface:    #FFFFFF;
  --color-surface-2:  #EEEDEA;
  --color-border:     #D9D7D2;
  --color-text:       #1A1A1A;
  --color-text-2:     #6B6860;
  --color-text-3:     #9E9C98;
  --color-accent:     #C47E10;
  --color-accent-dim: #FFF0D4;
  --color-success:    #2E8B5A;
  --color-error:      #B83232;
}

/* Terminal front */
[data-front="terminal"] {
  --color-canvas:     #0A0B0D;
  --color-surface:    #111316;
  --color-surface-2:  #181B1F;
  --color-border:     #2A2D33;
  --color-text:       #E8E4DC;
  --color-text-2:     #7A7870;
  --color-text-3:     #4A4844;
  --color-accent:     #E8A020;
  --color-accent-dim: #B87010;
  --color-success:    #3DAB72;
  --color-error:      #C94040;
}
```

### Tailwind v4 `@theme` block

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Fonts */
  --font-display: "Geist", sans-serif;
  --font-body:    "Inter Variable", sans-serif;
  --font-mono:    "JetBrains Mono Variable", monospace;

  /* Semantic colors (resolved by data-front attribute) */
  --color-canvas:     var(--color-canvas);
  --color-surface:    var(--color-surface);
  --color-surface-2:  var(--color-surface-2);
  --color-surface-3:  var(--color-surface-3);
  --color-border:     var(--color-border);
  --color-text:       var(--color-text);
  --color-text-2:     var(--color-text-2);
  --color-text-3:     var(--color-text-3);
  --color-accent:     var(--color-accent);
  --color-accent-dim: var(--color-accent-dim);
  --color-success:    var(--color-success);
  --color-error:      var(--color-error);

  /* Border radius — always 0 */
  --radius: 0px;

  /* Spacing scale (8px base) */
  --spacing-1: 8px;
  --spacing-2: 16px;
  --spacing-3: 24px;
  --spacing-4: 32px;
  --spacing-5: 40px;
  --spacing-6: 48px;
  --spacing-8: 64px;
  --spacing-10: 80px;
  --spacing-12: 96px;
}
```

### Font loading (Next.js)

```tsx
// app/layout.tsx
import { Geist } from "next/font/google"
import "@fontsource-variable/inter"
import "@fontsource-variable/jetbrains-mono"

const geist = Geist({
  weight: ["700"],   // Bold only — never load other weights
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})
```

### Texture recipes

```css
/* Investidor — architectural grid (apply to body/page canvas only) */
.texture-investidor {
  background-image:
    linear-gradient(to right,  rgba(240,240,238,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(240,240,238,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* Terminal — scanlines (apply to terminal canvas only) */
.texture-terminal {
  background-image:
    repeating-linear-gradient(
      to bottom,
      transparent 0px, transparent 2px,
      rgba(232,228,220,0.025) 2px, rgba(232,228,220,0.025) 3px
    );
  background-size: 100% 3px;
}

/* Imobiliárias — no texture */
```

### Tabular numerals (mandatory)

```css
/* Apply to every JetBrains Mono instance rendering numbers */
.mono-num {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
  font-variant-numeric: tabular-nums;
}
```

```tsx
// Recommended: create a constrained component
function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      style={{ fontFeatureSettings: '"tnum" 1' }}
    >
      {children}
    </span>
  )
}
```

### Phosphor Icons

```bash
npm install @phosphor-icons/react
```

```tsx
import { ArrowRight, CheckCircle } from "@phosphor-icons/react"

// Always weight="light". Never color amber directly.
<ArrowRight weight="light" size={20} />          // prominent
<CheckCircle weight="light" size={16} />         // standard
```

### shadcn/ui global overrides

Override these defaults in `components.json` and component source:

```tsx
// All shadcn components: remove rounded-* classes, replace with rounded-none
// Button: remove shadow classes
// Input: remove ring classes, override focus-visible:ring-0
// Badge: override rounded-full → rounded-none
// Card: remove shadow, set rounded-none
// Dialog/Sheet: set rounded-none
```
