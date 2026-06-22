# Logo Directions
**TGA — Token de Garantia de Aluguel**
Identity Phase · April 2026

---

## Governing Principle

The TGA logo is not a symbol. It is a signature. The brand does not need a mark because the mechanism speaks. A logomark (icon, emblem, glyph) would imply decoration — precisely what this protocol refuses. The wordmark IS the identity: three characters, zero ornamentation, maximum weight.

The amber color is not cosmetic. It is the single scarcity signal in an otherwise achromatic system. When amber appears, it is TGA. When TGA appears, it is amber.

---

## Direction 1 — WORDMARK PURE (Recommended Primary)

### Concept
"tga" set in Geist Bold, lowercase, letter-spaced at -3%, in amber. No descriptor in the primary lockup. No symbol. No container. The name is the argument.

The lowercase choice is deliberate and strategic: it signals protocol-layer thinking (npm, git, curl — operator tools are lowercase) while the weight of Geist Bold prevents it from reading as soft or informal. The tension between lowercase convention and heavy weight is exactly the tone: technically fluent, structurally authoritative.

### Strategic Rationale
The Ruler archetype communicates through architecture, not decoration. A pure wordmark in the heaviest weight of the system's primary typeface says: we are what it says on the label. There is no logomark because there is no gap between the name and the thing. "tga" IS the protocol. This also satisfies Responsabilidade Identificada — a wordmark requires the founders to stand behind the name, not behind an anonymous glyph.

For Ana: lowercase typeface-as-protocol-name reads as infrastructure, not a consumer product. She sees "tga" the way she reads "eth" or "sol" — a protocol denominator, not a brand.
For Lucas: Geist Bold in amber on white or dark is legible, confident, and premium without being cold.

### Mark Type
Wordmark (type-only)

### Construction Geometry

**Baseline grid:** The wordmark sits on an 8px baseline grid. All lockup compositions snap to this grid.

**Cap height reference:** Geist Bold at the primary display size (not a fixed size — proportions are invariant). The wordmark height is defined as the cap height of Geist Bold at the rendering size. All clear space and proportion rules derive from this cap height (H).

**Tracking:** -3% letter-spacing applied globally to all three characters. At the wordmark's design master size (72pt), this compresses "tga" to approximately 0.97× its natural advance width. This is not typesetting — it is the approved artwork. Do not re-set the type to achieve the tracking; always use the artwork file.

**Character proportions at master size (72pt Geist Bold):**
- "t" glyph width: approximately 38% of cap height
- "g" glyph width: approximately 54% of cap height
- "a" glyph width: approximately 52% of cap height
- Total wordmark width (with -3% tracking): approximately 1.35× cap height

**Optical weight balance:** Geist Bold's "g" carries the most visual mass. The "t" opens left. The "a" closes right. The three characters create a left-open, right-closed visual rhythm that reads as directional — forward-moving.

**With descriptor lockup:** "Sistema de Garantia Registrada" in JetBrains Mono Regular, tracked +8%, positioned below the wordmark. The descriptor's cap height = 38% of the wordmark's cap height. The gap between wordmark baseline and descriptor cap top = 50% of the descriptor's cap height. The descriptor aligns to the left edge of the wordmark's "t" glyph.

### Variations

**Primary (Dark background):**
"tga" in `#E8A020` on `#0E0F11` obsidian. Geist Bold, -3% tracking. No container, no padding, no symbol.

**Primary (Light background):**
"tga" in `#C47E10` on `#F7F6F3` warm white. Tracking identical. The amber darkens by ~30% to compensate for the lighter ground — perceived weight is matched to the dark variant.

**Secondary (With descriptor):**
Wordmark stacked above "Sistema de Garantia Registrada" in JetBrains Mono Regular +8%. Descriptor inherits the foreground secondary color of the context (`#8A8F99` dark / `#6B6860` light). Used on landing pages, onboarding, formal documents. Not in dashboards.

**Icon (Favicon / App Icon):**
The letter "t" alone, Geist Bold, amber (`#E8A020`), on an obsidian square (`#0E0F11`) with 0px radius. The "t" is centered optically — the glyph's visual center, not its mathematical center. At 16×16: 1px stroke render, amber character on obsidian ground. At 32×32: full glyph geometry. At 512×512: the restraint reads as intentional. The favicon is not a constructed mark — it is literally the first character of the wordmark, extracted.

**Monochrome (Single-color):**
"tga" in `#F0F0EE` warm white on dark surfaces, or `#1A1A1A` near-black on light surfaces. Amber is replaced ONLY when the medium physically cannot render color (single-color print, embossing, laser engraving, embroidery). Digital monochrome is never used. If the output can show amber, it shows amber.

**Reversed (On amber):**
"tga" in `#0E0F11` obsidian on `#E8A020` amber fill. Used only for special applications (badges, stamps, sealed certificates). The amber container has 0px radius. This is the only approved amber-background use of the wordmark.

### Clear Space
Minimum clear space = **1× cap height (H)** on all four sides of the wordmark, measured from the outermost extent of the glyphs. For the icon variant: **0.75× icon height** on all sides.

No element — image, text, border, UI component, or another brand mark — crosses this boundary.

When the descriptor is present, the clear space is measured from the outermost extent of the descriptor text, not the wordmark alone.

### Minimum Size
- **Full wordmark (primary):** 48px width on screen / 8mm in print
- **With descriptor:** 80px width on screen / 14mm in print — below this, drop the descriptor
- **Icon ("t" only):** 16px × 16px minimum — this is the favicon threshold

Below 48px (wordmark) or 16px (icon), no logo appears. Silence is preferable to an illegible mark.

### Don'ts
- **Do not** recreate the wordmark by manually setting type — always use approved artwork. Type settings will produce different inter-glyph spacing even at the specified tracking value.
- **Do not** stretch, compress, rotate, skew, or apply any geometric transformation.
- **Do not** apply any typographic effect: outline, inline, shadow, gradient fill, emboss, deboss, glow.
- **Do not** place the amber wordmark on any background other than the two approved canvas colors (`#0E0F11`, `#F7F6F3`), or pure white Surface 1 (`#FFFFFF`). No placement on photography, on colored surfaces, or on other brand colors.
- **Do not** place the wordmark on any amber-containing background (e.g., amber button fills, amber highlight surfaces). Exception: the reversed amber variant only.
- **Do not** use any other color for the wordmark except the three approved values: `#E8A020` (dark), `#C47E10` (light), or the monochrome variants.
- **Do not** add any decorative element — badge, burst, underline, rule, container — to this direction. Those belong to Direction 2.

---

## Direction 2 — WORDMARK + STRUCTURAL MARK (Formal / Institutional)

### Concept
"tga" wordmark paired with a single vertical rule (1px, amber) to the left of the text. The rule height equals the cap height of the wordmark — exactly. It functions as a registration marker: the kind of alignment notation found on architectural blueprints, engineering drawings, and survey documents. It implies: this text is anchored to something real. There is a line, and everything to the right of it is guaranteed.

### Strategic Rationale
The vertical rule introduces a second visual element without introducing a symbol. It reinforces the Ruler archetype through the language of architectural drafting — blueprints, technical drawings, legal documents. This is not decoration; it is structural annotation. The rule says: there is a line, and everything to the right of it is guaranteed.

This direction is specifically suited to formal contexts: investor materials, legal documentation, contract footers, official correspondence. It adds weight and ceremony without losing the Precision Brutalism grammar.

### Mark Type
Combination mark (rule + wordmark)

### Construction Geometry

**Rule weight:** 1px (screen) / 0.25pt (print). The rule is a hairline — its presence is architectural, not graphic.

**Rule height:** Precisely equal to the cap height (H) of the wordmark at the same rendering size. The rule's top edge aligns to the top of the wordmark's tallest ascender; the rule's bottom edge aligns to the baseline. No optical adjustment — the rule is a technical measurement, not a visual judgment.

**Gap between rule and wordmark:** 8px at standard dashboard size. Scales proportionally: gap = 0.15× cap height. The gap is consistent regardless of rendering size.

**Rule alignment:** The rule's left edge is the leftmost element of the lockup. The wordmark's "t" left edge is at gap distance from the rule's right edge. The entire lockup is left-aligned from the rule.

**Compact variant rule:** Rule height = 50% of cap height, vertically centered on the wordmark's midpoint. Used when horizontal space constrains the full lockup.

### Variations

**Primary (Dark):**
1px `#E8A020` rule + "tga" `#E8A020` wordmark at 8px gap. Full cap height rule.

**Primary (Light):**
1px `#C47E10` rule + "tga" `#C47E10` wordmark at 8px gap.

**Compact:**
50% height rule + wordmark. The rule centers vertically on the wordmark. Gap maintained at 8px. Used for confined horizontal spaces (email header, document footer).

**Icon (Rule-only):**
A 2px vertical amber stroke, 24px tall, centered optically. Used ONLY in navigation contexts where the full wordmark is already present elsewhere in the same view. The rule alone is never the sole brand identifier — it requires the wordmark in proximity.

**Monochrome:**
Rule in `#F0F0EE` (dark ground) or `#1A1A1A` (light ground). Proportions unchanged.

**Reversed:**
Rule in `#0E0F11` + wordmark in `#0E0F11` on `#E8A020` amber ground. Full amber fill, 0px radius container.

### Clear Space
Minimum clear space = **1× cap height (H)** on all four sides, measured from the rule's left edge and the wordmark's outermost right extent.

No other vertical rule, border, or line element may appear within 2× the gap distance (2 × 0.15H) of the structural rule.

### Minimum Size
- **Full lockup (rule + wordmark):** 56px total width on screen / 10mm in print
- **Compact lockup:** 48px total width on screen
- **Below 56px:** Drop the rule entirely. Revert to Direction 1.

The rule never renders below 1px. If the rendering engine rounds down to 0px, the lockup collapses to Direction 1.

### Don'ts
- **Do not** use the rule in any color other than amber (or monochrome equivalents).
- **Do not** repurpose the structural rule as a UI divider, section separator, or decorative element elsewhere in the interface. The rule's identity is the logo. Using it decoratively dilutes the logo.
- **Do not** apply this direction as the default product logo. It is a ceremonial direction for formal contexts.
- **Do not** combine Direction 2 and Direction 1 in the same interface or document. Choose a register.
- **Do not** vary the rule weight. A 2px rule is a different mark. A 0.5px rule disappears. 1px only.
- **Do not** increase the gap beyond the specified proportion — the rule and wordmark must read as a single unit, not as two separate elements.

---

## Direction 3 — TYPOGRAPHIC MONOGRAM (Reserve / Investor-Specific)

### Concept
"TGA" in ALL CAPS, Geist Bold, in amber, with deliberate and pronounced negative letter-spacing (-6%). The three characters become a single compressed visual unit — almost a glyph, but made entirely of letterforms. No marks added. The compression is so tight that at small sizes it reads as a single abstract form; at large sizes it resolves as the protocol name.

### Strategic Rationale
This direction serves the Dashboard Investidor and Terminal specifically. In data-dense interfaces where the logo appears as a small identifier (top navigation bar, data table header watermark, API response headers in the terminal), the compressed ALL CAPS monogram works as a near-glyph without ever being one. It is the logo behaving like a data label — which is exactly what the Precision Brutalism aesthetic demands.

The ALL CAPS treatment is not for general use. It is the operator and investor register — the same way NASDAQ, NAV, and APY are always capitalized in financial instruments. "TGA" all-caps signals a denomination; "tga" lowercase signals a protocol name. Both are the same brand; the register shifts by context.

### Mark Type
Lettermark (compressed wordmark)

### Construction Geometry

**Tracking:** -6% letter-spacing applied globally. At the design master size (72pt), the T-G-A characters overlap their natural advance widths by 6%, creating near-zero white space between characters. The characters do not actually overlap (no glyph intersection) — the negative tracking brings them to optical touching without collision.

**Character proportions at master size (72pt Geist Bold ALL CAPS):**
- "T" cap width: approximately 55% of cap height
- "G" cap width: approximately 58% of cap height
- "A" cap width: approximately 58% of cap height
- Total compressed width (at -6%): approximately 1.55× cap height

At -6% tracking, the three caps read as a single compressed block at sizes below 24px. At sizes above 48px, the individual characters are legible. This dual-reading behavior is the mark's primary feature.

**Data label application:** At 12–14px (table headers, footer attributions, API prefix), the compressed TGA reads as an institutional identifier — a denomination, not a logo. The tracking creates the compression necessary for this scale. This is the mark's primary context.

**Size threshold:** Below 16px, use the single "T" (ALL CAPS) icon variant, not the full three-character monogram.

### Variations

**Primary (Dark):**
"TGA" in `#E8A020` on `#0E0F11`. -6% tracking. Dark ground only — this direction does not have a light-mode primary.

**Large display (protocol marketing, hero):**
Same mark at 64px+ — characters resolve individually. Used as the protocol denomination in investor-facing materials where the full "Token de Garantia de Aluguel" name needs an abbreviated counterpart.

**Data label (12–14px):**
"TGA" at 12–14px, `#E8A020`, inline with JetBrains Mono data. Functions as a live data prefix: "TGA · NAV: R$47.2M · BLK #284.091.447". At this scale the compressed mark reads as a denomination code.

**Icon:**
The single "T" (ALL CAPS), Geist Bold, -6% tracking applied to the single character (has no effect, but maintains the design intention), amber, in the obsidian square. Distinct from Direction 1's icon (which is lowercase "t") — used only when the ALL CAPS register is already established in the interface context.

**Monochrome:**
"TGA" in `#F0F0EE`. Dark ground only. No light-mode monochrome for this direction.

**Reversed:**
"TGA" in `#0E0F11` on `#E8A020`. Amber fill, 0px radius container. Used only for institutional identifiers (contract seals, document stamps in investidor-facing documents).

### Clear Space
Minimum clear space = **1.5× cap height (H)** on all four sides. The compressed structure of this mark requires more generous breathing room than Direction 1 — the tighter form creates visual tension that needs space to resolve.

At data label scale (12–14px): clear space minimum = the text line height of the surrounding context (typically 16–18px). The mark at this scale functions as inline text, not as a standalone logo.

### Minimum Size
- **Full three-character monogram:** 36px width on screen / 6mm in print
- **Single "T" icon:** 16px × 16px minimum — same as Direction 1's favicon threshold
- **Data label (inline context):** 12px height minimum — below this, replace with plain text "TGA"

### Don'ts
- **Do not** use this direction on Dashboard Imobiliárias. Lucas's front uses Direction 1 exclusively. The ALL CAPS register is associated with financial instruments and operator tools — it is alienating in Lucas's context.
- **Do not** use in marketing materials targeted at Lucas (landing page, guarantee certificate, onboarding).
- **Do not** use on a light background without the approved reversed (amber fill) container. This direction lives on dark grounds.
- **Do not** mix Direction 3 and Direction 1 in the same interface — choose a register and hold it.
- **Do not** apply tracking values other than -6%. Looser tracking loses the compression that creates the dual-reading (glyph at small / lettermark at large) behavior.
- **Do not** use in consumer-facing contexts. If the audience includes Lucas, Direction 1 is the mark.
- **Do not** use the single "T" icon outside of contexts where the Dashboard Investidor or Terminal register is already established. The "T" in isolation has no brand meaning without context.

---

## Cross-Direction Rules

### Which direction, when

| Context | Direction |
|---|---|
| All product dashboards (both fronts) — primary nav | Direction 1 |
| Dashboard Imobiliárias — all contexts | Direction 1 only |
| Dashboard Investidor — nav, hero, onboarding | Direction 1 |
| Dashboard Investidor — data labels, table headers, inline protocol references | Direction 3 |
| Terminal — pane headers | Direction 3 |
| Terminal — section labels before data blocks | Direction 3 |
| Investor materials — title pages, formal documents | Direction 2 |
| Legal documents, contracts, guarantee certificates | Direction 2 |
| Email headers | Direction 1 |
| Social media profile / avatar | Icon from Direction 1 |
| Favicon | Icon from Direction 1 |
| Pitch deck cover | Direction 2 |
| Protocol status page | Direction 3 (denomination) |

### Co-branding
In co-branding contexts, the TGA wordmark (Direction 1) is presented at equal or smaller scale than the partner mark. TGA does not assert visual dominance over institutional partners.

### File format requirements
- SVG (vector): master artwork for all directions
- PNG @1×, @2×, @3×: rasterized exports for each variation and background
- PDF: print-ready for Directions 1 and 2

---

## Related
- [color-system.md](./color-system.md)
- [typography.md](./typography.md)
- [brand-applications.md](./brand-applications.md)
