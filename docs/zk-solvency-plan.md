# Selo de Solvência ZK — Plano (MUTAV × Stellar Hacks: Real-World ZK)

> Hackathon: **Stellar Hacks: Real-World ZK** (DoraHacks / Stellar Development Foundation).
> Prazo de submissão: **29/06/2026**. Entregável: repositório (e vídeo de demo — _fora do escopo deste plano por decisão do time_).
> Palco: a página **`frontend/app/earn/transparency/page.tsx`** deste repo — front **Investidor** (dark + âmbar). Público = quem investe no fundo (holder de `mtvR`).

---

## 1. A ideia em uma frase

Hoje o `SolvencyChip` da página de transparência diz _"o fundo está coberto"_ — mas só prova com o que está **público na chain**. Vamos adicionar um **selo provado matematicamente (ZK)** que cobre **também o que é secreto**: dinheiro no banco (A), a lista de clientes (B) e o conjunto de carteiras (C). O investidor ganha um **"✅ coberto, e é verdade comprovada — suas cotas estão lastreadas"** sem que o fundo exponha nenhum desses dados.

É o padrão clássico **proof of reserves / proof of solvency** (o que exchanges sérias adotaram pós-FTX): provar solvência aos depositantes/investidores sem abrir a carteira inteira.

## 2. O que é ZK aqui (linguagem de gente)

Provar que uma afirmação é **verdadeira sem mostrar os dados por trás**. Analogia: provar que você tem +18 acendendo uma **luz verde**, sem entregar o RG. A prova é gerada **fora da chain** (no nosso computador) e **verificada on-chain** num contrato Soroban (barato e rápido — Protocolo 25/26, host functions BN254 + Poseidon).

## 3. A conta única

As três peças alimentam **uma só prova**:

```
Reservas (vault on-chain + A banco + C carteiras)  ≥  Obrigações (B lista de garantias) × faixa
```

- **Sai público (a "luz verde"):** apenas `solvente = sim/não` + uma **faixa** de saúde (ex.: "≥100%", "≥120%") + carimbo de momento/ledger. Nunca os valores.
- **Fica secreto:** valores das reservas, onde está o dinheiro, composição/estratégia, e a lista de clientes (LGPD).

---

## 4. Escolha técnica — **ATUALIZADA** (Trilha A = Circom, recomendada)

A pesquisa mudou a recomendação. Existem **peças prontas da Stellar/Nethermind em Circom** que cobrem quase exatamente o nosso caso — em especial a peça B (lista ancorada num Merkle root), que é a parte mais difícil e a mais importante.

### ✅ Trilha A — Circom + snarkjs + circom2soroban (RECOMENDADA)
- **Por quê:** a peça B é **prova de inclusão em Merkle tree** — e o repo `stellar-private-payments` já tem **exatamente** esse circuito (`main.circom`: recebe siblings + root, recomputa a root e exige igualdade), com **Poseidon**, a ferramenta **`circom2soroban`** (converte chave de verificação/prova/inputs em Rust para o contrato) e o **`coinutils`** (reconstrói a Merkle tree). E o `soroban-examples/groth16_verifier` é um **verificador Groth16 oficial pronto** pra usar de base.
- **Custo:** escrever verificação de assinatura (peças A/C) em Circom dá mais trabalho → usamos **EdDSA do circomlib** (`eddsaposeidon`), amigável a circuito. (A chave-oráculo é nossa/simulada de qualquer jeito, então não precisa ser a ed25519 da Stellar.)

### 🅱️ Trilha B — RISC Zero (FALLBACK)
- Escreve-se a regra em Rust comum; **Nethermind tem o verificador pronto** (`stellar-risc0-verifier`). Bom se a parte de assinatura no Circom travar.
- **Contras:** provas mais pesadas (precisa Docker), verificador maior/não auditado (router + timelock + emergency-stop), e **a Merkle teria que ser escrita no guest** (não vem pronta).

> **Decisão:** começar pela Trilha A. O Dia 1 é só de-riscar essa trilha de ponta a ponta. Se a assinatura no Circom virar gargalo, A/C caem para um esquema de **commitment Poseidon** (mais simples) ou migramos só essa parte para a Trilha B.

### Nota de orçamento on-chain ⚠️
Verificar **uma** prova Groth16 custa ~**40 milhões de instruções (~40% do budget de uma transação no testnet)**. Logo: **uma prova agregada por atestação** (não várias), e o `solvency_attestor` precisa ser enxuto. Nosso design já é assim (uma prova cobre A+B+C).

---

## 5. Materiais da Stellar/Nethermind reaproveitáveis

| Repo / recurso | O que nos dá | Onde usamos |
|---|---|---|
| **`stellar/soroban-examples` → `groth16_verifier`** | Verificador Groth16 oficial em Soroban; fluxo Circom2 (circom 2.2.1) + snarkjs; arquivos `proof.json` / `verification_key.json` / `public.json`; traduzido do verifier Solidity auto-gerado. | Base do nosso `solvency_attestor`. |
| **`NethermindEth/stellar-private-payments`** (docs: `nethermindeth.github.io/stellar-private-payments`) | Circuito `main.circom` de **inclusão em Merkle** (root + siblings → recomputa e compara), **Poseidon**, **`circom2soroban`** (JSON→Rust), **`coinutils`** (reconstrução de Merkle), proving via **snarkjs em WASM no browser**, contratos Pool + ASP membership. | Peça **B** quase inteira; pipeline de proving; padrão de commitment. |
| **`NethermindEth/stellar-risc0-verifier`** | Verificador RISC Zero (VerifierRouter por seletor de 4 bytes, Groth16Verifier, TimelockController, EmergencyStop). `verify(journal, image_id, seal)`. _Não auditado._ | Trilha B (fallback). |
| **`jayz22/soroban-examples` (branch `p25-preview`)** | Exemplos de uso das host functions P25 (BN254 `g1_add`/`g1_mul`/`pairing_check`, Poseidon `poseidon`/`poseidon2`). | Referência de API on-chain. |
| **`indextree/ultrahonk_soroban_contract`** | Verificador UltraHonk (caminho Noir/barretenberg). | Só se um dia formos de Noir. |
| **soroban-sdk migration docs** — `_migrating/v25_bn254` e `v25_poseidon` (docs.rs) | API exata de BN254 e Poseidon no contrato. | Implementação do `solvency_attestor`. |
| **`stellar-protocol` CAP-0074 / CAP-0075** | Spec das host functions de curva/hash. | Referência de fundo. |

---

## 6. Arquitetura técnica detalhada

### 6.1 Fluxo de ponta a ponta
```
[on-chain]                 [off-chain: prover service (Node/TS + snarkjs)]            [on-chain]
registry.guarantees_root() ─┐
vault.stable_assets()       ─┤→ monta witness (lista+paths B, banco+sig A,           solvency_attestor.attest(proof, public)
                             │   carteiras+sig C) → snarkjs groth16 fullProve ──────→  ├─ verifica Groth16 (BN254 pairing_check)
atestações assinadas (A,C) ─┘   → proof.json + public.json                            ├─ confere public.root == registry.guarantees_root() (live)
                                                                                       ├─ confere public.stable == vault.stable_assets() (live)
                                                                                       ├─ confere frescor (ledger/timestamp)
                                                                                       └─ grava last_attestation{solvent, faixa, ledger, ts}
                                                                                                  │
frontend lê reads.solvencyAttestation() ←──────────────────────────────────────────────────────┘
```

### 6.2 Especificação do circuito (`solvency.circom`) — MVP A+B
**Sinais públicos** (entram na verificação on-chain):
- `guarantees_root` — Poseidon-Merkle root das garantias ativas (lido do `registry`).
- `vault_stable_assets` — lido do `vault` (amarra a prova ao estado on-chain atual).
- `ratio_bps` — faixa provada em basis points (ex.: `10000` = 100%, `12000` = 120%).
- `nonce` — anti-replay / frescor.

**Sinais privados** (witness, nunca saem):
- Peça **B**: para cada folha, `(id, amount, status)` + `path_siblings[]` + `path_indices[]`. O circuito recomputa a root com Poseidon e **exige `== guarantees_root`**; soma `amount` das ativas → `obligations`.
- Peça **A**: `bank_balance` + assinatura EdDSA do oráculo-banco (chave pública embutida). Verifica a assinatura → soma em `reserves`.
- Peça **C** (stretch): `wallet_balances[]` + assinatura EdDSA do oráculo-custódia. Soma em `reserves`.

**Restrição principal (a prova):**
```
reserves = vault_stable_assets + bank_balance + Σ wallet_balances
assert  reserves * 10000 >= obligations * ratio_bps
```
Sem saída secreta: os sinais públicos já carregam a afirmação ("a esta root, neste estado de vault, a esta faixa: solvente").

### 6.3 Contrato `solvency_attestor` (Soroban, base = `groth16_verifier`)
```
attest(proof: Proof, public: PublicInputs) -> ()
  1. groth16_verify(VK_EMBUTIDA, proof, public)            // BN254 pairing_check
  2. require(public.guarantees_root == registry.guarantees_root())   // anti-prova-velha/forjada
  3. require(public.vault_stable_assets == vault.stable_assets())    // amarra ao estado atual
  4. require(env.ledger().timestamp() - public.nonce_ts <= JANELA)   // frescor
  5. storage.set(last_attestation, Attestation{ solvent: true, ratio_bps: public.ratio_bps,
                                                ledger: env.ledger().sequence(), ts })

last_attestation() -> Attestation                          // read público p/ o frontend
```
A chave de verificação (`verification_key.json`) é **embutida no contrato** via `circom2soroban` (não é parâmetro — garante que só provas do nosso circuito passam).

### 6.4 `registry` — novo `guarantees_root()` (peça B)
- Manter um acumulador **Poseidon-Merkle** das garantias ativas (folha = `Poseidon(id, amount, status)`), atualizado nas transições (criar/expirar/quitar) — respeitando "só `policy` escreve".
- Expor `guarantees_root() -> BytesN<32>` (leitura pública). É o "selo da lista" que o circuito e o attestor cruzam.
- Manter a árvore reconstrutível off-chain (o `coinutils` do private-payments serve de referência) para o prover montar os `path_siblings`.

### 6.5 Prover service (off-chain, Node/TS + snarkjs)
1. Lê on-chain: garantias + `guarantees_root`, `vault.stable_assets`.
2. Junta privados: atestação de banco assinada (A), snapshot de carteiras assinado (C), lista + Merkle paths (B).
3. `snarkjs groth16 fullProve` (ou WASM no browser, como no private-payments) → `proof.json` + `public.json`.
4. Submete `solvency_attestor.attest(proof, public)`.
> No hackathon, as chaves-oráculo (banco/custódia) são nossas e o serviço pode rodar via cron/manual. README deixa explícito o que é simulado.

---

## 7. As três peças (A / B / C)

### Peça A — Reserva no banco (dinheiro fora da blockchain)
- **O que é:** parte da reserva está num banco; o explorer não vê. A peça A inclui esse dinheiro na prova sem mostrar extrato/conta.
- **Como aplicar (técnico):** chave-oráculo do banco assina `(saldo, data, id_conta)` com **EdDSA-Poseidon (circomlib)**. O circuito **verifica a assinatura** e soma o saldo em `reserves`. O `solvency_attestor` confere frescor.
- **Riscos:** "lixo entra, lixo sai" (confia no oráculo) → frescor + Open Finance no futuro; assinatura/chave → proteção/rotação; **simulado no hackathon → declarar no README**. Se a EdDSA no circuito travar: cair para **commitment Poseidon** do saldo (mais simples).
- **Por que importa:** sem A, só se prova o on-chain — mas a reserva real do MUTAV mora parte no banco. A torna a prova **fiel à realidade**.

### Peça B — Lista de garantias / clientes (as obrigações) 👑
- **O que é:** a lista de contratos/clientes (sensível) fica **secreta**, mas prova-se que a conta usou a **lista inteira e verdadeira** — sem omitir ninguém.
- **Como aplicar (técnico):** `registry.guarantees_root()` (Poseidon-Merkle) publicado on-chain. O circuito de inclusão (reuso do `main.circom` do private-payments) recomputa a root a partir das folhas+siblings privados e **exige `== guarantees_root`**; soma as obrigações. O `solvency_attestor` **reconfere a root ao vivo**.
- **Riscos:** trapaça por omissão → **a root impede** (lista adulterada não bate); root desatualizada → atualizar a cada transição + frescor.
- **Por que importa:** **joia da coroa** — transforma "número digitado" em **prova anti-trapaça**, protege o cliente (LGPD), e abre caminho pra **despoluir a `GuaranteeTable`** sem perder confiança. **É a peça com mais código pronto pra reusar.**

### Peça C — Conjunto de carteiras do fundo (o "mapa")
- **O que é:** soma o saldo de várias carteiras **sem revelar quais** são.
- **Como aplicar (técnico):** snapshot assinado (EdDSA) dos saldos por carteira entra como witness; o circuito soma em `reserves`; endereços nunca saem. (Versão forte: prova de controle, não só saldo.)
- **Riscos:** saldo ≠ controle → controle fica como melhoria; endereços inferíveis por valores específicos → agregar em faixas; **escopo → stretch goal** (primeiro a cortar).
- **Por que importa:** protege estrutura/segurança e permite reserva **distribuída** sem expor o mapa.

**Resumo:** **A** torna a prova **real** (inclui o banco), **B** torna a prova **honesta** (anti-trapaça + protege cliente), **C** torna a prova **completa** (todas as carteiras).

---

## 8. Cronograma (22/06 → 29/06) — Trilha A (Circom)

| Dia | Foco | Saída |
|---|---|---|
| **1 (22/06)** | **De-riscar a Trilha A de ponta a ponta.** Instalar circom 2.2.1 + snarkjs + Stellar CLI; clonar `soroban-examples/groth16_verifier` e `stellar-private-payments`; rodar o fluxo circuito→snarkjs→`circom2soroban`→deploy→`verify` no testnet; confirmar P25/26 e a curva (BN254/BLS12-381) no nosso deploy. | "verifico uma prova Groth16 minha no Stellar". |
| **2** | **Ancorar a lista (B).** `registry`: acumulador Poseidon-Merkle + `guarantees_root()`; espelhar reconstrução off-chain (ref. `coinutils`). | "selo" da lista on-chain, sem expor a lista. |
| **3** | **Circuito + prover.** `solvency.circom` (inclusão Merkle B + soma + comparação de faixa + EdDSA da peça A); prover em Node/TS com snarkjs lendo o testnet real + atestações simuladas. | `proof.json`/`public.json` gerados de dados reais do vault. |
| **4** | **`solvency_attestor`.** Base no `groth16_verifier`; VK embutida via `circom2soroban`; checagens live de `guarantees_root` e `stable_assets` + frescor; grava `last_attestation`. | "luz verde" mora on-chain e é re-verificável. |
| **5** | **Selo no dashboard.** `ZkSolvencyBadge` na `transparency/page.tsx` + read `solvencyAttestation()`. | selo funcional lendo o attestor. |
| **6** | **Robustez + cenário + peça C.** Seed (vault + banco + N garantias) → prova → verde; testar anti-trapaça (alterar garantia → prova rejeitada → vermelho); se A+B sólidos, adicionar **C** (carteiras). | fluxo redondo, à prova de ataque. |
| **7 (29/06)** | **README + submissão + buffer.** Arquitetura, real vs. simulado, como rodar/reconferir; limpar repo; submeter. | submissão entregue. |

**MVP garantido:** **A + B** já é projeto premiável. **C** é stretch (primeiro a cortar).

## 9. O selo no dashboard (front Investidor)

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
- "Detalhes técnicos" (no drawer) → link do `solvency_attestor` no explorer + botão "re-verificar você mesmo" (preserva a auto-verificação que a página já tem).
- Estado vermelho honesto se a prova falhou/expirou ("cobertura não confirmada no momento").

**Encaixe técnico:**
- `lib/contracts.ts`: novo read `reads.solvencyAttestation()` → `last_attestation`.
- `ZkSolvencyBadge` segue o padrão `loading`/`error` da página; visual Precision Brutalism (front Investidor) + skill `impeccable`.
- ⚠️ `frontend/AGENTS.md`: esta versão do Next.js tem breaking changes — **ler `node_modules/next/dist/docs/` antes de codar o componente**.

## 10. Riscos gerais
1. **Toolchain travar** → Dia 1 dedicado a de-riscar a Trilha A; fallback RISC Zero (Trilha B) para a parte que travar.
2. **Assinatura no circuito (A/C)** → fallback para commitment Poseidon, mais simples.
3. **Atestações simuladas** (banco/carteira) → normal e aceito; declarado no README (real = matemática da prova + verificação on-chain).
4. **Budget de instruções** → uma prova agregada por atestação; attestor enxuto (~40% do budget por pairing).
5. **Escopo** → A+B é o MVP; C é cortável sem quebrar a demo.

## 11. Componentes a construir (mapa)
- `contracts/registry`: + acumulador Poseidon-Merkle + `guarantees_root()`.
- `circuits/solvency.circom`: inclusão Merkle (B) + EdDSA (A/C) + soma + comparação de faixa. _(reusa `main.circom` do private-payments + `eddsaposeidon` do circomlib.)_
- `prover/` (Node/TS + snarkjs): lê testnet + atestações; gera `proof.json`/`public.json`; chama `attest`.
- `contracts/solvency_attestor` (Soroban, base `groth16_verifier`): verifica Groth16, checa root/stable/frescor, grava `last_attestation`.
- `frontend`: `ZkSolvencyBadge` + `reads.solvencyAttestation()` em `transparency/page.tsx`.

## 12. Referências
**Repos / templates**
- soroban-examples (groth16_verifier): https://github.com/stellar/soroban-examples/tree/main/groth16_verifier
- Stellar Private Payments (Nethermind): https://github.com/NethermindEth/stellar-private-payments — docs: https://nethermindeth.github.io/stellar-private-payments/
- RISC Zero verifier (Nethermind): https://github.com/NethermindEth/stellar-risc0-verifier
- P25 preview examples: https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview
- UltraHonk verifier (Noir): https://github.com/indextree/ultrahonk_soroban_contract
- soroban-sdk BN254: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html
- soroban-sdk Poseidon: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_poseidon/index.html

**Specs / blogs / docs**
- Prototyping Privacy Pools on Stellar (design): https://stellar.org/blog/ecosystem/prototyping-privacy-pools-on-stellar
- Verificador RISC Zero (passo a passo): https://stellar.org/blog/developers/risc-zero-verifier
- Protocolo 25 "X-Ray": https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25
- 5 casos reais de ZK (SDF): https://stellar.org/blog/developers/5-real-world-zero-knowledge-use-cases
- Docs oficiais de ZK no Stellar: https://developers.stellar.org/docs/build/apps/zk
- CAP-0074 (BN254): https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md
- Hackathon: https://dorahacks.io/hackathon/stellar-hacks-zk/detail

**Ferramentas ZK**
- Circom: https://docs.circom.io · snarkjs: https://github.com/iden3/snarkjs · circomlib: https://github.com/iden3/circomlib
- Noir: https://noir-lang.org/docs/ · RISC Zero: https://dev.risczero.com/
