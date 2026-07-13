# Guidelines
> Phase: guidelines | Brand: MUTAV — Token de Garantia de Aluguel | Generated: 2026-04-14

## Core

| File | Description |
|------|-------------|
| [mutav.yml](./mutav.yml) | Style preset — single source of truth. Tokens, intensity, patterns, constraints, per-front overrides with documented rationale. |
| [STYLE.md](./STYLE.md) | Agent contract — rendered from `.yml`. Component tables, constraint lists, bold bets, implementation snippets. |
| [guidelines.html](./guidelines.html) | Visual brand guide — open in browser. Self-contained, no external deps. Demonstrates Precision Brutalism using MUTAV's own visual language. |

## System Overview

| Dimension | Value |
|-----------|-------|
| Strategy | `generate` — full greenfield system |
| Tech stack | Next.js + Tailwind v4 + shadcn/ui |
| Fonts | Geist (700 only) · Inter Variable · JetBrains Mono Variable |
| Fronts | Investidor (dark) · Imobiliárias (light) · Terminal (monospace) |
| Border radius | `0px` everywhere — no exceptions |
| Intensity | variance: 3 · motion: 2 · density: 6 |
| Preset overrides | 9 documented (minimal-dark × 5, terminal × 3, professional × 3) |

## Next Steps

- Component mapping pass: `token-mapping.md` + shadcn component overrides
- Per-front layout scaffolds: `layouts/investidor.tsx`, `layouts/imobiliarias.tsx`, `layouts/terminal.tsx`
- Design token export: CSS custom properties file for Tailwind v4 `@theme` block
- Tech: Next.js + Tailwind v4 + shadcn/ui
