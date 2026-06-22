# Imagery Style
**TGA — Token de Garantia de Aluguel**
Identity Phase · April 2026

---

## Governing Principle

TGA uses completely different imagery vocabularies on each front. The split is total and intentional. An image that belongs on Dashboard Imobiliárias would be an aesthetic failure on Dashboard Investidor, and vice versa. The shared design system (logo, typography, grid) creates the brand coherence; the imagery creates the emotional divergence that each persona requires.

The Terminal has no imagery. Data is the imagery.

---

## Front 1: Dashboard Investidor — No Photography

### Direction
This front does not use photography. The decision is not a budget constraint — it is a design argument. Ana evaluates protocols by their architecture, not their lifestyle. A photograph of a building on Dashboard Investidor would undermine the Precision Brutalism aesthetic and signal "consumer product," which is precisely the register TGA must not occupy for her.

### What Appears Instead

**Data visualization as the primary visual element:**
The charts, graphs, and tables embedded in the dashboard interface are the "images" of this front. A NAV curve plotted over 90 days, showing disbursement events as vertical markers, is more visually compelling to Ana than any stock photograph could be. These are functional images — they carry data — and they are the design expression of the brand value "Verificabilidade Como Padrão."

Visual treatment for charts: stroke-based, amber (`#E8A020`) for the primary data line, `#8A8F99` for axis labels and grid lines, `#3DAB72` for confirmed disbursement markers, `#C94040` for default event markers. No fills. No gradients. The line is the argument.

**Onchain artifacts as visual anchors:**
In contexts where a large visual element is needed (a protocol landing page section, an investor documentation header), the approved imagery is an actual high-contrast render of a Solana transaction viewer or program account explorer. Treatment: desaturated to near-monochrome, with amber tonal overlay at 20–30% opacity. Cropped tight to the relevant data field.

**Abstract architectural photography (marketing surfaces only):**
Never in dashboard product UI. Only on the marketing/landing page. Subject: exposed structural elements — concrete formwork, rebar grid, steel framing. Treatment: desaturated to near-monochrome, high contrast, cropped to the structural pattern.

### What Is Never Used — Dashboard Investidor
- People. No portraits, no hands, no lifestyle.
- Real estate interiors or exteriors with any recognizable context.
- Illustrations of any kind.
- Blockchain iconography (nodes, chains, hexagons, circuit boards).
- Charts with fills, gradients, or color beyond the defined semantic palette.
- Any image that could appear in a consumer financial app.

---

## Front 2: Dashboard Imobiliárias — Photography as Warmth

### Direction
Photography is the primary warmth delivery mechanism on this front. Lucas's trust threshold is partially constructed through imagery that is familiar, specific, and human — not like it was selected from a stock library by someone who has never been to Brazil.

### Photography Vocabulary

**Real Brazilian apartments in use:** Not staged interiors — occupied apartments with signs of lived-in life. Morning light through open curtains. A book on a side table. The subject is the apartment, but the feeling is that a real tenant lives here. Lucas should recognize the fixtures, tile patterns, and window proportions of middle-class Brazilian apartments (São Paulo, Curitiba, Porto Alegre, Belo Horizonte, Florianópolis).

Photography treatment: natural color grading — warm, not cool. Slight overexposure in highlights. High clarity without over-sharpening. No filters that reduce information.

**Hands and documents:** A landlord reviewing a contract. A property manager pointing at a blurred screen. Partial faces — profile, jawline, not full-face portrait. Cast: Brazilian, 35–60 age range, middle-class professional settings.

**Narrative state imagery:** Resolved, calm, ordinary. A landlord at a desk with a coffee, not with a phone to his ear. The absence of anxiety is the image.

### Illustration — Dashboard Imobiliárias Only
Used only for: empty states and educational explainer sequences. Style: line illustration, warm tone, minimal. One or two colors (warm white background + muted amber-brown stroke). Never for marketing hero images or feature promotion.

---

## Iconography — All Fronts

### Library
**`@phosphor-icons/react`** — 6 weights (Thin → Fill), 1500+ icons, MIT license.

```bash
npm install @phosphor-icons/react
```

```tsx
import { ArrowRight, ChevronDown, CheckCircle } from "@phosphor-icons/react"

// Standard usage — always "light" weight (≈1.5px stroke at 20px)
<ArrowRight weight="light" size={20} />

// Inline text-adjacent (12px)
<CheckCircle weight="light" size={12} />
```

**Weight:** `"light"` only. Thin is too fine at 16px; regular reads as too heavy against the Precision Brutalism aesthetic. Light at 16–20px renders at approximately 1.5px stroke. **No fill, no bold, no duotone.**

### Size System

| Size | Context |
|---|---|
| 12px | Inline text-adjacent (status badges, data table annotations) |
| 16px | Standard UI: navigation, list items, form fields |
| 20px | Prominent navigation contexts, feature list icons |
| 24px | Empty state icons (Imobiliárias only), header actions |

**Container treatment:** Bare only. No circles, no rounded squares, no background tints. Icons sit in space without containers.

**Color:** Icons inherit the foreground color of their context. Never amber. Active state: Foreground Primary. Inactive/disabled: Foreground Secondary.

**Corner radius adaptation:** Phosphor's source uses slight rounding on some icons. Do not modify SVG paths — the difference at 16–20px is imperceptible. 0px radius applies to containers and cards, not to icon glyph paths.

---

## Textures & Patterns

### Dashboard Investidor — Architectural Grid

**Concept:** Fine grid lines reference the blueprint DNA of the logo's structural mark (Direction 2). Applied at extreme subtlety — the texture reads as depth, not decoration.

```css
/* Architectural grid overlay — apply to .canvas, .surface-1 layers */
.texture-grid {
  background-image:
    linear-gradient(to right, rgba(240, 240, 238, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(240, 240, 238, 0.03) 1px, transparent 1px);
  background-size: 24px 24px; /* aligns to 4px grid × 6 units */
}
```

**Usage:** Optional — apply to the obsidian canvas only when sections need structural visual interest without content. Never on Surface 1 or higher elevation layers. Opacity: 3% maximum.

### Terminal — Scanlines

**Concept:** Authenticates the operator-layer aesthetic. Functional, not decorative — reduces perceived screen flicker in dense data contexts.

```css
/* Scanline overlay — apply as ::after on .terminal-canvas */
.texture-scanlines::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 2px,
    rgba(232, 228, 220, 0.025) 2px,
    rgba(232, 228, 220, 0.025) 3px
  );
  pointer-events: none;
  z-index: 0;
}
```

**Opacity:** 2.5% — invisible at a glance, present on close inspection. Higher opacity reads as broken display; lower is imperceptible.

### Dashboard Imobiliárias — No Texture

Warm canvas (`#F7F6F3`) is clean. Texture would interrupt the Caregiver's warmth register. No patterns, no grain, no grid.

### Gradients — All Fronts: Forbidden

No gradients on any surface in any front. Depth through tonal surface stacking only. The only permitted gradient is a scrim overlay on photography (see Image Treatments below).

---

## Image Treatments

### Onchain Artifact Photography (Investidor / Marketing)

```css
.img-onchain {
  filter: grayscale(0.90) contrast(1.15) brightness(0.95);
  position: relative;
}

/* Amber tonal overlay */
.img-onchain-wrapper {
  position: relative;
  isolation: isolate;
}
.img-onchain-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: #E8A020;
  opacity: 0.22;
  mix-blend-mode: multiply;
  pointer-events: none;
}
```

### Architectural Photography (Investidor / Marketing)

```css
.img-architectural {
  filter: grayscale(0.80) contrast(1.20) brightness(0.90);
}
```

### Warm Photography (Imobiliárias)

```css
.img-property {
  /* Slight warmth push: preserve saturation, lift highlights */
  filter: brightness(1.05) saturate(0.92) sepia(0.06);
}
```

### Aspect Ratios

| Context | Ratio | Tailwind |
|---|---|---|
| Hero — Investidor marketing | 21:9 | `aspect-[21/9]` |
| Hero — Imobiliárias | 16:9 | `aspect-video` |
| Property card | 4:3 | `aspect-[4/3]` |
| Document / thumbnail | 1:1 | `aspect-square` |
| Onchain artifact crop | 3:1 | `aspect-[3/1]` |

All: `object-fit: cover`, `object-position: center`.

### Loading Strategy

**Dashboard Imobiliárias:** Blur-up LQIP (Low Quality Image Placeholder). Generate a 20px-wide blurred preview. Next.js `Image` component handles natively.

```tsx
<Image
  src="/properties/sp-pinheiros.jpg"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,{LQIP}"
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
  className="object-cover"
  alt="Apartamento em Pinheiros, São Paulo"
/>
```

Skeleton fallback color: `#EEEDEA` (Surface 2 / warm grey) — never pure white or pure grey.

**Dashboard Investidor:** No external images in product UI. Data visualizations render client-side. Skeleton for chart loading area: `#16181C` (Surface 1) — matches the card background, making the load state invisible.

---

## Anti-Patterns

- **Stock photography people:** Forced diversity poses, models in suits shaking hands, headsets. If a person is in the frame, they must be Brazilian and specific.
- **Blockchain iconography:** Hexagons, nodes, chains, circuit boards, lock icons on wallets. The protocol does not need to illustrate itself.
- **Bright ANSI green in any context:** Not in charts, not in status indicators on the landing page, not as illustration accents.
- **Gradient fills on charts:** Any area fill under a data line. The line is the argument.
- **Rounded photography masks:** All image containers are 0px radius. An image inside a `rounded-2xl` container is an identity violation.
- **Ambient lifestyle photography on Investidor:** Coffee, laptops, city views from penthouses. Ana is not buying a lifestyle; she is evaluating a protocol.
- **Bold or fill-weight icons:** Never. The filled variant reads as consumer-app.
- **Amber icons:** The accent color is for text, CTAs, and status indicators — not iconography. Icon in amber = attention signal that a state has changed, not a design choice.

---

## Related
- [color-system.md](./color-system.md)
- [typography.md](./typography.md)
- [brand-applications.md](./brand-applications.md)
