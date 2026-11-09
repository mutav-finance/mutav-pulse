# Identity
> Phase: identity | Brand: MUTAV — Token de Garantia de Aluguel | Generated: 2026-04-14

## Decisões Confirmadas

| Decisão | Valor |
|---|---|
| Logo | M-mark ao lado de "MUTAV" em caixa alta, Outfit 800 contornado. Arquivos em `kit/logo/`; nunca redesenhar nem redigitar. Ver [logo-directions.md](./logo-directions.md) (atualizado 2026-11-07) |
| Logo sobre papel | Letras do M-mark em ink `#1A1A1A`, pílula e nome em Amber deep `#C47E10` |
| Logo sobre obsidian | Letras do M-mark em warm white `#F0F0EE`, pílula e nome em Amber `#E8A020` |
| Composição de cor (Investidor) | Neutral + Single Accent — obsidian dominante, amber <5% dos pixels |
| Composição de cor (Imobiliárias) | 60-30-10 — warm white + superfícies brancas + amber em CTAs |
| Composição de cor (Terminal) | Terminal/ANSI com paleta warm/earthy — sem verde, copper/sienna como registros secundários |
| Tipografia do logo | Outfit 800 — só no logo, contornado nos arquivos; nunca em texto corrido |
| Tipografia títulos e texto | DM Sans 400/500/700 — títulos 700, texto 400, ênfase 500. Fallback: Arial/Helvetica |
| Tipografia dados | JetBrains Mono 400/500 — rótulos, números e dados; rótulos em caixa alta, +0.08em; tabular numerals obrigatório. Fallback: Courier New |
| Corner radius | 0px em todos os containers, cards e botões — Precision Brutalism |
| Iconografia | Stroke 1.5px, 0px radius, functional only — nunca decorativo |
| Imagens Investidor | Nenhuma fotografia — data viz e artefatos onchain como linguagem visual |
| Imagens Imobiliárias | Fotografia de apartamentos brasileiros reais, mãos e documentos, cidades do Lucas |

## Chunks

| Chunk | Arquivo | ~Linhas |
|-------|---------|---------|
| Logo Directions | [logo-directions.md](./logo-directions.md) | ~115 |
| Color System | [color-system.md](./color-system.md) | ~124 |
| Typography | [typography.md](./typography.md) | ~114 |
| Imagery Style | [imagery-style.md](./imagery-style.md) | ~97 |
| Brand Applications | [brand-applications.md](./brand-applications.md) | ~200 |

## Sumário de Decisões por Chunk

### Logo Directions
- **Logo (2026-11-07):** M-mark + "MUTAV" em caixa alta (Outfit 800, contornado). Substitui as direções de abril (wordmark "mutav" minúsculo, régua vertical, monograma "T", favicon "t"), que estão no histórico do git.
- **Ícone:** O M-mark sobre um quadrado obsidian: letras warm white, pílula amber.
- **Regra de ouro:** Amber no wordmark jamais aparece sobre fundo que contenha amber.

### Color System
- **Anchor amber:** `#E8A020` (dark) / `#C47E10` (light) — mesmo sinal de marca, luminosidade ajustada por frente. Amber abaixo de ~10% de qualquer layout. Sobre papel, Amber deep só no logo, preenchimentos, réguas e títulos de 24px ou mais; nunca texto pequeno. Links sobre papel são ink com sublinhado amber.
- **Investidor:** 4 superfícies escuras (#0E0F11 → #252830), amber <5%, success `#3DAB72`, error `#C94040`.
- **Imobiliárias:** 4 superfícies claras (#F7F6F3 → #FFF8EE), amber nos CTAs, trust `#2E8B5A`, alert `#B83232`.
- **Terminal:** Canvas `#0A0B0D` (mais profundo), amber `#E8A020` + copper `#B87010` + sienna `#8B4A2A` — sem verde ANSI.
- **Dark mode Imobiliárias:** Não implementado no build inicial — mapeamento fornecido para iteração futura.

### Typography
- **3 camadas visuais:** DM Sans 700 (declaração) + DM Sans 400 (explicação) + JetBrains Mono (evidência) — as três devem estar presentes em cada tela.
- **Tabular numerals:** Obrigatório em todo uso de JetBrains Mono com números.
- **Ligatures:** Desabilitadas em Dashboard Investidor e Imobiliárias — permitidas no Terminal apenas onde funcionais.
- **DM Sans no Terminal:** Não aparece em panes de terminal. Apenas em áreas de documentação externa.

### Imagery Style
- **Dashboard Investidor:** Zero fotografia. Data viz como imagem primária. Artefatos onchain (Solscan desaturado + amber overlay) para seções de marketing.
- **Dashboard Imobiliárias:** Fotografia como mecanismo de calor. Apartamentos brasileiros reais, mãos e documentos, cidades do Lucas.
- **Terminal:** Sem imagens. Dados são a imagem.
- **Iconografia:** Phosphor Icons (thin) adaptado para 0px radius. Custom icons para vocabulário brasileiro (boleto, garantia).

### Brand Applications
- **Dashboard Investidor — nav:** Live amber pulse dot + NAV counter em JetBrains Mono. Instrumento vivo.
- **Dashboard Investidor — hero:** Headline DM Sans 700 + chart de NAV ao vivo embutido. Zero lifestyle imagery.
- **Dashboard Imobiliárias — card inadimplência:** Fundo `#FFF8EE` + stripe `#B83232` + progress bar amber. Calma, não pânico.
- **Dashboard Imobiliárias — pagamento confirmado:** "R$2.847,00" DM Sans 700 em verde + "4h37m" em JetBrains Mono. A promessa materializada.
- **Terminal:** Three-pane split, tudo JetBrains Mono. Approval queue como linha única. Log cromático por tipo de evento.
- **Status page pública:** `status.mutav.finance` — terminal simplificado, sempre live, zero marketing.

## Próximos Passos

Esta fase de identity alimenta diretamente:
- `/gsp-logo --enrich` — geometria de construção, variações, regras de espaço, tamanhos mínimos
- `/gsp-color --enrich` — paletas OKLCH, WCAG contrast ratios, `palettes.json`
- `/gsp-typography --enrich` — escala tipográfica matemática, fluid type, font loading
- `/gsp-visuals --imagery --enrich` — especificações de ícones, receitas CSS de tratamento de imagem
- `patterns/` — design system, tokens, guias de implementação por frente
