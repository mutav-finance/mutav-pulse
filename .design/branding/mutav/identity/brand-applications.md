# Brand Applications
**MUTAV — Token de Garantia de Aluguel**
Identity Phase · April 2026

---

## Governing Principle

Brand applications show the identity living inside context — not as isolated elements, but as a coherent system responding to real use cases. Each touchpoint below specifies how the logo, color, typography, and imagery decisions converge into a specific product or marketing moment.

The three fronts must feel coherent as siblings and distinct as siblings. A person who encounters all three should recognize the DNA without feeling they are looking at the same thing three times.

---

## 1. Dashboard Investidor — Key Touchpoints

### 1.1 Top Navigation Bar

**Background:** `#0E0F11` (Obsidian) — the nav shares the page canvas.
**Logo:** "mutav" wordmark, Direction 1, `#E8A020` amber. Positioned left. Clear space respected. No tagline in the nav.
**Nav items:** Inter Medium 14px, `#8A8F99`. Active state: `#F0F0EE` with a 1px amber underline below the item (not a background highlight — a line). The amber is the pointer.
**Live indicator:** A 6px amber dot, pulsing at 2-second interval (opacity 100% → 40% → 100%, linear), adjacent to a JetBrains Mono 12px counter showing "NAV ao vivo · R$47.2M." This is the only animation in the nav.
**Right side:** Wallet address in JetBrains Mono 12px, `#555B66`, truncated to first-6/last-4. Connect button in amber outline (1px border `#E8A020`, no fill, Inter Medium 13px, 0px radius).

The nav communicates immediately: this is a live instrument, not a static dashboard. The pulse is functional, not decorative.

### 1.2 NAV Display Module

**Background:** Surface 1 (`#16181C`).
**Label:** "NAV Total do Protocolo" — Inter Medium 12px, `#8A8F99`, uppercase, +1% tracking.
**Value:** "R$47.284.000" — Geist Bold 48px, `#F0F0EE`. The period as thousands separator (BRL format) and the comma for decimals — never vice versa.
**Sub-value:** "Última atualização: 23 minutos atrás · Bloco #284.091.447" — JetBrains Mono 11px, `#555B66`.
**Change indicator:** "+R$284.000 (últimas 24h)" — JetBrains Mono 13px, `#3DAB72` (positive) or `#C94040` (negative). The color is the only semantic addition needed.
**Border:** 1px `#2A2D33` on all sides. No shadow.

The module is a proof of value. Geist Bold makes the declaration; JetBrains Mono provides the evidence.

### 1.3 Contract Registry Table

**Background:** `#0E0F11` base, Surface 2 (`#1E2126`) for alternating header.
**Header row:** JetBrains Mono 11px, `#8A8F99`, ALL CAPS, +2% tracking. Columns: CONTRACT_ID / INQUILINO / VALOR_MENSAL / STATUS / ÚLTIMA_AÇÃO / BLOCO.
**Data rows:** JetBrains Mono 13px, `#F0F0EE` for primary values. `#8A8F99` for IDs and timestamps.
**Status badge:** A 6px colored square (not a rounded pill — 0px radius) + JetBrains Mono 11px label. ATIVO: `#3DAB72` square + "ATIVO." EM_DEFAULT: `#C94040` square + "EM_DEFAULT." LIQUIDADO: `#E8A020` square + "LIQUIDADO."
**Row hover:** Background lifts to Surface 3 (`#252830`). Border appears at `#2A2D33` on top and bottom of the row.

The table is not styled — it is organized. Every styling decision is a legibility decision, not an aesthetic one.

### 1.4 Marketing Landing Page — Hero Section

**Background:** `#0E0F11` full viewport.
**Headline:** "Yield real. Colateral verificável. Sem intermediário." — Geist Bold 64px, `#F0F0EE`, -4% tracking, leading 1.05. Left-aligned.
**Sub-headline:** "O único protocolo na Solana com exposição ao mercado brasileiro de garantias locatícias." — Inter Regular 18px, `#8A8F99`. Left-aligned.
**CTA:** "Conectar carteira" — Inter Medium 14px, `#E8A020` text, 1px `#E8A020` border, `#0E0F11` background fill, 0px radius, 40px height. Hover: `#E8A020` fill, `#0E0F11` text.
**Visual element:** A live-rendering NAV chart component, embedded directly in the hero — real protocol data, not a screenshot. Amber line on obsidian background. This is the hero image.

The hero refuses marketing register. There is no lifestyle imagery, no promise that isn't already verifiable in the chart next to it.

---

## 2. Dashboard Imobiliárias — Key Touchpoints

### 2.1 Top Navigation Bar

**Background:** `#F7F6F3` (warm canvas).
**Logo:** "mutav" wordmark, Direction 1, `#C47E10` amber. Positioned left.
**Nav items:** Inter Medium 14px, `#6B6860`. Active: `#1A1A1A` with 2px `#C47E10` bottom border.
**Right side:** "Olá, Carlos" (landlord name) in Inter Regular 14px, `#6B6860`. A "Sair" link in Inter Medium 13px, `#C47E10`.

The nav is calm and familiar. It greets Lucas by name. There is nothing technical about it.

### 2.2 Contract Status Card — Active State

**Background:** `#FFFFFF` (Surface 1), with a 1px `#D9D7D2` border. 0px radius.
**Status banner at card top:** 4px tall `#C47E10` amber fill — a solid stripe, not a badge. Signals: this contract is in a state that requires attention (active, meaning it is covered and running).
**Property label:** "Apt 42 — Rua Padre João Manuel, 847, São Paulo" — Inter Medium 14px, `#1A1A1A`.
**Tenant:** "Inquilino: Roberto Ferreira" — Inter Regular 13px, `#6B6860`.
**Status:** "Cobertura ativa" — Inter Semi-bold 14px, `#C47E10`.
**Monthly value:** "R$2.847,00/mês" — JetBrains Mono Medium 16px, `#1A1A1A`. Tabular numerals.
**Next event:** "Próximo vencimento: 15 de maio de 2026" — Inter Regular 12px, `#6B6860`.
**Bottom:** 1px `#D9D7D2` divider, then two actions: "Ver contrato" (Inter Medium 13px, `#C47E10`) and "Histórico" (Inter Regular 13px, `#6B6860`).

The card gives Lucas every piece of information he needs in 3 seconds. The amber status stripe is the first thing he sees: the contract is alive and covered.

### 2.3 Inadimplência Detected — Notification State

**Full card background shifts to** `#FFF8EE` (Surface Active — amber-tinted). The card itself is the alert.
**Status banner:** 4px `#B83232` deep red stripe at top.
**Header:** "Inadimplência detectada" — Geist Bold 16px, `#1A1A1A`. This is the only time Geist Bold appears at this size on a card in Lucas's front — it commands attention.
**Details:** "Vencimento: 15 de abril de 2026 · Pagamento não identificado às 23h59" — Inter Regular 13px, `#6B6860`. JetBrains Mono for the date and time.
**Process status:** "Protocolo iniciado: repasse previsto em até 48h" — Inter Medium 14px, `#1A1A1A`.
**Progress indicator:** A simple linear progress bar — 1px `#D9D7D2` background, `#C47E10` fill, no animation initially, updating as time passes.
**CTA:** "Acompanhar processo" — Inter Medium 14px, `#C47E10` text on `#FFFFFF` button with 1px `#C47E10` border, 0px radius.

Lucas does not feel panic from this card. He feels: the system saw it. The system is handling it. He is being informed. The Caregiver's signal is the calm amber progress bar — not a red alert screen with exclamation marks.

### 2.4 Payment Confirmed — Resolution State

**Card background:** `#FFFFFF`. Status banner: 4px `#2E8B5A` (Trust green).
**Header:** "Pagamento realizado" — Geist Bold 18px, `#1A1A1A`.
**Amount:** "R$2.847,00" — Geist Bold 32px, `#2E8B5A`. The green amount is the resolution.
**Detail:** "Transferido para Bradesco ····3847" — Inter Regular 14px, `#6B6860`.
**Timing:** "Tempo desde notificação de inadimplência: 4h37m" — JetBrains Mono 13px, `#6B6860`. This specific number is the brand promise materialized. It is never rounded.
**Date:** "18h22 de hoje, 15 abr 2026" — JetBrains Mono 12px, `#9E9C98`.

This is the moment the brand delivers. The green amount is the payoff of the entire promise. "4h37m" in JetBrains Mono is the brand value "Especificidade Radical" made visible.

### 2.5 Marketing Landing Page — Lucas's Hero

**Background:** `#F7F6F3`.
**Left column:** Typography and CTA.
**Headline:** "Quando o inquilino para de pagar, você recebe." — Geist Bold 48px, `#1A1A1A`, -1% tracking.
**Sub:** "Sem formulário. Sem fila. Sem telefonema. O protocolo executa." — Inter Regular 18px, `#6B6860`. Three short sentences. Full stop after each.
**CTA:** "Proteger meu imóvel" — Inter Semi-bold 15px, `#FFFFFF` text on `#C47E10` fill, 0px radius, 48px height.
**Right column:** Photography. A real São Paulo apartment, morning light, warm grade, no people visible — just the lived-in space. No caption. The image needs no explanation.

The hero is a promise on the left and evidence on the right. Except the evidence is visual warmth, not data — because Lucas's evidence register is emotional, not technical.

---

## 3. Terminal — Key Touchpoints

### 3.1 Main Interface Layout

**Background:** `#0A0B0D` (Deep Obsidian).
**Layout:** Three-pane split. Left sidebar (200px): navigation tree in JetBrains Mono 12px, `#7A7870`. Center pane (flex): primary data output. Right sidebar (280px): contract detail panel.
**All text:** JetBrains Mono. No exceptions within pane content.
**Pane borders:** 1px `#2A2D33`.
**Active pane indicator:** 1px amber (`#E8A020`) left border on the active pane title.

The layout communicates: this is a workstation, not a dashboard. Operators are not browsing — they are operating.

### 3.2 Contract Approval Queue

Each queue item is a single line:

```
[PENDENTE]  CTR-0028419  Itatiba/SP   R$1.450   RM: 28.3   VENC: 2026-05-01   [APROVAR] [REJEITAR]
```

Color treatment:
- `[PENDENTE]`: JetBrains Mono 12px, `#B87010` (Accent Copper) — the amber family signals attention.
- `CTR-0028419`: `#E8E4DC` (Foreground Primary).
- `Itatiba/SP` and `R$1.450`: `#E8E4DC`.
- `RM: 28.3` (Rent Multiplier): `#B87010` if below threshold, `#3DAB72` if within approval range, `#C94040` if rejection trigger.
- `[APROVAR]`: `#3DAB72` text, no border, inline with the row.
- `[REJEITAR]`: `#C94040` text, no border, inline with the row.

The line is the entire decision surface. No card, no modal, no hover state on the line itself. Click `[APROVAR]` → confirmation prompt appears below the line in `#8B4A2A` (Accent Sienna): `> Confirmar aprovação CTR-0028419? [S/n]`. The terminal asks before executing. The operator types "S" or presses Enter.

### 3.3 Protocol Log (Live Feed)

```
2026-04-15T14:23:17Z  LIQUIDAÇÃO_EXECUTADA   CTR-0027841  R$2.847,00  →  bradesco:3847  TX: 4xK9...mQ2P
2026-04-15T14:18:02Z  CONTRATO_APROVADO      CTR-0028413  Curitiba/PR  R$3.200,00   OP: mths...7k2
2026-04-15T13:55:44Z  INADIMPLÊNCIA_DETECTADA CTR-0027841  Prazo: 48h  Status: INICIADO
2026-04-15T13:22:31Z  NAV_ATUALIZADO         R$47.284.000  Δ+R$284.000 (24h)
```

Color coding in the log:
- Timestamps: `#4A4844` (Foreground Dim) — always present, never dominant.
- Event type labels: color-coded. LIQUIDAÇÃO_EXECUTADA: `#3DAB72`. CONTRATO_APROVADO: `#E8A020`. INADIMPLÊNCIA_DETECTADA: `#C94040`. NAV_ATUALIZADO: `#B87010`.
- Values and IDs: `#E8E4DC`.
- Operator attribution (OP:): `#7A7870`.
- Transaction hashes: `#7A7870` with full address visible on cursor hover (inline expand, not modal).

The log is the protocol's memory. Every event is recorded, timestamped, and attributed. The Caregiver's proactive transparency (publishing the log) and the Ruler's authority (timestamped machine execution) appear simultaneously in the same table.

---

## 4. Shared Brand Touchpoints

### 4.1 Email Notifications

**From name:** "MUTAV" — not "equipe MUTAV" or "noreply" — the protocol sends, not a person.
**Subject lines follow voice rules by persona:**
- Lucas: "Pagamento realizado — R$2.847,00" — result first, amount specific.
- Ana: "MUTAV — NAV atualizado · Liquidação executada bloco #284.091.447" — data first, technical specificity.
- Operator: "[AÇÃO NECESSÁRIA] CTR-0028419 aguarda aprovação há 6h" — status code first, specific time.

**Email body layout:** Single-column. White background on all emails (overrides dark-mode preferences — MUTAV emails are always light). Logo at top: "mutav" wordmark in amber, centered. Geist Bold for the key declaration, Inter Regular for the explanation, JetBrains Mono for any data value.

### 4.2 Document System (Contracts, Reports, Investor Docs)

**Cover:** `#0E0F11` background (documents exist in the investidor's world, not Lucas's — contracts are institutional). "mutav" Direction 2 (wordmark + rule) in amber, centered on cover. Document title in Geist Bold 28px, `#F0F0EE`. Date and version in JetBrains Mono 11px, `#8A8F99`.
**Interior pages:** `#FFFFFF` background. Body: Inter Regular 10.5pt. Section headers: Geist Bold 14pt, `#1A1A1A`. Data tables: JetBrains Mono 9pt, tabular numerals, `#1A1A1A`.
**For Lucas-specific documents** (guarantee certificate, contract confirmation): Interior pages use `#F7F6F3` background. Amber rule at top of each page (1px `#C47E10`). The trust signal carries even in a printed document.

### 4.3 Protocol Status Page (Public)

A single-page public status endpoint — always live, always dark mode, JetBrains Mono dominant.

**URL pattern:** status.mutav.finance or similar.
**Layout:** Exactly like a simplified terminal. Three sections:
1. `PROTOCOLO` — ONLINE / DEGRADADO / OFFLINE in the corresponding semantic color.
2. `NAV` — live value in Geist Bold amber.
3. `CONTRATOS_ATIVOS` — live count in JetBrains Mono.
4. `LOG_RECENTE` — last 10 protocol events, terminal log format.

No navigation. No marketing. No explanation of what MUTAV is. This page is for people who already know. Its existence is the brand value "Verificabilidade Como Padrão" made public infrastructure.
