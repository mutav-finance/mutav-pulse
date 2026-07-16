# Mood Board Direction
**MUTAV — Token de Garantia de Aluguel**
Discover Phase · April 2026

---

## Foundational Principle

MUTAV requires two distinct visual fronts anchored by a single shared design system. The shared system provides structural coherence (logo, type scale, grid logic, border treatment); the fronts diverge in color accent, imagery vocabulary, and tonal density. Neither front should be recognizable as the other's sibling at first glance — but both should be recognizable as MUTAV upon closer inspection.

The naming convention for the two fronts:
- **Dashboard Investidor** — the investidor front (Ana). Dark, precise, architectural.
- **Dashboard Imobiliárias** — the imobiliária front (Lucas). Light/neutral base, warm, clear.

---

## Front 1: Dashboard Investidor (Investidor / MUTAV)

### Core Aesthetic Direction
Precision Brutalism. Bloomberg Terminal meets decentralized protocol. This front signals: serious capital infrastructure. It has no soft edges, no decorative elements, no lifestyle photography. Every pixel is either carrying data or creating space for data.

The reference: "A financial instrument's offering memorandum designed for a protocol that replaces the back office of Brazilian real estate guarantee."

### Color Palette

| Role | Hex | Usage |
|---|---|---|
| Background (Obsidian) | `#0E0F11` | Page canvas — only base |
| Surface 1 | `#16181C` | Card/module backgrounds |
| Surface 2 | `#1E2126` | Elevated states, modals, table headers |
| Surface 3 | `#252830` | Hover states, secondary panels |
| Border | `#2A2D33` | Structural borders — used sparingly |
| Foreground Primary | `#F0F0EE` | Primary text — warm white, not pure |
| Foreground Secondary | `#8A8F99` | Secondary text, labels, captions |
| Foreground Tertiary | `#555B66` | Disabled, placeholders |
| Accent (Amber) | `#E8A020` | CTAs, logo, active states, live indicators — ONLY |
| Accent Dim | `#9E6A10` | Amber hover/secondary states |
| Success (Confirmed) | `#3DAB72` | Paid/confirmed status — never decorative |
| Error (Default) | `#C94040` | Default/non-payment alerts — never decorative |

**Rules:**
- No gradients. Depth through tonal shift only.
- No drop shadows. Elevation via Surface 1 → Surface 2 → Surface 3 stacking.
- Amber is used in fewer than 5% of any given screen's pixels. It must feel scarce.
- Pure black (`#000000`) is never used — Obsidian (`#0E0F11`) is the floor.

### Typography

**Display (Headlines, Hero, Section Titles)**
- Typeface: **Geist Bold** (Vercel)
- Tracking: -2% to -4% (tight negative; long headlines compress harder)
- Leading: 1.05–1.10 (tight)
- Case: Sentence case for narrative; ALL CAPS only for data labels and status indicators
- Size scale: 64px / 48px / 36px / 28px

**Body / UI**
- Typeface: **Inter** (Rasmus Andersson)
- Weight: Regular (400) for body; Medium (500) for UI labels and navigation
- Tracking: 0% to +0.5% for labels
- Line height: 1.5 for body, 1.3 for UI
- Size scale: 16px / 14px / 12px

**Data / Financials / Contract IDs**
- Typeface: **JetBrains Mono**
- Weight: Regular (400) for data; Medium (500) for highlighted values
- Tabular numerals: mandatory for all numeric data
- Size: Never larger than body size; usually 13px–14px
- Usage: ALL monetary values, ALL percentages, ALL timestamps, ALL transaction hashes

**Do not use:** any serif typeface on this front. No Garamond, Georgia, or editorial serifs. This front is terminal, not editorial.

### Imagery Style

No lifestyle photography. No people. No interiors.

Permitted imagery vocabulary:
- **Abstract architectural geometry**: Grid systems, structural frameworks, modular grids. Think exposed rebar, brutalist concrete facades — photographed without context, suggesting permanence and structure.
- **Data visualization**: Charts that are part of the UI, not decoration. NAV curves, disbursement frequency graphs, contract registry heat maps. These are the "images" of this front.
- **Macro textures (sparingly)**: Stone, matte metal, concrete — used at very low opacity as background texture only. Never illustrative.
- **Onchain artifacts**: Actual transaction viewer states, program account explorers (Solscan/Solana Explorer screenshots at high contrast). The blockchain itself as visual.

Photography treatment when used: desaturated to near-monochrome, with amber tonal overlay if needed. Cropped tight. No context beyond the subject.

### Motion and Interaction

- Transition speed: 0–80ms for state changes. No easing — linear only.
- No animated illustrations, no particle effects, no scrolling gradients.
- Number counters: live-updating numerals (NAV, contract count, total disbursed) are the only "animation" — and they serve data function, not decoration.
- Hover states: Surface shift (+1 tonal level). Border appears at `#2A2D33`. No scale transforms.

### Overall Feel

Walking into a server room that also happens to be a law firm's document vault. Absolute confidence through density. Every element is either doing work or out of the way.

The emotional register: "Ana opens this dashboard and immediately knows where the money is, how much it is earning, and what the protocol did last hour. She doesn't need to trust us. She can see everything."

---

## Front 2: Dashboard Imobiliárias (Imobiliária / Lucas)

### Core Aesthetic Direction
Structured Warmth. This front must feel like the most professionally trustworthy thing Lucas has ever seen in the Brazilian rental market — while being immediately legible, not technically intimidating. The reference: Airbnb's clarity and warmth of photography + the operational confidence of a well-designed insurance dashboard.

This front is NOT the investidor front in a lighter color. It has a different photographic vocabulary, a different typographic weight, and a different emotional posture. The shared elements (logo, type system, grid) anchor it as MUTAV; everything else is calibrated for Lucas's trust threshold.

### Color Palette

| Role | Hex | Usage |
|---|---|---|
| Background (Canvas) | `#F7F6F3` | Page canvas — warm off-white, not pure white |
| Surface 1 | `#FFFFFF` | Card/module backgrounds |
| Surface 2 | `#EEEDEA` | Grouped content, table backgrounds |
| Surface Active | `#FFF8EE` | Highlighted/active contract states (amber-tinted) |
| Border | `#D9D7D2` | Structural borders, dividers |
| Foreground Primary | `#1A1A1A` | Primary text |
| Foreground Secondary | `#6B6860` | Secondary text, labels, captions |
| Foreground Tertiary | `#9E9C98` | Placeholders, disabled |
| Accent (Amber) | `#C47E10` | CTAs, active contract status — same brand, adjusted for light mode |
| Accent Light | `#FFF0D4` | Amber tint for backgrounds — confirmation states |
| Trust (Paid/OK) | `#2E8B5A` | Pagamento confirmado — positive states |
| Alert (Default) | `#B83232` | Inadimplência detected — urgent, never decorative |
| Structural Line | `#1A1A1A` at 8% opacity | Hairline separators |

**Rules:**
- No dark backgrounds on this front. Lucas's mental model of "trustworthy" skews light and clear, not dark and dense.
- Amber appears only on CTAs and active contract states — same brand logic as the investidor front, different luminosity.
- Success green must always accompany any mention of payment confirmation. It is a reassurance signal, not a decoration.

### Typography

**Same typeface system as the investidor front (shared brand DNA):**

**Display (Headlines, Section Titles)**
- Typeface: **Geist Bold**
- Tracking: -1% to -2% (less compressed than investidor front)
- Leading: 1.15–1.20 (slightly looser — more air, less pressure)
- Case: Sentence case only — no ALL CAPS for primary text
- Size scale: 48px / 36px / 28px / 22px (smaller ceiling than investidor)

**Body / UI**
- Typeface: **Inter**
- Weight: Regular (400) for body; Medium (500) for UI; **Semi-bold (600) for key numbers** (days, amount, status)
- Tracking: 0 for body; +1% for helper text
- Line height: 1.6 for body (more breathing room than investidor), 1.4 for UI
- Size: 16px / 15px / 13px

**Data / Contract Status / Amounts**
- Typeface: **JetBrains Mono** — but used more sparingly than on the investidor front
- Mandatory for: monetary amounts, contract IDs, timestamps
- Optional for: status labels (may use Inter Medium in some contexts for warmth)
- Tabular numerals: mandatory

**Difference from Dashboard Investidor:** More Inter, less Mono. The data legibility principle is the same; the visual density is lower. Lucas should see numbers clearly, not feel like he is reading a trading terminal.

### Imagery Style

This front uses photography actively. The photography is the warmth delivery mechanism.

**Photography vocabulary:**
- **Real apartments in use**: Not staged interiors — actual Brazilian residential apartments, occupied, lived-in. Natural light. Morning light preferred (optimism signal). Not luxury; middle-class reality that Lucas recognizes.
- **Hands and documents**: A landlord reviewing a contract. A property manager at a desk. Warm, competent, human. Faces partially visible (not full face; suggests privacy, professionalism). No stock photo affect.
- **Cities Lucas knows**: São Paulo, Curitiba, Porto Alegre, Belo Horizonte. Specific neighborhoods. Not generic Brazil — the cities where his investment apartments are.
- **Before/after narrative states**: "Inquilino inadimplente → pagamento confirmado em 4 horas." The photography can support these narrative states with calm, resolved imagery — not dramatic.

**Photography treatment:** Natural color grading. Slightly warm (not cool). High clarity. Slight overexposure in highlights. No filters that reduce readability.

**What not to use:** No blockchain iconography on this front. No circuit boards, no hexagons, no nodes-and-edges network diagrams. Lucas does not need to see the mechanism — he needs to see the outcome.

### Motion and Interaction

- Transition speed: 150–200ms. Ease-in-out. Still quick, but with more perceivable resolution.
- Status changes (contract state transitions: active → default → paid) animate with a brief (200ms) color fill, reinforcing the event.
- No particle effects, no animations beyond functional state transitions.
- Scroll behavior: Standard. No parallax. No heavy scroll-jacking.

### Overall Feel

A very well-run imobiliária's back office, redesigned by someone who actually respects the landlord's time. Clear, organized, predictable. When Lucas opens his dashboard and sees "Pagamento realizado — R$2.847,00 — 18h22 de hoje," he feels nothing — in the best possible way. No anxiety. No surprise. Just the system working.

The emotional register: "Lucas knows his building is covered because the dashboard told him so, unprompted, three hours before he thought to check."

---

## Shared Brand Elements (System Layer)

These elements must be identical across both fronts:

**Logo treatment:**
- MUTAV wordmark in Geist Bold, amber (`#E8A020` on dark; `#C47E10` on light)
- No decorative logomark beyond the wordmark in primary usage
- "Sistema de Garantia Registrada" as descriptor in JetBrains Mono, tracked out +8%, secondary color

**Grid system:**
- 12-column grid; 24px gutter minimum
- Max content width: 1280px
- Left-aligned text only. Center alignment only for isolated numeric displays (NAV, big stat callouts).
- Right alignment for table data columns.

**Iconography:**
- Sharp, architectural. Stroke-based (1.5px), not filled.
- No rounded corners on icons — 0px radius throughout.
- Icons must carry functional meaning only. No decorative icon usage.
- Source: Custom or Phosphor Icons (thin weight) adapted to match 0px radius treatment.

**Border and spacing:**
- Borders: solid, 1px, at defined border color. Never dashed except for "pending" state indicators.
- Corner radius: 0px for containers, cards, buttons. Sharp edges only.
- Spacing scale: 4px base unit. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.

---

## Style Affinity — GSP Preset Recommendations

### Primary recommendation: `minimal-dark`

For the investidor front (Dashboard Investidor), `minimal-dark` is the closest match to the Precision Brutalism direction. It provides the structural base — dark canvas, high-contrast text hierarchy, restrained accent use — that the MUTAV protocol interface requires. The key customization: replace any soft radius treatments with 0px (sharp), and restrict accent to amber only (purge any blue or teal presets).

Rationale: Ana evaluates protocols by their UI density and legibility. `minimal-dark` signals infrastructure, not a consumer app. It is the aesthetic language she associates with protocols she trusts (Ondo, Maple, Dune). It does not trigger the "hackathon project" or "anonymous DeFi" signals.

### Secondary recommendation: `terminal`

For data-heavy sections of the investidor front — the contract registry, the disbursement log, the live NAV display — the `terminal` preset provides the exact JetBrains Mono-forward, data-dense aesthetic required. Applied as a section preset within the Dashboard Investidor, not as the full UI language.

`terminal` should never touch the imobiliária front. Lucas reading a terminal-style screen is the design failure mode to avoid.

### Tertiary recommendation (imobiliária front): `professional`

For Dashboard Imobiliárias (the imobiliária front), `professional` is the closest available preset. It provides the light-base, clear hierarchy, and structured data display that Lucas's trust threshold requires. The customization: warm the base slightly (off-white, not pure white), add amber as the sole accent, and replace any default blue CTAs.

`professional` prevents the imobiliária front from reading as either (a) generic fintech (which triggers association with CredPago/QuintoCred) or (b) a cold SaaS dashboard (which is alienating to Lucas's demographic). The `professional` preset sits in the right range: trustworthy, clear, functional — without being either exciting or intimidating.

### Why not other presets

- `web3`: Immediately signals "anonymous DeFi" — exactly what MUTAV must not be. Eliminates both Lucas and institutional Ana.
- `glassmorphism`: Decorative. Signals consumer lifestyle, not financial infrastructure. Incompatible with both fronts.
- `neubrutalism`: Appropriate for challenger consumer brands; too playful for capital management. The brand brief explicitly says "not a hackathon project."
- `cyberpunk`: Neon/gradient aesthetic. Dated in 2026 DeFi; alienating for Lucas entirely.
- `luxury`: Aspirational for the wrong reason — MUTAV's authority comes from mechanism reliability, not premium exclusivity. Luxury signals would feel like vaporware for Ana and pretension for Lucas.
- `swiss-minimalist`: Strong candidate for the imobiliária front but too cold for Lucas's warmth requirement. The `professional` preset offers the same grid discipline with more tolerance for warm color.
- `bold-typography`: Interesting for campaign contexts but not suitable as a system-level preset. Copy-forward design works for marketing; it doesn't scale to dashboard UI.
