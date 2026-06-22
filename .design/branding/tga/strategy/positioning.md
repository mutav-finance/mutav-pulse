# Positioning
**TGA — Token de Garantia de Aluguel**
Strategy Phase · April 2026

---

## 1. Positioning Statements

### 1.1 Dashboard Imobiliárias — Para Lucas (Proprietário)

> Para proprietários de imóveis que precisam de uma garantia locatícia que realmente funcione quando o inquilino para de pagar, a TGA é a garantidora que executa automaticamente o repasse — sem formulário, sem espera, sem intermediário — porque seu mecanismo de liquidação é programático e verificável, não uma promessa feita por uma pessoa numa central de atendimento.

**Anatomy:**
- **Audience:** Proprietários de imóveis (45–55, Curitiba e demais capitais do Sul e Sudeste)
- **Need:** Uma garantia que cumpra o que diz — com velocidade, sem burocracia
- **Category:** Garantidora locatícia (redefined from "seguro-fiança" to "infraestrutura de garantia")
- **Benefit:** Liquidação automática do repasse ao proprietário, sem intervenção humana no processo
- **Reason to believe:** Mecanismo de liquidação programático registrado on-chain — o pagamento é executado pelo protocolo, não decidido por um operador

### 1.2 Dashboard Investidor — Para Ana (Investidora)

> Para investidoras cripto-nativas que buscam yield real verificável com colateral específico e auditável, a TGA é o único protocolo na Solana com exposição ao mercado brasileiro de garantias locatícias — um ativo de R$36B com fluxo de caixa denominado em BRL, integração legal via Lei do Inquilinato e histórico de execução onchain — porque nenhum produto DeFi existente combina especificidade geográfica, mecanismo auditável e equipe identificada na mesma estrutura.

**Anatomy:**
- **Audience:** Investidoras DeFi/Solana (25–35, cripto-nativas, allocators de RWA)
- **Need:** Yield real com colateral específico, verificável, diferenciado — não mais um pool genérico
- **Category:** Protocolo RWA (Real World Assets) na Solana
- **Benefit:** Exposição exclusiva ao yield do mercado de garantias locatícias do Brasil, verificável onchain em tempo real
- **Reason to believe:** Arquitetura de smart contracts auditável, integração com boleto e Lei do Inquilinato, equipe nomeada com founders identificados — nenhum concorrente Solana tem esta especificidade

---

## 2. Mapa de Posicionamento

### 2.1 Mercado Brasileiro de Garantias Locatícias

**Eixos:**
- **X:** Produto-serviço (promessa de terceiro) ←→ Infraestrutura (mecanismo programático)
- **Y:** Opaco / sem auditoria ←→ Verificável / registro público

```
                        VERIFICÁVEL / AUDITÁVEL
                                  |
                                  |          Dashboard Imobiliárias
                                  |          (target)
                                  |
    PRODUTO-SERVIÇO ──────────────┼──────────────── INFRAESTRUTURA
                                  |
      Porto Seguro   Creditas     |
      SulAmérica                  |
          CredPago*               |
                                  |
                       OPACO / SEM AUDITORIA

* CredPago plotado no histórico; brand atualmente disqualificada por falha de execução.
```

**Leitura:**
- Porto Seguro e SulAmérica: produto-serviço + opaco. Máxima tradição, zero auditabilidade. Confiança por inércia regulatória, não por evidência.
- Creditas: produto-serviço um pouco mais moderno, ainda opaco. Cresceu 280% por default de confiança, não por diferencial de mecanismo. Beatable.
- CredPago (histórico): produto-serviço + progressivo em UX, porém sem auditabilidade real. Falhou exatamente onde o eixo Y importa.
- **Dashboard Imobiliárias:** o único player que combina infraestrutura programática com registro verificável. O quadrante superior-direito está vazio.

### 2.2 Mercado Solana RWA / DeFi

**Eixos:**
- **X:** Genérico (yield sem especificidade geográfica ou setorial) ←→ Específico (colateral real com tese setorial definida)
- **Y:** Acessível (retail + pequeno alocador) ←→ Institucional (acreditado, alto mínimo)

```
                        INSTITUCIONAL / ALTO MÍNIMO
                                  |
                    Maple Finance |
                      Ondo Finance|
                                  |
    GENÉRICO ─────────────────────┼──────────────── ESPECÍFICO
                                  |
     Crib Connect / SolNest       |         Dashboard Investidor
     (projetos hackathon)         |         (target)
                      Centrifuge  |
                                  |
                        ACESSÍVEL / RETAIL

```

**Leitura:**
- Ondo e Maple: institucional + genérico (Treasuries, private credit US-centric). Alta confiança, zero especificidade local. Não competem diretamente.
- Centrifuge: específico por tipo de ativo mas genérico geograficamente, não-Solana. Mais próximo estruturalmente; não é concorrente de mercado.
- Crib Connect / SolNest / projetos hackathon: acessível + genérico. Nenhum tem camada de garantia real; nenhum tem especificidade brasileira.
- **Dashboard Investidor:** acessível (retail cripto-nativo pode entrar via TGA) + específico (mercado brasileiro de garantias locatícias). Quadrante inferior-direito está vazio.

---

## 3. Análise do Espaço em Branco

### 3.1 Por Que O Espaço Está Vazio (Dashboard Imobiliárias)

O quadrante "infraestrutura verificável" não existia como categoria no Brasil antes de 2024. As garantidoras tradicionais são juridicamente serviços, não protocolos — a auditabilidade real exigiria publicação de reservas e registros de desembolso que nenhum player incumbente tem interesse em publicar. TGA pode ocupar este espaço por construção técnica (onchain = audita por design) e por postura de marca (publicar o log antes que qualquer regulador exija).

**Barreiras à entrada no espaço em branco:**
1. Integração técnica real (smart contract + boleto + Lei do Inquilinato) — não replicável por incumbentes em time de hackathon
2. Decisão estratégica de publicar registros — incumbentes têm incentivo contrário
3. Confiança de fundadores identificados com histórico real — não disponível para projetos anônimos

**Risco de ocupação:** Creditas é o concorrente com maior capacidade de entrar neste quadrante. Sua limitação: stack legada, sem experiência onchain, e incentivo organizacional para manter opacidade. Janela estimada de 18–24 meses antes de uma oferta concorrente credível.

### 3.2 Por Que O Espaço Está Vazio (Dashboard Investidor)

Nenhum protocolo Solana tem tese Brasil-específica com garantias locatícias como colateral. O vácuo existe porque:
1. A maioria dos projetos RWA começa nos EUA (regulatório, capital, familiaridade)
2. O mercado de garantias locatícias brasileiro não é óbvio para quem não conhece a Lei do Inquilinato
3. Boleto como trilho de pagamento requer parceria operacional no Brasil — barreira real de entrada

**Risco:** Um hackathon Colosseum poderia produzir um clone. A diferença é que TGA é o clone com integração legal real, não o projeto com deck e sem contrato.

### 3.3 Posicionamento Único Consolidado

TGA não se define por contra-posição. TGA não menciona o que outros falharam em fazer. A marca se define pelo que entrega:

**Para Lucas:** O protocolo que paga — não que promete pagar.
**Para Ana:** O único yield de garantia locatícia brasileira na Solana — verificável, específico, auditável.
**Para ambos:** A garantidora que cumpre.

---

## 4. Constrainte de Posicionamento (Reforço)

Este documento não usa falhas de concorrentes como alavanca de promessa. Competidores são plotados no mapa para identificar espaço em branco — não para construir posição por contraste. TGA se posiciona pelo que é, não pelo que outros não são.

A única exceção permitida: ao falar com Lucas sobre o registro verificável, o fato de que nenhum concorrente publica registros de desembolso é contexto educacional (por que isso importa), não alavanca de confiança (eles falharam, nós não). A diferença é sutil mas mandatória.
