# Customer Discovery — MUTAV

Evidence for the PULSO Hackathon "customer discovery & validation" criterion. The hackathon requires **≥3 interviews with evidence** (the intro text said 5 — we target 5). MUTAV serves two sides of the Brazilian rental market, so we interview both: **real-estate agencies (*imobiliárias*)** who distribute the guarantee, and **investors** who fund the reserve.

> **How to use this doc:** fill each interview block from your real notes. Anonymize names if needed (role + company type is enough for evidence). Keep at least one verbatim quote per interview — quotes are the most persuasive evidence. Then update the **Summary of findings** below and copy the punchy version into the README's "Customer discovery" section.

## Status

| Segment | Target | Done | Evidence |
|---|---|---|---|
| Agencies (*imobiliárias*) | 3 | <!-- TODO: N --> | below |
| Investors (DeFi / yield) | 2 | in progress | below |

## Methodology

- **Format:** <!-- TODO: e.g. 20–30 min calls, semi-structured. -->
- **Recruiting:** <!-- TODO: how you reached interviewees. -->
- **Period:** <!-- TODO: dates. -->
- **Goal:** validate (1) that the mandatory-guarantee pain is real and acute, (2) that an institutional *fiança* backed by a verifiable onchain reserve is attractive vs. incumbents, (3) that investors will fund a solvency-gated rental-guarantee reserve for yield.

## Summary of findings

<!-- TODO: 3–5 sentences. The punchline a judge should remember. What did you learn that validated (or changed) MUTAV? Copy a tightened version into README §Customer discovery. -->

---

## Part 1 — Agencies (*imobiliárias*)

> Distribution channel: agencies place the guarantee for tenants. They feel the friction of the incumbent products (*fiador* scarcity, slow *seguro-fiança* approvals, deposit disputes) every deal.

### Interview A1

- **Who:** <!-- role + company type, e.g. "Locação manager, mid-size agency, São Paulo" -->
- **Date / format:** <!-- TODO -->
- **Guarantee products used today:** <!-- fiador / seguro-fiança / título / depósito — and rough mix -->
- **Biggest pain points:** <!-- TODO -->
- **Reaction to MUTAV (institutional *fiança* + verifiable reserve):** <!-- TODO -->
- **What would make them adopt it:** <!-- TODO -->
- **Verbatim quote:** > <!-- "…" -->

### Interview A2

- **Who:** <!-- TODO -->
- **Date / format:** <!-- TODO -->
- **Guarantee products used today:** <!-- TODO -->
- **Biggest pain points:** <!-- TODO -->
- **Reaction to MUTAV:** <!-- TODO -->
- **What would make them adopt it:** <!-- TODO -->
- **Verbatim quote:** > <!-- "…" -->

### Interview A3

- **Who:** <!-- TODO -->
- **Date / format:** <!-- TODO -->
- **Guarantee products used today:** <!-- TODO -->
- **Biggest pain points:** <!-- TODO -->
- **Reaction to MUTAV:** <!-- TODO -->
- **What would make them adopt it:** <!-- TODO -->
- **Verbatim quote:** > <!-- "…" -->

### Agency takeaways

<!-- TODO: 2–3 bullets synthesizing across agency interviews. -->

---

## Part 2 — Investors (DeFi / yield)

> These fund the reserve. We need to validate appetite for yield from a solvency-verifiable, real-world-backed (rental-guarantee) reserve on Stellar.

### Investor interview guide (questions to ask)

Use this on the calls you still need. Keep it conversational; the goal is to *learn*, not to pitch.

1. **Apresentação:** Você pode se apresentar um pouco para a gente?
2. **Contexto:** Atualmente, você investe no mercado descentralizado?
3. **Confiança:** O que te faz confiar o suficiente em um protocolo para depositar nele e gerar yield? O que gera essa confiança em um produto?
4. **Apetite por RWA:** Como você se sente em relação a um yield do mercado descentralizado que é lastreado em um fluxo de caixa do mundo real (RWA)?
5. **Liquidez / lockup:** Como você se sente em manter seu investimento bloqueado por um período (lockup)?
6. **Faixa de yield:** Qual faixa de APY torna um investimento interessante para cada perfil de risco (baixo, médio e alto)? O que você avalia em um produto antes de investir?

### Interview I1

- **Who:** Investidor **DeFi-native e sofisticado**, ativo no ecossistema Stellar. Opera liquidity pools, posições de longo prazo e derivativos; **audita/verifica contratos por conta própria**. *(identidade anonimizada — perfil de segmento mantido como evidência.)*
- **Date / format:** <!-- TODO: data --> · entrevista remota, semi-estruturada
- **Key responses:**
  - **Confiança:** sua confiança vem primeiro do **conhecimento técnico** — audita/verifica contratos ele mesmo. Para o mercado em geral, confiança = **credibilidade + autoridade + TVL**. Só opera em pools com **TVL alto**; evita baixa liquidez por princípio.
  - **RWA:** já investiu em RWAs e grupos privados tokenizados; vê como **tendência forte** do mercado. Mas a ressalva é dura: **falta de transparência do lado real**. O resultado da empresa do mundo real muitas vezes não era tão transparente quanto o resultado on-chain — "o grande problema era ter noção do *R* do RWA: se o real era 100% real, se tinha números transparentes."
  - **Lockup:** evita "locked" por padrão, mas **aceita longo prazo quando a estratégia justifica** (mantém posições de prazo muito longo). Compara favoravelmente com o Tesouro Direto: travar num contrato inteligente que se beneficia da adoção da Web3 lhe parece **menos arriscado** do que travar 10 anos no Tesouro carregando "risco Brasil".
  - **Faixa de yield:** referência é o **yield americano (~4% a.a.)**. Busca APY "dentro da realidade". Yield passivo **acima de 12–13% (2–3x o americano) já é alto risco** para ele; em stablecoin, APY alto é praticamente "impossível" / sinal de alerta. APYs altos só fazem sentido em pools voláteis e **num portfólio separado** dedicado a esse risco.
- **Reaction to the solvency gate / queue:** não reagiu diretamente à fila de resgate (não foi perguntado nesta rodada), mas o perfil dele valida a tese: prioriza **solvência verificável e TVL** acima de retorno, e aceita lockup quando há racional claro.
- **Yield expectation:** "dentro da realidade" — ancorado no yield americano (~4%). Considera **>12–13% a.a. passivo = alto risco**, e desconfia de APY alto em stablecoin.
- **Verbatim quote:** > "O grande problema ao investir ali era ter noção do *R*, do RWA mesmo — se o real era 100% real, se tinha números transparentes."
- **Verbatim quote 2:** > "Para mim é mais absurdo você trancar no Tesouro por 10 anos, acreditando no risco Brasil, do que trancar num contrato inteligente que depende de volume e movimentação."

#### Insights para o MUTAV Pulse (da entrevista I1)

1. **Transparência do lastro é o ponto de ruptura, não o yield.** A maior dor dele com RWA não é retorno — é não conseguir verificar se o "real" do RWA é real. → Reforça a aposta do MUTAV em **solvência verificável on-chain por número** e expor as **prêmios/fluxo de caixa reais** (não só o NAV on-chain). A camada de prova de transparência (`/earn/transparency`) deve mostrar **o lado real** (garantias ativas, prêmios coletados), não apenas o estado do vault.
2. **TVL e auditabilidade são proxies de confiança para o investidor DeFi-native.** → Tornar **TVL, contratos verificados e o gate de solvência** visíveis e fáceis de auditar no frontend é tão importante quanto o produto em si.
3. **Lockup/fila de resgate é aceitável se houver racional claro.** Investidores sofisticados aceitam travar capital quando entendem o porquê. → A **fila de resgate surplus-gated** deve ser comunicada como *feature de proteção da solvência* ("garantias permanecem cobertas"), com um racional explícito — não escondida como atrito.
4. **Posicionar o yield "dentro da realidade".** APY-alvo deve ancorar perto do yield americano e **soar conservador de propósito** (~4–12%). Um APY exageradamente alto em produto lastreado em stablecoin/RWA **destrói** confiança nesse público em vez de atrair. → O lastro real (prêmios de fiança) é o argumento, não um número inflado.

### Interview I2

- **Who:** <!-- TODO -->
- **Date / format:** <!-- TODO -->
- **Key responses:** <!-- TODO -->
- **Reaction to the solvency gate / queue:** <!-- TODO -->
- **Yield expectation:** <!-- TODO -->
- **Verbatim quote:** > <!-- "…" -->

### Investor takeaways

<!-- TODO: 2–3 bullets. -->

---

## How discovery shaped MUTAV

<!-- TODO: tie findings back to product decisions — e.g. "agencies wanted X → we prioritized Y", "investors needed verifiable solvency → the /earn/transparency proof layer". This is the strongest signal for judges that discovery was real, not decorative. -->
