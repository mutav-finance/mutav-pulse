# Product

Mutav Pulse — the testnet proof of concept of mutav's decentralized rental-guarantee system (SGR). An onchain *fiador institucional* for Brazil: a solvency-gated, tokenized USDC reserve on Stellar/Soroban that backs rental *fianças*, pays out tenant defaults, and earns DeFi yield on idle reserve. See [`README.md`](README.md) for the full overview.

## Users

**Ana (Protocol Investor):** DeFi-literate investor evaluating or monitoring yield from the mutav SGR reserve vault. Interacts via a Stellar wallet. Context: desktop browser, analysis distance, evaluating solvency and return numbers before committing or redeeming capital. Primary task: verify the reserve is solvent, understand the yield rate, monitor their position, deposit or redeem.

**Protocol Team:** mutav internal operators and fund managers auditing reserve health, guarantee coverage, and NAV. Same surfaces, higher scrutiny on contract-level verification links.

## Product Purpose

Mutav Pulse is the testnet frontend for the mutav SGR (Sistema de Garantia Registrada) reserve vault — a solvency-gated, tokenized reserve vault on Stellar/Soroban that backs rental guarantees. The frontend allows investors to deposit USDC, receive mtvR shares, monitor NAV and APY, and manage redemptions. The `/earn/transparency` dashboard is the reserve's public proof layer: solvency chip, coverage metrics, active guarantee table, and on-chain verification links.

## Brand Personality

Precision. Verifiable. Infrastructural. The system shows numbers and contracts, not promises.

## Anti-references

- Polished DeFi consumer products (Uniswap, Aave app — "DeFi pretty"). TGA is not aspirational consumer; it is industrial infrastructure.
- SaaS dashboards with chart-first hero sections, gradient charts, and KPI card grids with pastel backgrounds.
- Any dark-mode fintech that uses navy/gold or dark-blue/green as primary palette (Coinbase, Binance aesthetic).
- Glass morphism, glows, gradients, rounded-corner cards.

## Design Principles

1. **Verification as first principle.** Every number shown on screen must trace back to an on-chain source. Verification links are not an afterthought; they are the feature.
2. **Three-layer hierarchy is non-negotiable.** Every screen must have Geist Bold (declaration), Inter (explanation), JetBrains Mono (evidence). A screen without evidence layer is incomplete.
3. **Amber is precious.** Amber (#E8A020) appears on <5% of screen pixels: logo, active state, one CTA, status markers. Nowhere else.
4. **Surface stacking without shadows.** Depth reads through background color steps (canvas → surface → surface-2), never box-shadow.
5. **Data before decoration.** Dense, accurate, verifiable information is the product. Any element that doesn't carry information is removed.

## Accessibility & Inclusion

WCAG 2.1 AA minimum. Tabular numerals enforced on all financial data (JetBrains Mono `tnum`). Reduced motion: pulse dot stops (`animation: none`). All status state conveyed by color AND text. Error/success states use bold labels ≥14px alongside color.
