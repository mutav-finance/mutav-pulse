# Guidelines
> Phase: guidelines | Brand: MUTAV — Token de Garantia de Aluguel | Generated: 2026-04-14

## Core

| File | Description |
|------|-------------|
| [mutav.yml](./mutav.yml) | Style preset — single source of truth. Tokens, intensity, patterns, constraints, per-front overrides with documented rationale. |
| [STYLE.md](./STYLE.md) | Agent contract — rendered from `.yml`. Component tables, constraint lists, bold bets, implementation snippets. |
| [guidelines.html](./guidelines.html) | Superseded April 2026 visual guide: old logo and type. The current guide is `kit/MUTAV-brand-kit.html`. |

## System Overview

| Dimension | Value |
|-----------|-------|
| Strategy | `generate` — full greenfield system |
| Tech stack | Next.js + Tailwind v4 + shadcn/ui |
| Fonts | DM Sans 400/500/700 · JetBrains Mono 400/500 · Outfit 800 in the logo only (see `kit-src/brand.json`) |
| Fronts | Investidor (dark) · Imobiliárias (light) · Terminal (monospace) |
| Border radius | `0px` everywhere — no exceptions |
| Intensity | variance: 3 · motion: 2 · density: 6 |
| Preset overrides | 9 documented (minimal-dark × 5, terminal × 3, professional × 3) |

## Next Steps

- Component mapping pass: `token-mapping.md` + shadcn component overrides
- Per-front layout scaffolds: `layouts/investidor.tsx`, `layouts/imobiliarias.tsx`, `layouts/terminal.tsx`
- Design token export: CSS custom properties file for Tailwind v4 `@theme` block
- Tech: Next.js + Tailwind v4 + shadcn/ui
