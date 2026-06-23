# Selo de Solvência ZK — Plano (MUTAV × Stellar Hacks: Real-World ZK)

> Hackathon: **Stellar Hacks: Real-World ZK** (DoraHacks / Stellar Development Foundation).
> Prazo de submissão: **29/06/2026**. Entregável: repositório (e vídeo de demo — _fora do escopo deste plano por decisão do time_).
> Palco: a página **`frontend/app/earn/transparency/page.tsx`** deste repo — front **Investidor** (dark + âmbar). Público = quem investe no fundo (holder de `mtvR`).

---

## 1. A ideia em uma frase

Hoje o `SolvencyChip` da página de transparência diz _"o fundo está coberto"_ — mas só prova com o que está **público na chain**. Vamos adicionar um **selo provado matematicamente (ZK)** que cobre **também o que é secreto**: dinheiro no banco (A), a lista de clientes (B) e o conjunto de carteiras (C). O investidor ganha um **"✅ coberto, e é verdade comprovada — suas cotas estão lastreadas"** sem que o fundo exponha nenhum desses dados.

É o padrão clássico **proof of reserves / proof of solvency** (o que exchanges sérias adotaram pós-FTX): provar solvência aos depositantes/investidores sem abrir a carteira inteira.

## 2. O que é ZK aqui (linguagem de gente)

Provar que uma afirmação é **verdadeira sem mostrar os dados por trás**. Analogia: provar que você tem +18 acendendo uma **luz verde**, sem entregar o RG. A prova é gerada **fora da chain** (no nosso computador) e **verificada on-chain** num contrato Soroban (barato e rápido — Protocolo 25/26, host functions BN254/Groth16).

## 3. A conta única

As três peças alimentam **uma só prova**:

```
Reservas (vault on-chain + A banco + C carteiras)  ≥  Obrigações (B lista de garantias)
```

- **Sai público (a "luz verde"):** apenas `solvente = sim/não` + uma **faixa** de saúde (ex.: "≥100%", "≥120%") + carimbo de momento/bloco. Nunca os valores.
- **Fica secreto:** valores das reservas, onde está o dinheiro, composição/estratégia, e a lista de clientes (LGPD).

## 4. Escolha técnica

**RISC Zero** como caminho principal: escreve-se a regra em Rust comum (somar, conferir assinatura, comparar) e a **Nethermind já tem o verificador pronto no Soroban** (`NethermindEth/stellar-risc0-verifier`, Groth16/BN254). **Plano B:** Circom + protótipo open-source de "private payments" do Stellar (já traz circuito de Merkle pronto para a peça B).

---

## 5. As três peças (A / B / C)

### Peça A — Reserva no banco (dinheiro fora da blockchain)

- **O que é:** parte da reserva está num banco; o explorer não vê. A peça A inclui esse dinheiro na prova sem mostrar extrato/conta.
- **Como aplicar:** uma **chave-oráculo do banco** assina `(saldo, data, id_conta)`. _(No hackathon a chave é nossa/simulada; em produção = banco ou Open Finance Brasil.)_ O *prover* passa `saldo + assinatura` como entrada secreta; o *guest* verifica a assinatura e soma nas reservas; o `solvency_attestor` confere o **frescor** (data recente).
- **Riscos:** "lixo entra, lixo sai" (confia no oráculo) → frescor + Open Finance no futuro; assinatura falsa/chave vazada → proteção/rotação de chave; **é simulado no hackathon → declarar no README**.
- **Por que importa:** sem A, só se prova o que está on-chain — mas a reserva real do MUTAV mora parte no banco. A torna a prova **fiel à realidade**.

### Peça B — Lista de garantias / clientes (as obrigações) 👑

- **O que é:** a lista de contratos/clientes (dado sensível) fica **secreta**, mas prova-se que a conta usou a **lista inteira e verdadeira** — sem omitir ninguém.
- **Como aplicar:** o `registry` passa a publicar um **Merkle root** das garantias ativas (atualizado quando garantia entra/sai; mantém "só `policy` escreve"). O *guest* recebe a lista privada, **recalcula a root** e exige que **bata** com `registry.guarantees_root()`; então soma as obrigações. O `solvency_attestor` **reconfere a root ao vivo** contra o `registry`.
- **Riscos:** trapaça por omissão → **a root impede** (lista adulterada não bate); root desatualizada → atualizar a cada mudança + checar frescor; Merkle no RISC Zero dá trabalho → **plano B Circom**.
- **Por que importa:** é a **joia da coroa** — transforma "número digitado" em **prova anti-trapaça**, protege o cliente (LGPD), e abre caminho pra **despoluir a `GuaranteeTable`** de dado sensível sem perder confiança.

### Peça C — Conjunto de carteiras do fundo (o "mapa")

- **O que é:** o fundo guarda dinheiro em vários endereços; soma-se o saldo de todos **sem revelar quais** são.
- **Como aplicar:** um **snapshot assinado** dos saldos por carteira (chave-oráculo de custódia) entra como entrada secreta; o *guest* soma; os endereços nunca saem públicos. _(Versão forte: prova de controle, não só de saldo.)_
- **Riscos:** provar só saldo ≠ provar controle → controle real fica como melhoria; endereços inferíveis por valores muito específicos → agregar em faixas; **escopo → C é stretch goal** (primeiro a cortar).
- **Por que importa:** protege a **estrutura/segurança** do fundo e permite reserva **distribuída** sem expor o mapa.

**Resumo:** **A** torna a prova **real** (inclui o banco), **B** torna a prova **honesta** (anti-trapaça + protege cliente), **C** torna a prova **completa** (todas as carteiras, mapa escondido).

---

## 6. Cronograma (22/06 → 29/06)

| Dia | Foco | Saída |
|---|---|---|
| **1 (22/06)** | **De-riscar a ferramenta.** Instalar RISC Zero + clonar `stellar-risc0-verifier`; rodar exemplo prova→verificação no testnet; confirmar protocolo P25/26 no nosso deploy. | "consigo verificar uma prova qualquer no Stellar". |
| **2** | **Ancorar a lista (B).** Adicionar Merkle root das garantias ativas no `registry`; expor `guarantees_root()`. | "selo" da lista existe on-chain, sem expor a lista. |
| **3** | **Cérebro (guest + prover).** Guest Rust: entradas privadas A/C + lista B; verifica assinaturas, confere Merkle, soma e compara; emite `solvente/faixa/root/momento`. Prover lê o testnet real + injeta atestações simuladas. | `cargo run` gera prova real a partir do vault. |
| **4** | **Verificador on-chain.** Contrato `solvency_attestor`: chama o verificador RISC Zero, checa `root` ao vivo contra `registry` + frescor; grava `last_attestation`. | a "luz verde" mora on-chain e é re-verificável. |
| **5** | **Selo no dashboard.** `ZkSolvencyBadge` na `transparency/page.tsx` (acima do `SolvencyChip`), linguagem de investidor, blockchain escondido atrás de "ver detalhes". | selo funcional lendo o attestor. |
| **6** | **Robustez + cenário.** Seed (vault + banco + N garantias) → prova → selo verde; testar anti-trapaça (alterar garantia → prova rejeitada → vermelho); se A+B sólidos, puxar **C**. | fluxo redondo e à prova de ataque. |
| **7 (29/06)** | **README + submissão + buffer.** Documentar arquitetura, real vs. simulado, como rodar/reconferir; limpar repo; submeter. | submissão entregue. |

**MVP garantido:** **A + B** já é projeto premiável. **C** é stretch (primeiro a cortar).

## 7. O selo no dashboard (front Investidor)

Componente `ZkSolvencyBadge`, acima do `SolvencyChip` em `transparency/page.tsx`:

```
🟢  RESERVA PROVADA · LASTRO VERIFICADO
As reservas do fundo cobrem 100%+ das garantias emitidas —
provado de forma independente, sem expor carteiras nem dados de clientes.
Suas cotas mtvR estão lastreadas.
Conferido: 22/06/2026 14:32
[ Re-verificar agora ]   [ Como funciona? ▾ ]
```

**UX (abstrair blockchain):**
- Visão padrão sem hashes/endereços/ledger — só estado (🟢/🔴), frase em PT, faixa, data amigável.
- "Como funciona? ▾" → 3 bullets simples, sem jargão de ZK.
- "Detalhes técnicos" (dentro do drawer) → link do `solvency_attestor` no explorer + botão "re-verificar você mesmo" (preserva o princípio de auto-verificação que a página já tem).
- Estado vermelho honesto se a prova falhou/expirou ("cobertura não confirmada no momento").

**Encaixe técnico:**
- `lib/contracts.ts`: novo read `reads.solvencyAttestation()` → lê `last_attestation`.
- `ZkSolvencyBadge` segue o padrão `loading`/`error` da página; visual Precision Brutalism (front Investidor) + skill `impeccable`.
- ⚠️ `frontend/AGENTS.md`: esta versão do Next.js tem breaking changes — **ler `node_modules/next/dist/docs/` antes de codar o componente**.

## 8. Riscos gerais
1. **Toolchain travar** → Dia 1 dedicado a de-riscar; plano B Circom + protótipo do Stellar.
2. **Atestações simuladas** (banco/carteira) → normal e aceito; declarado no README (real = matemática da prova + verificação on-chain).
3. **Escopo** → A+B é o MVP; C é cortável sem quebrar a demo.

## 9. Componentes a construir (mapa)
- `registry`: + `guarantees_root()` (Merkle root das garantias ativas).
- **guest program** (RISC Zero, Rust, off-chain): a conta da solvência + verificação de assinaturas + Merkle.
- **prover service** (off-chain): lê testnet + injeta atestações; gera a prova.
- `solvency_attestor` (Soroban): verifica a prova, checa root/frescor, grava `last_attestation`.
- `frontend`: `ZkSolvencyBadge` + read `solvencyAttestation()` na `transparency/page.tsx`.

## 10. Referências
- Protocolo 25 "X-Ray" (BN254/Groth16 on-chain): https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25
- 5 casos reais de ZK (SDF): https://stellar.org/blog/developers/5-real-world-zero-knowledge-use-cases
- Verificador RISC Zero da Nethermind no Soroban: https://stellar.org/blog/developers/risc-zero-verifier
- Docs oficiais de ZK no Stellar: https://developers.stellar.org/docs/build/apps/zk
- Hackathon: https://dorahacks.io/hackathon/stellar-hacks-zk/detail
