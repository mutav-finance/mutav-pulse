# Color System
**MUTAV — Token de Garantia de Aluguel**
Identity Phase · April 2026

---

## Governing Principle

MUTAV runs three color systems that share a single amber anchor. The amber is the same brand signal regardless of front — but its weight, luminosity, and permitted surface area shift per context. The unifying rule: amber is scarce everywhere. Its scarcity is what makes it mean something.

Composition strategy per front:
- **Dashboard Investidor:** Neutral + Single Accent. Obsidian dominates. Amber appears in fewer than 5% of screen pixels at any moment.
- **Dashboard Imobiliárias:** 60-30-10. Warm white (60%) + white surfaces/neutrals (30%) + amber (10% on CTAs and active states only).
- **Terminal:** Terminal/ANSI aesthetic with warm/earthy accent replacing conventional green. Monochrome obsidian base + amber for status indicators, warm copper for secondary data states.

---

## System 1: Dashboard Investidor (Dark / Precision Brutalism)

| Role | Hex | OKLCH | Usage | Rationale |
|---|---|---|---|---|
| Background (Obsidian) | `#0E0F11` | oklch(0.104 0.005 270) | Page canvas — absolute floor | Near-black with blue-grey undertone. Pure black (#000000) flattens depth — Obsidian retains warmth for the amber to work against. |
| Surface 1 | `#16181C` | oklch(0.149 0.007 270) | Card and module backgrounds | First elevation layer. Tonal shift creates depth without shadows. |
| Surface 2 | `#1E2126` | oklch(0.175 0.010 265) | Elevated states, modals, table headers | Second elevation layer — focus-state containers. |
| Surface 3 | `#252830` | oklch(0.210 0.010 265) | Hover states, secondary panels, flyouts | Third elevation layer — ceiling of the surface stack. |
| Border | `#2A2D33` | oklch(0.234 0.009 264) | Structural borders — used sparingly | 1px only. Separation without new tonal families. |
| Foreground Primary | `#F0F0EE` | oklch(0.944 0.004 102) | Primary text — all body copy, data labels | Warm white. Pure white creates cold contrast against obsidian; this carries amber's warmth through to text. |
| Foreground Secondary | `#8A8F99` | oklch(0.620 0.015 250) | Secondary text, labels, timestamps | Receded but legible. All non-critical data identifiers. |
| Foreground Tertiary | `#555B66` | oklch(0.430 0.018 250) | Disabled states, placeholders, ghost text | Near floor of legibility. Used only for intentional recession. |
| Accent (Amber) | `#E8A020` | oklch(0.758 0.152 74.86) | CTAs, logo, active state indicators, live dot | Sole color event on the dark front. Carries ALL semantic weight for action and attention. |
| Accent Dim | `#9E6A10` | oklch(0.513 0.103 75.08) | Amber hover states, secondary amber contexts | Lower-luminosity amber for hover without introducing a new hue. |
| Success | `#3DAB72` | oklch(0.664 0.132 156.97) | Pagamento confirmado, contract active | Functional green — muted, not vibrant. Never decorative. |
| Error | `#C94040` | oklch(0.483 0.147 24.48) | Inadimplência detected, failed transaction | Functional red — deep, not bright. Alarm without panic. |

**Rules — Dark System:**
- No gradients. Depth through tonal surface stacking only.
- No drop shadows or glow effects. Elevation through surface color only.
- Amber (`#E8A020`) in fewer than 5% of any screen's pixels.
- Pure black (`#000000`) is never the background.
- Success and Error are semantic signals only — never decorative.

---

## System 2: Dashboard Imobiliárias (Light / Structured Warmth)

| Role | Hex | OKLCH | Usage | Rationale |
|---|---|---|---|---|
| Background (Canvas) | `#F7F6F3` | oklch(0.973 0.004 91) | Page canvas — warm off-white | Not pure white. Warmth signals humanity without feeling decorative. |
| Surface 1 | `#FFFFFF` | oklch(1.000 0.000 0) | Card and module backgrounds | Pure white cards on warm canvas creates subtle lift. |
| Surface 2 | `#EEEDEA` | oklch(0.940 0.006 88) | Grouped content, table backgrounds | Slightly warm grey — holds content in organized regions. |
| Surface Active | `#FFF8EE` | oklch(0.985 0.018 88) | Active contract states, highlighted items | Amber-tinted white — the Caregiver's signal: something good is happening here. |
| Border | `#D9D7D2` | oklch(0.872 0.008 85) | Structural borders, dividers, table rules | Warm neutral. Not cold grey. |
| Foreground Primary | `#1A1A1A` | oklch(0.187 0.000 0) | Primary text — all body copy, headings | Near-black, no blue undertone. Reads as ink on paper on warm canvas. |
| Foreground Secondary | `#6B6860` | oklch(0.480 0.012 75) | Secondary text, labels, helper text | Warm medium grey. Receded but readable. |
| Foreground Tertiary | `#9E9C98` | oklch(0.670 0.008 85) | Placeholders, disabled states, fine print | Floor of legibility on this front. |
| Accent (Amber) | `#C47E10` | oklch(0.610 0.132 65) | CTAs, active contract badges, primary links | Same amber family as dark front — darker value maintains presence on light canvas. |
| Accent Light | `#FFF0D4` | oklch(0.965 0.040 82) | Amber-tinted background for confirmation states | Warmest surface. Used for "pagamento confirmado" callout areas. |
| Trust (Paid/OK) | `#2E8B5A` | oklch(0.600 0.120 157) | Pagamento confirmado, contract in good standing | Muted forest green — warm and legible. Must appear every time a payment is confirmed. |
| Alert (Default) | `#B83232` | oklch(0.483 0.147 24) | Inadimplência detected, action required | Deep red — serious but not alarming. |
| Structural Line | `#1A1A1A` at 8% | — | Hairline dividers within cards | Near-invisible structure. Creates organization without visual weight. |

**Rules — Light System:**
- No dark-mode surfaces on this front.
- Amber accent only on CTAs and active contract states — not decorative.
- `#FFF8EE` surface active may cover up to 30% of card surface in active/paid states (amber tint, not full accent).
- Success green must accompany every pagamento confirmado state.

---

## System 3: Terminal (Operator Layer)

| Role | Hex | OKLCH | Usage | Rationale |
|---|---|---|---|---|
| Background (Deep Obsidian) | `#0A0B0D` | oklch(0.088 0.004 264) | Terminal canvas — deeper than Dashboard Investidor | Operators work at infrastructure layer. One level darker signals: below the product surface. |
| Surface 1 | `#111316` | oklch(0.130 0.005 270) | Panel backgrounds, pane dividers | Barely distinguishable from background — minimizes surface differentiation for density. |
| Surface 2 | `#181B1F` | oklch(0.162 0.008 265) | Focused pane, active section highlight | Compressed elevation — density over separation. |
| Border | `#2A2D33` | oklch(0.234 0.009 264) | Pane borders, section dividers | Shared with Dashboard Investidor — same system layer. |
| Foreground Primary | `#E8E4DC` | oklch(0.918 0.009 87) | Primary monospace text — all data output | Warmer than Dashboard Investidor — reduces eye strain in extended operator sessions. |
| Foreground Secondary | `#7A7870` | oklch(0.545 0.010 78) | Secondary labels, parameter names, timestamps | Receded but warm — never cool grey in the terminal. |
| Foreground Dim | `#4A4844` | oklch(0.360 0.008 78) | Commented lines, inactive state labels, ghost data | The terminal's whisper register. |
| Accent (Amber) | `#E8A020` | oklch(0.758 0.152 74.86) | Active contract status, protocol live indicator | Same amber as Dashboard Investidor — MUTAV signal is identical at every layer. |
| Accent Warm (Copper) | `#B87010` | oklch(0.610 0.132 65) | Secondary status indicators, fund utilization % | Dimmer copper-toned amber for secondary data states. Replaces ANSI green. |
| Accent Sienna | `#8B4A2A` | oklch(0.420 0.091 47) | Third-tier status indicators, background annotation | Deep warm sienna for tertiary data. Replaces what would be blue/cyan in a conventional terminal. |
| Confirmed | `#3DAB72` | oklch(0.664 0.132 156.97) | Liquidation executed, transaction confirmed | Same functional green as Dashboard Investidor. Disbursement confirmed onchain. |
| Rejected | `#C94040` | oklch(0.483 0.147 24.48) | Guarantee rejected, transaction failed | Same functional red. Contract denial or transaction failure. |
| Warning | `#D4781A` | oklch(0.640 0.145 58) | Pending review, contract approaching expiry | Distinct amber-orange — attention-required without indicating failure. Terminal-exclusive. |

**Rules — Terminal System:**
- Every element uses JetBrains Mono. No exceptions.
- No green (`#22C55E` or any bright ANSI green) — ever.
- No light mode.
- Accent Copper and Accent Sienna are terminal-exclusive. Never in other fronts.

---

## WCAG Contrast Audit

### Dashboard Investidor (dark background)

| Foreground | Background | Ratio | WCAG |
|---|---|---|---|
| `#F0F0EE` | `#0E0F11` | **16.9:1** | ✅ AAA |
| `#F0F0EE` | `#16181C` | **16.1:1** | ✅ AAA |
| `#F0F0EE` | `#1E2126` | **14.2:1** | ✅ AAA |
| `#8A8F99` | `#0E0F11` | **6.0:1** | ✅ AA |
| `#8A8F99` | `#16181C` | **5.7:1** | ✅ AA |
| `#E8A020` | `#0E0F11` | **8.8:1** | ✅ AAA |
| `#E8A020` | `#16181C` | **8.3:1** | ✅ AAA |
| `#3DAB72` | `#0E0F11` | **6.7:1** | ✅ AA |
| `#C94040` | `#0E0F11` | **3.9:1** | ⚠️ AA large (≥18px or ≥14px bold) |
| `#0E0F11` | `#E8A020` | **8.8:1** | ✅ AAA (reversed amber) |

**Note on `#C94040`:** Error red on obsidian is AA-large only. Mitigated by: (1) always accompanies a status badge (large/bold text), (2) never used for normal body copy, (3) pairs with a semantic label that carries the meaning redundantly.

### Dashboard Imobiliárias (light background)

| Foreground | Background | Ratio | WCAG |
|---|---|---|---|
| `#1A1A1A` | `#F7F6F3` | **16.1:1** | ✅ AAA |
| `#1A1A1A` | `#FFFFFF` | **18.1:1** | ✅ AAA |
| `#6B6860` | `#F7F6F3` | **5.2:1** | ✅ AA |
| `#C47E10` | `#F7F6F3` | **3.1:1** | ⚠️ AA large (≥18px or ≥14px bold) |
| `#FFFFFF` | `#C47E10` | **3.3:1** | ⚠️ AA large only |
| `#1A1A1A` | `#C47E10` | **5.3:1** | ✅ AA ← use dark text on amber CTAs |
| `#2E8B5A` | `#F7F6F3` | **3.9:1** | ⚠️ AA large (use Semi-bold minimum) |
| `#B83232` | `#F7F6F3` | **5.5:1** | ✅ AA |

**Amber CTA guidance:** `#C47E10` on light background fails AA for normal text. Use `#1A1A1A` as button text color (5.3:1 ✅). Amber accent is approved for large text (section titles, badge labels in bold), icons, and decorative borders — not for body text.

**Trust green guidance:** `#2E8B5A` on canvas is 3.9:1. Use Inter Semi-bold (600) minimum for all trust-colored text. "Pagamento confirmado" label must be Semi-bold at 14px minimum.

### Terminal (deep obsidian background)

| Foreground | Background | Ratio | WCAG |
|---|---|---|---|
| `#E8E4DC` | `#0A0B0D` | **15.5:1** | ✅ AAA |
| `#E8A020` | `#0A0B0D` | **9.0:1** | ✅ AAA |
| `#B87010` | `#0A0B0D` | **5.0:1** | ✅ AA |
| `#7A7870` | `#0A0B0D` | **4.5:1** | ⚠️ AA threshold (14px JetBrains Mono minimum) |
| `#3DAB72` | `#0A0B0D` | **6.7:1** | ✅ AA |
| `#C94040` | `#0A0B0D` | **4.0:1** | ⚠️ AA large (bold status labels only) |

**Terminal secondary text note:** `#7A7870` sits precisely at the AA threshold on the terminal's darker background. Use at 14px JetBrains Mono minimum. Below 14px, promote to `#E8E4DC` or use `#E8A020` for critical labels.

---

## Color Rationale — Archetype Connection

**Why amber anchors the entire system:** The Ruler archetype communicates through gold and amber across cultures and centuries. Bloomberg's amber-on-black terminal, heraldic gold, and sovereign seals all use the amber-on-dark combination to signal serious capital and infrastructure authority. MUTAV's amber is not decorative — it is the single permission the system gives itself for color. That restraint amplifies authority: when amber appears, it matters.

**Why Obsidian not pure black:** Pure black is an absence, not a color. `#0E0F11` carries a faint blue-grey undertone that keeps the surface from reading as void. The amber accent only works against a surface that has its own temperature.

**Why warm off-white not pure white:** The Caregiver archetype requires warmth. Pure white signals clinical bureaucracy. `#F7F6F3` sits at the exact threshold that shifts Lucas's reading from "government form" to "well-run office."

**Why earthy tones not green in Terminal:** ANSI green carries hacker/exploit culture associations and financial-gain excitement signals. Neither belongs in an operator-layer instrument where precision and calm accuracy matter more than signal excitement. The copper/sienna palette turns the terminal into a precision instrument.

---

## Dark Mode Mapping

Dashboard Investidor IS the dark system. Dashboard Imobiliárias does not have a dark mode in the initial build. Mapping provided for future iteration:

| Token | Light (Imobiliárias) | Dark (Investidor equivalent) |
|---|---|---|
| Canvas | `#F7F6F3` | `#0E0F11` |
| Surface 1 | `#FFFFFF` | `#16181C` |
| Surface 2 | `#EEEDEA` | `#1E2126` |
| Foreground Primary | `#1A1A1A` | `#F0F0EE` |
| Foreground Secondary | `#6B6860` | `#8A8F99` |
| Accent | `#C47E10` | `#E8A020` |
| Trust/Success | `#2E8B5A` | `#3DAB72` |
| Alert/Error | `#B83232` | `#C94040` |

---

## Semantic Token Assignments

| Token | Dashboard Investidor | Dashboard Imobiliárias | Terminal |
|---|---|---|---|
| `--color-canvas` | `#0E0F11` | `#F7F6F3` | `#0A0B0D` |
| `--color-surface` | `#16181C` | `#FFFFFF` | `#111316` |
| `--color-surface-2` | `#1E2126` | `#EEEDEA` | `#181B1F` |
| `--color-border` | `#2A2D33` | `#D9D7D2` | `#2A2D33` |
| `--color-text` | `#F0F0EE` | `#1A1A1A` | `#E8E4DC` |
| `--color-text-2` | `#8A8F99` | `#6B6860` | `#7A7870` |
| `--color-text-3` | `#555B66` | `#9E9C98` | `#4A4844` |
| `--color-accent` | `#E8A020` | `#C47E10` | `#E8A020` |
| `--color-accent-dim` | `#9E6A10` | `#FFF0D4` | `#B87010` |
| `--color-success` | `#3DAB72` | `#2E8B5A` | `#3DAB72` |
| `--color-error` | `#C94040` | `#B83232` | `#C94040` |
| `--color-warning` | — | — | `#D4781A` |

---

## Related
- [palettes.json](./palettes.json)
- [logo-directions.md](./logo-directions.md)
- [typography.md](./typography.md)
