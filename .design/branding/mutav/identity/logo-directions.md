# Logo
**MUTAV · Garantia locatícia**
Updated 2026-11-07. This replaces the April 2026 directions: the pure wordmark, the vertical rule, the "T" monogram and the "t" favicon. Those are in git history.

---

## The logo

The **M-mark** beside **"MUTAV"** in capitals. The artwork files are in `kit/logo/`, and the full guide is `kit/MUTAV-brand-kit.html`. Use the files. Never retype the name or redraw the mark.

### M-mark
- Geometry: `mutav-app/packages/brand/src/logo-mark-geometry.ts`. The view box is 72 × 60 units: four letterform paths plus an amber pill.
- Pill: `x 46.8 · y 43.2 · w 25.2 · h 16.2 · rx 8.1`. Its height is **p**, the unit for gap and clear space.

### Wordmark
- "MUTAV": Outfit ExtraBold (800), capitals, tracking +0.01em.
- In the files the wordmark is outlined to vector paths, so it renders without the font.

### Lockup construction
These match mutav PR #250's `.s-lockup`.
- Cap height = 88% of the mark height.
- Gap between mark and name = **p**.
- The caps are centred on the mark by cap height.
- The horizontal lockup is 6 : 1. A stacked lockup exists for square spaces.

### Colourways
| Ground | Mark letters | Pill + name |
| --- | --- | --- |
| Paper `#F7F6F3` / white | Ink `#1A1A1A` | Amber deep `#C47E10` |
| Obsidian `#0E0F11` | Warm white `#F0F0EE` | Amber `#E8A020` |
| Amber `#E8A020` (badges) | Obsidian | Obsidian |
| One-colour print | All `#1A1A1A` | |
| Photos / dark print | All `#FFFFFF` | |

The favicon and app icon are the mark on an obsidian tile: warm-white letters and an amber pill. `favicon.svg` follows the browser theme.

### Clear space and minimum size
- Clear space ≥ **p** on every side.
- Minimum height: lockup 20 px / 5 mm; mark alone 16 px / 4 mm.

### Don'ts
- Don't stretch, rotate, recolour, outline, shadow or add gradients.
- Don't retype or respace the name.
- Don't put the colour logo on amber, or on a busy photo (use the white version).

## Name in text
- Prose, titles, emails and legal: **MUTAV**. Never "Mutav".
- Descriptor: **Garantia locatícia** / **Rental guarantee**.

## In code
Use `@mutav/brand` `LogoMark` and the app `Wordmark`; never hand-roll the logo. The apps' `Wordmark` still sets lowercase Geist until PR #250's lockup reaches mutav-app.
