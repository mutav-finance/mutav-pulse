# Customer Discovery — MUTAV

Evidence for the PULSO Hackathon "customer discovery & validation" criterion. The hackathon requires **≥3 interviews with evidence** (the intro text said 5 — we target 5). MUTAV's reserve is funded by **investors**, so discovery focuses on the investors who fund a solvency-gated rental-guarantee reserve for yield.

> **How to use this doc:** fill each interview block from your real notes. Anonymize names if needed (role + profile type is enough for evidence). Keep at least one verbatim quote per interview — quotes are the most persuasive evidence. Then update the **Summary of findings** below and copy the punchy version into the README's "Customer discovery" section.

## Status

| Segment | Target | Done | Evidence |
|---|---|---|---|
| Investors (DeFi / yield) | 5 | 4 done (I1, I2, I3, I4) — complete for this submission | below |

## Methodology

- **Goal:** validate that investors will fund a solvency-gated, real-world-backed (rental-guarantee) reserve on Stellar for yield, and that verifiable onchain solvency is what earns their trust.

## Summary of findings

Across four investor interviews — from DeFi-native, contract-auditing sophisticates to community/operations profiles — the dominant signal is consistent: **trust hinges on transparency of the backing and the team, not on the APY.** Every investor probes *where the yield comes from* and judges a protocol by what they can verify themselves — verifiable TVL, a **doxxed team** with real track record, auditable contracts, and plausible engineering in the docs. **Three of four (I1, I2, I3) anchor yield to risk/realism and treat unexplained high APY as a red flag**; the fourth (I4), less sophisticated, is yield-hungry — a useful caution against attracting mercenary capital. Lockup is accepted when the rationale is clear and documented (I1, I3) or when a secondary-market exit exists (I2); only the hack-averse I4 demands instant exit. This validates MUTAV's core bet: **surface verifiable on-chain solvency, the real backing (fiança premiums), and the doxxed team — and frame the surplus-gated redemption queue as solvency protection, not friction.**

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

### Interview I3

- **Who:** **Growth Manager de um grupo de empresas Web3** (do protocolo para devs a um braço de mídia/marketing). Usa o mercado descentralizado **quase diariamente**; **~70% dos investimentos em DeFi**. **Já buildou em projetos RWA** e investe na categoria. Perfil DeFi-native e sofisticado, que lê documentação e avalia a engenharia por trás do yield. *(identidade anonimizada — perfil de segmento mantido como evidência.)*
- **Date / format:** <!-- TODO: data --> · entrevista remota, semi-estruturada (gravada)
- **Key responses:**
  - **Contexto:** DeFi quase diariamente; ~70% do portfólio em DeFi.
  - **Confiança:** analisa **vários sinais** — **backers** por trás, se o projeto passou por **programa de aceleração / hackathon**, e **principalmente se o time é doxado** (conhece o time, vê as redes). Além disso, **lê os documentos** para validar se a **engenharia por trás é plausível** para gerar aquele yield.
  - **RWA:** acha **fenomenal** — **já buildou em projetos RWA**, é fã e investidor da categoria.
  - **Lockup / liquidez:** se o produto **bate com o research dele, não vê problema** em deixar bloqueado. Já fez **lockup de tokens** e em **projetos RWA**.
  - **Faixa de yield:** raciocina por **risco-retorno** — o **APY tem que fazer sentido com o risco**. Retorno baixo ⇒ espera APY baixo, e não alocaria muito capital nesse caso; alto risco pode justificar APY alto. O gatilho de desconfiança é **APY que não condiz com o risco**.
- **Reaction to the solvency gate / queue:** não perguntado diretamente, mas o perfil **alinha** com o MUTAV: aceita lockup quando "bate com o research" (como a I1) e valoriza **validar a engenharia nos documentos**. → A **fila surplus-gated** é aceitável desde que o racional esteja **documentado e auditável**, e a **solvência verificável on-chain** é exatamente o tipo de prova de engenharia que ele procura.
- **Yield expectation:** **proporcional ao risco** — APY tem que casar com o risco assumido; desconfia de retorno que não se explica pelo risco. Perfil racional (não *yield-hungry*), convergente com I1/I2 e em contraste com I4.
- **Verbatim quote:** > "Principalmente se o time é doxado. Se eu conheço o time ali, consigo ver as redes, isso me dá mais confiança. E também analiso os documentos para ver se a engenharia por trás é plausível para obter aquele yield."
- **Verbatim quote 2:** > "O APY tem que fazer sentido com o risco. Eu não alocaria muito capital para algo cujo retorno seja baixo."

#### Insights para o MUTAV Pulse (da entrevista I3)

1. **Time doxado + backers + hackathon/aceleração = confiança.** Sinais que o MUTAV **já tem**: está no **PULSO Hackathon**, com **time doxado** (Draau/Julia, com GitHub/LinkedIn) e integrações com nomes do ecossistema. → **Surfar** esses sinais no frontend e no README (selo de hackathon, identidade do time, parcerias) — convergente com I2 (#3) e I4 (#1).
2. **Ele lê os docs para validar a engenharia do yield.** Quer confirmar que "a engenharia por trás é plausível" para entregar o yield. → A **documentação técnica** (whitepaper, `docs/`, modelo econômico) e a explicação clara de **de onde vem o yield** (prêmios de fiança + estratégia DeFindex) são argumento de venda — convergente com o "de onde vem a renda" de I1/I2.
3. **Lockup aceito quando bate com o research** (igual à I1). → Reforça que a **fila surplus-gated** funciona para o investidor sofisticado **se o racional de solvência estiver explícito e verificável** — comunicar como proteção, com os números on-chain à mão.
4. **Risco-retorno proporcional — não é *yield-hungry*.** Rejeita APY desproporcional ao risco. → **3 de 4** investidores (I1, I2, I3) ancoram o yield no risco/realidade; apenas I4 persegue número alto. Mantém forte a estratégia do MUTAV de **APY conservador e explicável** lastreado nos prêmios de fiança.

### Interview I4

- **Who:** Profissional de cripto **Community Manager / moderador**, atuando para empresas internacionais (Ásia — Vietnã e Índia) e brasileiras; no mercado desde 2021, dedicado em tempo integral há ~2 anos. **Investidor DeFi ativo.** Perfil ligado à operação/comunidade de projetos, com confiança ancorada em reputação e prova social mais do que em auditoria técnica própria. *(identidade anonimizada — perfil de segmento mantido como evidência.)*
- **Date / format:** <!-- TODO: data --> · entrevista remota, semi-estruturada (gravada)
- **Key responses:**
  - **Contexto:** investe em DeFi atualmente.
  - **Confiança:** começa pela **pesquisa do protocolo** — quer ver **TVL bom** (dinheiro de fato investido) e, sobretudo, **nomes reais por trás**: pessoas que já criaram projetos com nome no mercado, **com LinkedIn e histórico verificável**, "não apenas avatares". Empresas que mexem com dinheiro precisam mostrar trabalho sério. Soma-se a isso **parcerias com grandes empresas do ramo DeFi** como gerador de confiança.
  - **RWA:** acha **bom** — vê que abre diversas possibilidades, um ativo gerando receita gradualmente e viabilizando o yield on-chain. **Nunca teve contato** com um protocolo desse tipo antes (categoria nova para ele, mas bem recebida).
  - **Lockup / liquidez:** **analisa antes** porque bloqueio "causa estranheza". Prioriza poder **resgatar o mais rápido possível** — o medo explícito é **hack**: se algo acontecer, quer tirar o dinheiro rápido. Não curte lockup, **mas aceita prazo maior se o yield justificar**.
  - **Faixa de yield:** referência de mercado ~**10% a.a.**; **~20% em stablecoin (USDC)** já soa "muito bom". Não levantou o APY alto como sinal de alerta — perfil mais *yield-hungry* que I1/I2.
- **Reaction to the solvency gate / queue:** não perguntado diretamente. O perfil **tensiona** com a fila de resgate, mas por um motivo distinto de I1/I2: aqui a motivação para liquidez é **medo de hack/risco de segurança**, não composabilidade. Sinal: a fila surplus-gated e a **solvência verificável on-chain** devem ser comunicadas como **redução de risco** ("seu capital permanece coberto e auditável"), atacando diretamente esse medo.
- **Yield expectation:** **~20% a.a. em stablecoin** é atrativo (vs. ~10% de referência); **não trata APY alto como red flag**, ao contrário de I1/I2 — divergência de perfil relevante.
- **Verbatim quote:** > "Que ele tenha nomes por trás… pessoas que já criaram outros projetos que têm nome no mercado e que não são apenas avatares… tem que ter pessoas que têm LinkedIn, que mostram que estão num trabalho sério."
- **Verbatim quote 2:** > "Busco protocolos que eu possa estar retirando dinheiro o mais rápido possível. Porque se rola algum hack, eu gosto de ter a possibilidade de resgatar o meu dinheiro o mais rápido possível."

#### Insights para o MUTAV Pulse (da entrevista I4)

1. **Identidade real do time é proxy de confiança — "nomes, não avatares".** Este perfil não audita contratos sozinho (ao contrário da I1); confia em **pessoas com LinkedIn e histórico** e em **parcerias com nomes do ramo**. → O frontend deve **expor a identidade e o track record do time** e destacar **integrações/parcerias** (Stellar, OpenZeppelin, DeFindex) como sinais de credibilidade — convergente com o insight #3 da I2 (confiança = time + tração + prova social).
2. **O gatilho de liquidez aqui é medo de hack, não composabilidade.** Diferente de I1 (aceita lockup com racional) e I2 (quer saída via secundário), I4 quer saída rápida por **segurança**. → A **solvência verificável e contratos auditados** devem ser enquadrados como **mitigação de risco de segurança**, e a fila surplus-gated comunicada como proteção — não como atrito.
3. **RWA é bem recebido mesmo por quem nunca usou.** Categoria nova para ele, mas a tese de "receita real gerando yield" soa atraente de imediato. → Há **demanda latente** para o produto fora do nicho que já conhece RWA; o onboarding deve **explicar o lastro de forma simples**.
4. **Sensibilidade ao yield é mais alta e menos sofisticada — risco de atrair capital "mercenário".** 20% soa ótimo sem acionar o alerta que I1/I2 levantaram. → Manter o **APY ancorado e explicável** protege a tese de confiança-via-lastro e evita atrair só capital que persegue número alto — reforça o insight #4 de I1 e I2 sob um ângulo oposto (aqui o risco é o investidor *não* desconfiar de APY alto).

### Investor takeaways

- **Trust = verifiable backing + team, not APY.** All four ranked transparency (TVL, doxxed team, auditable contracts, plausible engineering) above headline yield. Surface on-chain solvency, the real cash-flow backing, and the team identity front-and-center.
- **Anchor yield conservatively and explain its source.** "Where does the yield come from" recurred in every interview; unexplained high APY erodes trust with the sophisticated majority (3 of 4) even as it tempts the yield-hungry (I4). The fiança-premium backing is the argument, not an inflated number.
- **The surplus-gated queue is accepted when framed as solvency protection** — with a clear, documented rationale (I1, I3). A secondary-market exit for the tokenized vault shares (I2) would widen appeal to liquidity-first investors, and verifiable solvency directly addresses the hack-aversion that drives I4's liquidity demand.

---

## How discovery shaped MUTAV

- **Investors needed to verify the backing → the `/earn/transparency` proof layer.** It surfaces a live solvency chip, coverage metrics, and the full guarantee registry, with every number linking back to its on-chain source — answering I1's "is the *R* of RWA actually real?" directly.
- **"Where does the yield come from" recurred (I1, I2, I3) → the docs + economic model make the yield engine explicit** (fiança premiums + the DeFindex strategy), and the APY is anchored conservatively rather than inflated — so the number survives the scrutiny of risk-return investors instead of triggering it.
- **Doxxed-team + backer/hackathon signals drive trust (I2, I3, I4) → the README and frontend surface the team identity, the PULSO hackathon, and integrations** (Stellar, OpenZeppelin, DeFindex) as first-class credibility signals — "names, not avatars."
- **Lockup is acceptable with a clear rationale (I1, I3); liquidity-first investors want an exit (I2, I4) → the surplus-gated redemption queue is communicated as an anti-bank-run solvency guarantee**, not hidden friction, with tokenized shares laying the groundwork for a future secondary-market exit.
