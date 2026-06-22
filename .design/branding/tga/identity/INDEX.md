# Identity
> Phase: identity | Brand: TGA — Token de Garantia de Aluguel | Generated: 2026-04-14

## Decisões Confirmadas

| Decisão | Valor |
|---|---|
| Logo primário | Wordmark "tga" em Geist Bold lowercase, amber — sem símbolo, sem marca decorativa |
| Logo investidor | "TGA" ALL CAPS comprimido (-6% tracking) — usado exclusivamente no Dashboard Investidor e Terminal |
| Logo imobiliária | "tga" lowercase, `#C47E10` amber sobre fundo claro |
| Composição de cor (Investidor) | Neutral + Single Accent — obsidian dominante, amber <5% dos pixels |
| Composição de cor (Imobiliárias) | 60-30-10 — warm white + superfícies brancas + amber em CTAs |
| Composição de cor (Terminal) | Terminal/ANSI com paleta warm/earthy — sem verde, copper/sienna como registros secundários |
| Tipografia display | Geist Bold (700) — única weight, exclusiva para declarações e logo |
| Tipografia body/UI | Inter Regular/Medium/Semi-bold — linguagem humana, legibilidade de UI |
| Tipografia dados | JetBrains Mono Regular/Medium — toda verdade numérica, obrigatório tabular numerals |
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
- **Direction 1 (primário):** "tga" lowercase Geist Bold, amber — sem símbolo. Protocolo como nome, nome como argumento.
- **Direction 2 (formal):** Wordmark + régua vertical amber (1px, altura do cap) — linguagem de planta técnica. Para materiais institucionais e documentos.
- **Direction 3 (investidor/terminal):** "TGA" ALL CAPS comprimido (-6% tracking) — quase-glifo. Exclusivo para Dashboard Investidor e Terminal.
- **Ícone:** Letra "t" (ou "T" nos contextos ALL CAPS) em Geist Bold, amber, quadrado obsidian 0px radius.
- **Regra de ouro:** Amber no wordmark jamais aparece sobre fundo que contenha amber.

### Color System
- **Anchor amber:** `#E8A020` (dark) / `#C47E10` (light) — mesmo sinal de marca, luminosidade ajustada por frente.
- **Investidor:** 4 superfícies escuras (#0E0F11 → #252830), amber <5%, success `#3DAB72`, error `#C94040`.
- **Imobiliárias:** 4 superfícies claras (#F7F6F3 → #FFF8EE), amber nos CTAs, trust `#2E8B5A`, alert `#B83232`.
- **Terminal:** Canvas `#0A0B0D` (mais profundo), amber `#E8A020` + copper `#B87010` + sienna `#8B4A2A` — sem verde ANSI.
- **Dark mode Imobiliárias:** Não implementado no build inicial — mapeamento fornecido para iteração futura.

### Typography
- **3 camadas visuais:** Geist Bold (declaração) + Inter (explicação) + JetBrains Mono (evidência) — as três devem estar presentes em cada tela.
- **Tabular numerals:** Obrigatório em todo uso de JetBrains Mono com números.
- **Ligatures:** Desabilitadas em Dashboard Investidor e Imobiliárias — permitidas no Terminal apenas onde funcionais.
- **Inter no Terminal:** Não aparece em panes de terminal. Apenas em áreas de documentação externa.

### Imagery Style
- **Dashboard Investidor:** Zero fotografia. Data viz como imagem primária. Artefatos onchain (Solscan desaturado + amber overlay) para seções de marketing.
- **Dashboard Imobiliárias:** Fotografia como mecanismo de calor. Apartamentos brasileiros reais, mãos e documentos, cidades do Lucas.
- **Terminal:** Sem imagens. Dados são a imagem.
- **Iconografia:** Phosphor Icons (thin) adaptado para 0px radius. Custom icons para vocabulário brasileiro (boleto, garantia).

### Brand Applications
- **Dashboard Investidor — nav:** Live amber pulse dot + NAV counter em JetBrains Mono. Instrumento vivo.
- **Dashboard Investidor — hero:** Headline Geist Bold + chart de NAV ao vivo embutido. Zero lifestyle imagery.
- **Dashboard Imobiliárias — card inadimplência:** Fundo `#FFF8EE` + stripe `#B83232` + progress bar amber. Calma, não pânico.
- **Dashboard Imobiliárias — pagamento confirmado:** "R$2.847,00" Geist Bold em verde + "4h37m" em JetBrains Mono. A promessa materializada.
- **Terminal:** Three-pane split, tudo JetBrains Mono. Approval queue como linha única. Log cromático por tipo de evento.
- **Status page pública:** `status.tga.finance` — terminal simplificado, sempre live, zero marketing.

## Próximos Passos

Esta fase de identity alimenta diretamente:
- `/gsp-logo --enrich` — geometria de construção, variações, regras de espaço, tamanhos mínimos
- `/gsp-color --enrich` — paletas OKLCH, WCAG contrast ratios, `palettes.json`
- `/gsp-typography --enrich` — escala tipográfica matemática, fluid type, font loading
- `/gsp-visuals --imagery --enrich` — especificações de ícones, receitas CSS de tratamento de imagem
- `patterns/` — design system, tokens, guias de implementação por frente
