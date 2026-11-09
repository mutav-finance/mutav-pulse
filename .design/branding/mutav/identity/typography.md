# Typography
**MUTAV · Garantia locatícia**
Updated 2026-11-08 to match the brand kit v1.0 (`kit/MUTAV-brand-kit.html`, built from `kit-src/brand.json`) and the live site since mutav PR #250. This replaces the April 2026 system of Geist Bold, Inter and JetBrains Mono. That version is in git history.

---

## Governing Principle

Three faces, three jobs. None are interchangeable.

- **Outfit 800** is the logo. Nothing else.
- **DM Sans** carries every headline and every paragraph.
- **JetBrains Mono** carries labels, figures and data.

The contrast still makes the argument. When DM Sans says "Pagamento realizado" and JetBrains Mono says "R$ 2.847,00 · 18h22", the name of the event is human and the numbers are exact.

---

## Typeface System

### Logo: Outfit 800
**Weight:** ExtraBold (800) only.

**Use:** The "MUTAV" wordmark inside the logo files. In the files it is outlined to vector paths, so the logo needs no font installed.

**Never:** Running text, headlines, buttons or labels. Don't set other text in it. Never retype the logo: use the files in `kit/logo/`.

---

### Headlines and body: DM Sans
**Weights:** Regular (400), Medium (500), Bold (700).

**Use:**
- Headlines in **700**.
- Body in **400**.
- Emphasis in **500**.

**Tracking:** Tight on headlines, 0 on body (see the scale below).
**Case:** Sentence case.

---

### Labels, figures and data: JetBrains Mono
**Weights:** Regular (400), Medium (500).
**Tabular numerals: mandatory.** `font-feature-settings: "tnum" 1`

**Use:** Labels, money, percentages, timestamps, contract IDs, transaction hashes, program addresses.

**Labels:** Caps, tracking **+0.08em**, 11–12px.

**Never:** Larger than the body text in the same context. Data supports the story; it doesn't lead it.

---

### Fallbacks
Where the brand fonts can't load (email, Google Docs, slides):
- DM Sans → **Arial** or **Helvetica**.
- JetBrains Mono → **Courier New**.
- The logo is always an image.

---

## Type Scale

From `kit-src/brand.json` → `type.scale`. Sizes are a range from mobile to desktop.

| Role | Face | Size (px) | Line height | Tracking |
|---|---|---|---|---|
| Display | DM Sans 700 | 48–72 | 1.04 | −0.03em |
| H2 | DM Sans 700 | 30–48 | 1.08 | −0.025em |
| H3 | DM Sans 700 | 20–22 | 1.2 | −0.01em |
| Body | DM Sans 400 | 16–18 | 1.55 | 0 |
| Label | JetBrains Mono 500, caps | 11–12 | — | +0.08em |

**Fluid sizes:** set each range with `clamp()` and rem bounds, so 200% browser zoom scales both ends (WCAG 1.4.4).

---

## Scale by Front

Every front uses the same scale and the same three faces. Fronts differ in density, not in type.

- **Dashboard Investidor:** Display for the hero, H2 for sections, mono for every value.
- **Dashboard Imobiliárias:** Body at 18px. More DM Sans, less mono. Lucas should read numbers clearly, not feel he's in a trading terminal.
- **Terminal:** JetBrains Mono for everything in the panes. Hierarchy comes from colour, not size. Line height 1.7 for long scanning sessions.

---

## Three-Layer Hierarchy Rule

Every screen in every front should have all three layers:

1. **Declaration layer** (DM Sans 700): what happened, the status, the most important number.
2. **Explanation layer** (DM Sans 400): why it matters, what to do.
3. **Evidence layer** (JetBrains Mono): the exact proof. The timestamp. The hash.

A screen with only explanation feels unanchored. A screen with only data is unreadable.

---

## CSS Custom Properties

The published tokens are in `kit/tokens/tokens.css`. Import them; don't retype them.

```css
:root {
  --mutav-font-logo: "Outfit", sans-serif;          /* 800, logo artwork only */
  --mutav-font-sans: "DM Sans", Arial, Helvetica, sans-serif;
  --mutav-font-mono: "JetBrains Mono", "Courier New", monospace;
}

body {
  font: 400 1rem/1.55 var(--mutav-font-sans);
}
h1, h2, h3 {
  font-family: var(--mutav-font-sans);
  font-weight: 700;
  text-wrap: balance;
}
p {
  text-wrap: pretty;
}

/* Labels */
.label {
  font: 500 0.75rem var(--mutav-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Tabular numerals for all mono data */
.data, .mono, [data-mono] {
  font-family: var(--mutav-font-mono);
  font-feature-settings: "tnum" 1;
  font-variant-numeric: tabular-nums;
}
```

---

## Font Loading Strategy

The font files ship in `kit/fonts/`, each with its SIL Open Font License: `DMSans.ttf`, `JetBrainsMono-latin.woff2` and `Outfit.ttf`.

- Load **DM Sans** (400, 500, 700) and **JetBrains Mono** (400, 500). Self-host them; no CDN.
- Don't load **Outfit** on a page. The logo is an outlined SVG.
- Preload DM Sans only. It is the above-the-fold text on every front.

### Next.js

```tsx
// app/layout.tsx
import { DM_Sans, JetBrains_Mono } from "next/font/google";

const sans = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--mutav-font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--mutav-font-mono",
  display: "swap",
});
```

`next/font` self-hosts the files at build time.

---

## Vertical Rhythm

Base unit: **4px** · Body line-height: **1.55**

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
