# Customer Discovery — MUTAV

Evidence for the PULSO Hackathon "customer discovery & validation" criterion. The hackathon requires **≥3 interviews with evidence** (the intro text said 5 — we target 5). MUTAV's reserve is funded by **investors**, so discovery focuses on the investors who fund a solvency-gated rental-guarantee reserve for yield.

> **How to use this doc:** fill each interview block from your real notes. Anonymize names if needed (role + profile type is enough for evidence). Keep at least one verbatim quote per interview — quotes are the most persuasive evidence. Then update the **Summary of findings** below and copy the punchy version into the README's "Customer discovery" section.

## Status

| Segment | Target | Done | Evidence |
|---|---|---|---|
| Investors (DeFi / yield) | 2 | 2 / 2 (I1, I2) | below |

## Methodology

- **Goal:** validate that investors will fund a solvency-gated, real-world-backed (rental-guarantee) reserve on Stellar for yield, and that verifiable onchain solvency is what earns their trust.

## Summary of findings

<!-- TODO: 3–5 sentences. The punchline a judge should remember. What did you learn that validated (or changed) MUTAV? Copy a tightened version into README §Customer discovery. -->

---

## Investors (DeFi / yield)

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

- **Who:** Investidor **ativo principalmente no ecossistema Solana**, presente no mercado DeFi e em RWA, com **compreensão avançada de DeFi**. Perfil que combina apetite por renda on-chain com familiaridade com ativos lastreados no mundo real. *(identidade anonimizada — perfil de segmento mantido como evidência.)*
- **Date / format:** <!-- TODO: data --> · entrevista remota, semi-estruturada
- **Key responses:**
  - **Confiança:** a confiança vem antes de tudo da **equipe** — procura times com **background sólido e anos de experiência**, e confia no projeto quando confia em quem está por trás. Soma-se a isso **TVL alto** (sinal de que o mercado já validou) e **indicação** de pessoas/fontes em quem confia. Ou seja: credibilidade do time + tração medível + prova social.
  - **RWA:** tem **familiaridade** com o tema e **gosta da idealização** de yield lastreado no mundo real — falou bem da categoria e já considera/investe nesse tipo de produto. Citou o **ONRE** como exemplo de referência que aprecia. Vê RWA como direção legítima do mercado, não como nicho experimental.
  - **Lockup / liquidez:** **não gosta de bloqueio** e **prioriza liquidez**. A ressalva é importante: até aceita um produto com prazo, **desde que haja saída pelo mercado secundário** — a liquidez não precisa ser instantânea no protocolo, mas precisa *existir* uma via de saída. Capital 100% travado sem rota de liquidez é um bloqueador.
  - **Faixa de yield:** quer **APY atrativo o suficiente para valer o risco, mas nada exagerado**. Acima de **~20–30% a.a.** fica **desconfiado** e passa a querer entender **de onde vem a renda**. Valoriza dois pontos: (a) um **APR mínimo consistente** que já justifique o interesse, e (b) **composabilidade** — poder usar a posição no resto do DeFi para **somar outros rendimentos** em cima.
- **Reaction to the solvency gate / queue:** o gate de solvência não foi o foco da conversa, mas o perfil **tensiona** com a fila de resgate surplus-gated: ele prioriza liquidez e rejeita bloqueio rígido. O sinal é claro — a fila só é aceitável para este perfil **se vier acompanhada de uma rota de saída via mercado secundário** (ex.: transferibilidade/negociação das shares do vault). A solvência verificável agrada, mas não substitui liquidez na cabeça dele.
- **Yield expectation:** APY **atrativo porém crível** — abaixo de ~20–30% a.a. para não acionar desconfiança; o **lastro precisa ser explicável**. Bônus decisivo: **composabilidade** para empilhar rendimentos no DeFi.
- **Verbatim quote:** > 
- **Verbatim quote 2:** > 

#### Insights para o MUTAV Pulse (da entrevista I2)

1. **Liquidez via mercado secundário pode ser o destravador da fila de resgate.** Diferente da I1 (que aceita lockup com racional), este perfil rejeita bloqueio — mas aceita **se houver saída pelo secundário**. → As **shares do vault são tokenizadas (OZ fungible)**; expor/permitir **transferência e negociação** dessas shares vira uma feature de liquidez de primeira classe, não detalhe técnico. A fila surplus-gated protege a solvência; o secundário dá a saída.
2. **Composabilidade é argumento de venda, não só arquitetura.** Ele aprova explicitamente poder **empilhar rendimentos** usando a posição no resto do DeFi. → Posicionar as shares como **ativo componível** (colateral/LP em outros protocolos Stellar) amplia o apelo para o investidor DeFi-native.
3. **Confiança = time + tração + prova social** (complementa a I1, que pesava auditabilidade própria). Nem todo investidor audita contrato sozinho. → O frontend precisa comunicar **quem é o time e seu histórico**, **TVL** e **sinais de prova social/indicação**, lado a lado com a prova de solvência on-chain.
4. **"De onde vem a renda" é a pergunta-chave — de novo.** Assim como a I1 cobrou transparência do *R* do RWA, aqui o gatilho de desconfiança é APY que não se explica. → Reforça que o **lastro real (prêmios de fiança)** deve ser visível e o APY ancorado de forma **conservadora e explicável** (convergente com o insight #4 da I1).

### Investor takeaways

<!-- TODO: 2–3 bullets. -->

---

## How discovery shaped MUTAV

<!-- TODO: tie findings back to product decisions — e.g. "investors needed verifiable solvency → the /earn/transparency proof layer". This is the strongest signal for judges that discovery was real, not decorative. -->
