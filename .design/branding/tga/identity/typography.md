# Typography
**TGA — Token de Garantia de Aluguel**
Identity Phase · April 2026

---

## Governing Principle

TGA uses a three-typeface system. Each typeface has a specific semantic role — none are interchangeable. The system achieves its coherence through discipline: Geist Bold for authority, Inter for clarity, JetBrains Mono for data truth. The three typefaces appear together in the same interface, each in its lane.

The typography is not decorative. It is the visual argument. When Geist Bold says "Pagamento realizado" and JetBrains Mono says "R$2.847,00 · 18h22 · 4h37m desde notificação", the typographic contrast itself communicates: the name of the event is human; the numbers are machine-verified.

---

## Typeface System

### Primary: Geist Bold
**Classification:** Geometric sans-serif · Vercel (2023)
**Weights loaded:** Bold (700) only. No other weights.

**Rationale:** Geist was built for developer-facing interfaces — it carries technical DNA without reading as monospace. Its geometry is precise; its Bold weight is substantial; its shapes have a cleanness that aligns with Precision Brutalism. Critically: Geist does not have the consumer-brand softness of Inter at display sizes. It reads as infrastructure when set large and bold. The choice also carries a soft signal to Ana: Vercel, the company that built Geist, is infrastructure for developers.

**Use:** Logo wordmark · Dashboard heroes · Section titles · Status declarations · NAV display values

**Tracking:** -3% to -4% (Investidor display) / -1% to -2% (Imobiliárias display)
**Leading:** Tight — 1.05 to 1.20 depending on size and front
**Case:** Sentence case. ALL CAPS only for data labels (NAV, TGA, APY — abbreviations, not decoration)

---

### Secondary: Inter
**Classification:** Humanist sans-serif · Rasmus Andersson (2017)
**Weights loaded:** Regular (400), Medium (500), Semi-bold (600)

**Rationale:** Inter is the connective tissue of the system. Where Geist declares, Inter explains. Purpose-built for screen legibility at small sizes — wide apertures, tall x-height, optimized for UI density. Inter carries the Caregiver's half of the brand: human, approachable, patient. It rewards attention without demanding it.

**Use:** All body copy · UI labels · Navigation · Tooltips · Onboarding · Dashboard Imobiliárias primary text
**Never in:** Terminal panes (JetBrains Mono only there)

**Tracking:** 0em body / +0.01em small labels under 12px
**Leading:** 1.5 body (Investidor) / 1.6 body (Imobiliárias) / 1.4 UI labels

---

### Data/Mono: JetBrains Mono
**Classification:** Monospace with coding ligatures · JetBrains (2020)
**Weights loaded:** Regular (400), Medium (500)
**Tabular numerals: mandatory** — `font-feature-settings: "tnum" 1`

**Rationale:** JetBrains Mono is the truth-teller of the system. Everything that must be machine-precise lives here: money, time, contract IDs, transaction hashes, program addresses, percentages. Its monospace nature ensures tabular alignment — financial columns align vertically at the glyph level, without CSS tricks. Ana recognizes it as the font of serious tooling. For Lucas, it reads as "precise number printed by a machine" — the trust signal a monetary value requires.

**Use:** All monetary values · All percentages · All timestamps · All transaction hashes · All contract IDs · All program addresses · Terminal panes (entire content)
**Never:** Larger than the body text size in the same context. Data is subordinate to narrative.

**Ligatures:** Disabled in Dashboard Investidor and Imobiliárias. Permitted in Terminal where functionally meaningful (`->`, `=>` in log output).

**Tracking:** +0.01em data values / +0.06em ALL CAPS status labels
**Leading:** 1.4 data tables / 1.7 Terminal panes (dense data, extended sessions)

---

## Type Scale

**Base:** 16px / 1rem · **Scale ratio:** Major Third (1.250) for display, flat increments for data/small
**Grid unit:** 4px — all line heights snap to 4px multiples
**Fluid:** viewport range 375px → 1440px

| Token | px | rem | Line Height | Letter Spacing | Weight | Role |
|---|---|---|---|---|---|---|
| `text-2xs` | 11px | 0.6875rem | 1.455 (16px) | +0.03em | 400 | Captions, fine print, timestamps (Terminal dim) |
| `text-xs` | 12px | 0.75rem | 1.5 (18px) | +0.01em | 400/500 | Data labels floor, mono secondary |
| `text-sm` | 13px | 0.8125rem | 1.538 (20px) | +0.01em | 400/500 | JetBrains Mono data values, terminal primary |
| `text-base-sm` | 14px | 0.875rem | 1.429 (20px) | 0em | 400/500 | UI labels, navigation, secondary body |
| `text-base` | 16px | 1rem | 1.5 (24px) | 0em | 400 | Body text (Investidor), Inter primary |
| `text-lg` | 18px | 1.125rem | 1.556 (28px) | 0em | 400 | Body text (Imobiliárias), large UI labels |
| `text-xl` | 20px | 1.25rem | 1.4 (28px) | 0em | 500/700 | Card titles, small section labels |
| `text-2xl` | 24px | 1.5rem | 1.333 (32px) | -0.01em | 700 | Section titles (small), card section headers |
| `text-3xl` | 28px | 1.75rem | 1.143 (32px) | -0.01em | 700 | Section titles (Imobiliárias) |
| `text-4xl` | 36px | 2.25rem | 1.111 (40px) | -0.02em | 700 | Section titles (Investidor), large callouts |
| `text-5xl` | 48px | 3rem | 1.083 (52px) | -0.02em | 700 | Hero headline (Imobiliárias) |
| `text-6xl` | 64px | 4rem | 1.0625 (68px) | -0.03em | 700 | Hero headline (Investidor) |

---

## Fluid Type Clamp Values

Fluid range: 375px (mobile) → 1440px (desktop). Formula: `clamp(min, intercept + slope*100vw, max)`

| Token | Mobile | Desktop | Clamp |
|---|---|---|---|
| `text-base` | 14px | 16px | `clamp(0.875rem, 0.756rem + 0.188vw, 1rem)` |
| `text-lg` | 16px | 18px | `clamp(1rem, 0.882rem + 0.188vw, 1.125rem)` |
| `text-xl` | 18px | 20px | `clamp(1.125rem, 1.007rem + 0.188vw, 1.25rem)` |
| `text-2xl` | 20px | 24px | `clamp(1.25rem, 0.987rem + 0.376vw, 1.5rem)` |
| `text-3xl` | 24px | 28px | `clamp(1.5rem, 1.263rem + 0.376vw, 1.75rem)` |
| `text-4xl` | 28px | 36px | `clamp(1.75rem, 1.278rem + 0.751vw, 2.25rem)` |
| `text-5xl` | 36px | 48px | `clamp(2.25rem, 1.544rem + 1.127vw, 3rem)` |
| `text-6xl` | 48px | 64px | `clamp(3rem, 2.056rem + 1.502vw, 4rem)` |

**WCAG 1.4.4 compliance:** All clamp values have rem-based min and max — browser zoom at 200% correctly scales both bounds.

---

## Scale by Front

### Dashboard Investidor
Tight scale, large ceiling. Read on monitors at analysis distance.

| Level | Token | Font | Size | Tracking | Leading |
|---|---|---|---|---|---|
| Hero | `text-6xl` | Geist Bold | 64px fluid | -0.03em (-1.92px) | 1.0625 (68px) |
| Section title | `text-4xl` | Geist Bold | 36px fluid | -0.02em | 1.111 (40px) |
| Card title | `text-3xl` | Geist Bold | 28px fluid | -0.01em | 1.143 (32px) |
| Label | `text-base` | Inter Medium | 16px fluid | 0em | 1.5 (24px) |
| Body | `text-base` | Inter Regular | 16px | 0em | 1.5 (24px) |
| Data value | `text-sm` | JetBrains Mono Medium | 13px | +0.01em | 1.538 (20px) |
| Data label | `text-xs` | JetBrains Mono Regular | 12px | +0.06em (ALL CAPS) | 1.5 (18px) |
| Micro | `text-2xs` | JetBrains Mono Regular | 11px | +0.03em | 1.455 (16px) |

### Dashboard Imobiliárias
Moderate scale, smaller ceiling. Lucas reads on a laptop browser.

| Level | Token | Font | Size | Tracking | Leading |
|---|---|---|---|---|---|
| Hero | `text-5xl` | Geist Bold | 48px fluid | -0.02em | 1.083 (52px) |
| Section title | `text-3xl` | Geist Bold | 28px fluid | -0.01em | 1.143 (32px) |
| Card title | `text-xl` | Geist Bold | 20px fluid | 0em | 1.4 (28px) |
| Body | `text-lg` | Inter Regular | 18px fluid | 0em | 1.556 (28px) |
| UI label | `text-base-sm` | Inter Medium | 14px | 0em | 1.429 (20px) |
| Data value | `text-sm` | JetBrains Mono Medium | 13px | +0.01em | 1.538 (20px) |
| Data label | `text-xs` | Inter Medium | 12px | +0.01em | 1.5 (18px) |

**Note:** Imobiliárias uses more Inter and less Mono. Data legibility principle is the same; visual density is lower. Lucas should see numbers clearly, not feel like he's reading a trading terminal.

### Terminal
Dense scale, small range. Hierarchy through foreground color, not size.

| Level | Token | Font | Size | Tracking | Leading |
|---|---|---|---|---|---|
| Pane header | — | Geist Bold | 14px | -0.01em | 1.429 (20px) |
| Section label | — | Geist Bold | 12px | +0.06em (ALL CAPS) | 1.5 (18px) |
| Data primary | `text-sm` | JetBrains Mono Regular | 13px | +0.01em | 1.692 (22px) |
| Data secondary | `text-xs` | JetBrains Mono Regular | 12px | +0.01em | 1.667 (20px) |
| Data dim | `text-2xs` | JetBrains Mono Regular | 11px | 0em | 1.636 (18px) |

**Terminal line height note:** 1.7× line height is higher than typical monospace because operators scan vertical log feeds for hours. The extra air reduces eye strain in extended sessions.

---

## Three-Layer Hierarchy Rule

Every screen in every front should have all three layers present:

1. **Declaration layer** (Geist Bold) — What happened. What is the status. The most important number.
2. **Explanation layer** (Inter) — Why it matters. What to do. The context.
3. **Evidence layer** (JetBrains Mono) — The machine-verified proof. The timestamp. The hash.

When a screen has only Inter (explanation without declaration), it feels unanchored.
When a screen has only JetBrains Mono (data without declaration), it is unreadable.
The three-layer system is the visual argument of the brand platform: declaration, explanation, evidence.

---

## CSS Custom Properties (Tailwind v4 / CSS)

```css
@theme {
  /* Typefaces */
  --font-display: "Geist", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  /* Scale */
  --text-2xs: 0.6875rem;
  --text-2xs--line-height: 1rem;
  --text-2xs--letter-spacing: 0.03em;

  --text-xs: 0.75rem;
  --text-xs--line-height: 1.125rem;
  --text-xs--letter-spacing: 0.01em;

  --text-sm: 0.8125rem;
  --text-sm--line-height: 1.25rem;
  --text-sm--letter-spacing: 0.01em;

  --text-base-sm: 0.875rem;
  --text-base-sm--line-height: 1.25rem;
  --text-base-sm--letter-spacing: 0em;

  --text-base: 1rem;
  --text-base--line-height: 1.5rem;
  --text-base--letter-spacing: 0em;

  --text-lg: 1.125rem;
  --text-lg--line-height: 1.75rem;
  --text-lg--letter-spacing: 0em;

  --text-xl: 1.25rem;
  --text-xl--line-height: 1.75rem;
  --text-xl--letter-spacing: 0em;

  --text-2xl: 1.5rem;
  --text-2xl--line-height: 2rem;
  --text-2xl--letter-spacing: -0.01em;

  --text-3xl: 1.75rem;
  --text-3xl--line-height: 2rem;
  --text-3xl--letter-spacing: -0.01em;

  --text-4xl: 2.25rem;
  --text-4xl--line-height: 2.5rem;
  --text-4xl--letter-spacing: -0.02em;

  --text-5xl: clamp(2.25rem, 1.544rem + 1.127vw, 3rem);
  --text-5xl--line-height: 1.083;
  --text-5xl--letter-spacing: -0.02em;

  --text-6xl: clamp(3rem, 2.056rem + 1.502vw, 4rem);
  --text-6xl--line-height: 1.0625;
  --text-6xl--letter-spacing: -0.03em;

  /* Tabular numerals utility */
  --font-numeric: "tnum";
}

/* Tabular numeral enforcement for all mono data */
.data, .mono, [data-mono] {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
  font-variant-numeric: tabular-nums;
}

/* text-wrap for headings */
h1, h2, h3, h4 {
  text-wrap: balance;
}
p {
  text-wrap: pretty;
}
```

---

## Font Loading Strategy

### Next.js (recommended — Solana dApp stack)

```tsx
// app/layout.tsx
import { Geist } from "next/font/google";
import localFont from "next/font/local";

const geist = Geist({
  weight: ["700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Inter via fontsource (self-hosted)
// npm install @fontsource-variable/inter
import "@fontsource-variable/inter";

// JetBrains Mono via fontsource
// npm install @fontsource-variable/jetbrains-mono
import "@fontsource-variable/jetbrains-mono";
```

### Fallback Stack

```css
--font-display: "Geist", "Inter", system-ui, -apple-system, sans-serif;
--font-body: "Inter", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;
```

### Performance Budget

| Font | Weight | Estimated WOFF2 |
|---|---|---|
| Geist Bold (700 only) | 1 weight | ~25KB |
| Inter Variable | wght axis, latin subset | ~95KB |
| JetBrains Mono Variable | wght axis, latin subset | ~65KB |
| **Total** | | **~185KB** |

**Optimization:** Load only Bold (700) for Geist — no other weights used. Use variable font axes for Inter and JetBrains Mono to avoid multiple static weight files.

**Preload:** Preload Inter variable font only (used above-fold body text on both fronts). Geist and JetBrains Mono load normally — they appear at display sizes (Geist) or below-fold data tables (JetBrains Mono).

```html
<link rel="preload" href="/fonts/inter-variable.woff2"
  as="font" type="font/woff2" crossorigin>
```

---

## Vertical Rhythm

Base unit: **4px** · Body line-height: **24px (6 × 4px)**

All component spacing derives from this rhythm:
- `space-1`: 4px (0.25rem)
- `space-2`: 8px (0.5rem) — icon-to-label gap, inline spacing
- `space-3`: 12px (0.75rem) — tight component padding
- `space-4`: 16px (1rem) — card padding (compact), list item gap
- `space-6`: 24px (1.5rem) — card padding (default), section element gap
- `space-8`: 32px (2rem) — between cards
- `space-12`: 48px (3rem) — section padding (Terminal, Investidor dense)
- `space-16`: 64px (4rem) — section padding (Investidor standard)
- `space-24`: 96px (6rem) — section padding (Imobiliárias, generous breathing room)

---

## Related
- [color-system.md](./color-system.md)
- [logo-directions.md](./logo-directions.md)
- [imagery-style.md](./imagery-style.md)
