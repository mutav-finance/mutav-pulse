# Selo de Solvência ZK — Plano (MUTAV × Stellar Hacks: Real-World ZK)

> Hackathon: **Stellar Hacks: Real-World ZK** (DoraHacks / Stellar Development Foundation).
> Entregável: repositório (e vídeo de demo — _fora do escopo deste plano por decisão do time_).
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
- **Por quê:** a peça B é uma **árvore Merkle com Poseidon** (no nosso caso o circuito **recompõe a raiz inteira** de todas as folhas — ver 6.2 — não inclusão de 1 folha) — e o repo `stellar-private-payments` já traz esses blocos prontos (`main.circom` + **Poseidon**, dos quais reusamos o hashing da árvore), a ferramenta **`circom2soroban`** (converte chave de verificação/prova/inputs em Rust para o contrato) e o **`coinutils`** (reconstrói a Merkle tree). E o `soroban-examples/groth16_verifier` é um **verificador Groth16 oficial pronto** pra usar de base.
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
| **`stellar/soroban-examples` → `groth16_verifier`** | Exemplo Groth16 oficial — mas **BLS12-381 + soroban-sdk 25** (curva e SDK errados p/ nós, que precisamos de BN254 por causa do Poseidon). Útil só como referência do formato `proof.json`/`verification_key.json`/`public.json`. | Referência de formato; **NÃO** é a base do attestor. |
| **`NethermindEth/stellar-private-payments`** (docs: `nethermindeth.github.io/stellar-private-payments`) | **`contracts/circom-groth16-verifier`** — verificador Groth16 **BN254 + sdk 26** usando host functions `env.crypto().bn254()` (`g1_mul`/`g1_add`/`pairing_check`); **`build.rs` + crate `circuit-keys`** = o "circom2soroban" (lê `verification_key.json` via `VERIFIER_VK_JSON` → embute `vk.rs`). Circuitos `merkleProof.circom`/`merkleTree.circom` + `poseidon2/`. | **Base real do `solvency_attestor`** (Stage 4); peça **B** do circuito; padrão de VK embutida. _Confirmado no de-risco._ |
| **`stellar/rs-soroban-poseidon`** (crate `soroban-poseidon`) | Poseidon/Poseidon2 on-chain prontos (`poseidon_hash::<3, Bn254Fr>`); **BN254 = circomlib por construção** (sponge igual ao `poseidon.circom`). Apontado pela própria doc do soroban-sdk. | **Raiz Poseidon-Merkle on-chain no `registry`** (Stage 1), batendo com o circuito sem alinhar constantes à mão. _Roda na nossa VM — confirmado no de-risco._ |
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
- Peça **B**: o circuito recebe **todas as folhas ativas** `(id, obrigação)` e **recompõe a raiz inteira** (depth-8, Poseidon), **exigindo `== guarantees_root`**; soma **todas** as `obrigações` → `obligations`. _Anti-omissão: omitir uma folha muda a raiz, que então não bate com a on-chain. **Não** usa provas de inclusão por-folha (que não impediriam omissão)._
- Peça **A**: `bank_balance` + assinatura EdDSA do oráculo-banco (chave pública embutida). Verifica a assinatura → soma em `reserves`.
- Peça **C** (stretch): `wallet_balances[]` + assinatura EdDSA do oráculo-custódia. Soma em `reserves`.

**Restrição principal (a prova):**
```
reserves = vault_stable_assets + bank_balance + Σ wallet_balances
assert  reserves * 10000 >= obligations * ratio_bps
```
Sem saída secreta: os sinais públicos já carregam a afirmação ("a esta root, neste estado de vault, a esta faixa: solvente").

### 6.3 Contrato `solvency_attestor` (Soroban, base = `circom-groth16-verifier` da Nethermind — BN254)
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
A chave de verificação (`verification_key.json`) é **embutida no contrato** em tempo de build via o `build.rs` + crate `circuit-keys` da Nethermind (env `VERIFIER_VK_JSON` → `vk.rs`); não é parâmetro — garante que só provas do nosso circuito passam.

### 6.4 `registry` — novo `guarantees_root()` (peça B)
- Manter um acumulador **Poseidon-Merkle** das garantias ativas (folha = `Poseidon(id, obrigação)`, com `obrigação = monthly_amount*(months_covered-months_used)`; o `active` é implícito porque só ativas viram folha), atualizado nas transições (criar/expirar/quitar) — respeitando "só `policy` escreve". Hash on-chain via crate **`soroban-poseidon`** (`poseidon_hash::<3, Bn254Fr>`), que bate com o `poseidon.circom` do circomlib usado no circuito.
- Expor `guarantees_root() -> BytesN<32>` (leitura pública). É o "selo da lista" que o circuito e o attestor cruzam.
- Manter a árvore reconstrutível off-chain (o `coinutils` do private-payments serve de referência) para o prover montar a **lista completa de folhas** (na ordem de `active_ids()`) que o circuito recompõe.
- **Profundidade:** `TREE_DEPTH = 5` (32 garantias) no MVP — tem que casar com o circuito. Trocável depois via upgrade coordenado (registry + circuito/VK + attestor), sem mover fundos.
- **⚠️ Escalabilidade (v2, pós-MVP):** o desenho atual é **full-recompute O(n)** por `put()` e por prova — não escala além de ~milhares de garantias. Para 100k+ (ex.: 200k contratos em ~5 anos), migrar para **Merkle Sum Tree incremental**: cada nó guarda a soma das obrigações abaixo (o **total fica na raiz**, lido O(1)) e cada escrita atualiza só o caminho da folha (O(profundidade), não O(n)). A prova ZK passa a provar o lado das **reservas** contra o total comprovado na raiz. A Nethermind tem um `smt/` de referência. A modularidade (registry trocável + `upgrade()`) permite essa migração sem mover dinheiro.

### 6.5 Prover service (off-chain, Node/TS + snarkjs)
1. Lê on-chain: garantias + `guarantees_root`, `vault.stable_assets`.
2. Junta privados: atestação de banco assinada (A), snapshot de carteiras assinado (C), **lista completa de folhas** (B).
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

## 8. Stages — Trilha A (Circom)

Organização **vertical** (um grupo de stages por componente), cada stage quebrado em
sub-passos pequenos e independentes — montagem tipo lego, peça por peça. Sem datas: a
ordem é por dependência, não por relógio. Avançar só quando o **critério de saída** do
sub-passo fecha.

**Por que um Stage 0 antes do vertical:** o maior risco não é nenhum componente — é a
toolchain (`circom2soroban` + `pairing_check` BN254 + host function `poseidon`) não rodar
no nosso deploy de testnet. Vertical puro só descobre isso no attestor (4º componente).
O Stage 0 é um spike fino e descartável que prova a viabilidade da Trilha A **antes** de
investir em registry/circuito. Depois dele, os componentes são legos independentes.

**Gate serial único:** só **prover → attestor** é estritamente sequencial (o attestor
precisa da VK que sai do circuito). Todo o resto paraleliza: o **front (Stage 5) pode
começar mockado** desde já; **registry (Stage 1)** e **circuito (Stage 2)** são testáveis
isoladamente (root on-chain sozinha; prova local com snarkjs sem chain).

---

### Stage 0 — De-risco da Trilha A (spike fino) ✅ CONCLUÍDO (Opção B: confirmação local, sem testnet)
- **0.1** ✅ Toolchain instalada: **circom 2.2.3**, **snarkjs 0.7.6**, Node 25, **Stellar CLI 26.0.0**,
  Rust 1.96 + wasm32. (circom era um binário pré-compilado em `~/.cargo/bin`.)
- **0.2** ✅ Circuito trivial (`c = a*b`) → snarkjs (bn128) → `proof.json`/`public.json` →
  `snarkjs groth16 verify` = **OK**. Esteira de proving validada na máquina.
- **0.3** ✅ BN254 na VM de teste: mini-crate com `soroban-sdk 26.1.0` →
  `env.crypto().bn254()`. `cargo test` passou: aritmética de curva (`g1_is_on_curve`,
  `g1_add`, `g1_mul` → `G+G == 2G`) **e o `pairing_check`** — o núcleo do Groth16 —
  executando de fato (testado por dois lados: `e(G1,G2) ≠ 1` e bilinearidade
  `e(G1,G2)·e(-G1,G2) = 1`, com o gerador G2 no formato Ethereum `c1||c0` do host).
  **Sem feature especial.** _(deploy real na testnet → adiado p/ Stage 4)_
- **0.4** ✅ Poseidon on-chain: crate **`soroban-poseidon`** (`poseidon_hash::<3, Bn254Fr>`)
  roda na VM de teste e **bate com o vetor canônico do circomlib** — `poseidon([1,2])` ==
  `0x115cc0f5…7189a` (cross-check empírico, não só a palavra do README). Isso confirma a
  invariante central do Stage 1: raiz on-chain == raiz do circuito. _(host fn crua:
  `CryptoHazmat::poseidon2_permutation`, feature `hazmat-crypto` — mas usamos o crate.)_
- **Saída alcançada:** Trilha A viável e provada localmente — toolchain, `pairing_check` e
  Poseidon↔circomlib todos com evidência. **Continuam abertos (adiados p/ Stage 4, por
  decisão da Opção B):** (a) a *emenda* completa — pegar um `proof.json` real do snarkjs e
  verificá-lo dentro de um contrato (vendorizar a peça Nethermind); (b) deploy na testnet;
  (c) **medir o custo real de instruções** (o "~40% do budget" é do plano, ainda não medido).
- **Artefatos do spike:** em `scratchpad/zk-spike/` (descartável, fora do repo).

> **Correções que o de-risco trouxe ao plano (ver Seções 5 e 6):**
> 1. Verificador-base = `circom-groth16-verifier` da **Nethermind** (BN254 + sdk 26), **não** o
>    `groth16_verifier` oficial (esse é BLS12-381 + sdk 25 — curva e SDK errados p/ nós).
> 2. "circom2soroban" = `build.rs` + crate `circuit-keys` da Nethermind (lê `verification_key.json`
>    via env `VERIFIER_VK_JSON` → gera `vk.rs` embutido).
> 3. Poseidon on-chain = crate `soroban-poseidon` (org Stellar), circomlib-compatível.

### Stage 1 — Peça B: âncora da lista no `registry` ✅ CONCLUÍDO
- **1.1** ✅ Folha = `Poseidon(id, obrigação)`, `obrigação = monthly_amount*(months_covered-months_used)`
  (mesma conta da `coverage_required`). Árvore binária de **profundidade fixa 8** (até 256
  garantias), folhas à esquerda, sibling ausente = 0, pai = `Poseidon(esq, dir)`. Ordem das
  folhas = ordem de `active_ids()`. Só garantias **ativas** são folhas.
  _Simplificação consciente:_ não filtra `paid_until > now` (conta todas as ativas) → obrigação
  provada é limite superior = lado seguro; na demo (garantias em dia) bate exato.
- **1.2** ✅ `registry` recalcula a raiz a cada `put()` via `soroban-poseidon`
  (`poseidon_hash::<3, Bn254Fr>`), respeitando o writer-gating.
- **1.3** ✅ `guarantees_root() -> BytesN<32>` (no `interfaces` + `RegistryClient`, leitura pública).
- **1.4** ✅ Reconstrução off-chain em `prover/merkle.mjs` (circomlibjs): `computeRoot` sobre a
  **lista completa de folhas** (ordem de `active_ids()`). Sem provas de inclusão por-folha — a
  anti-omissão vem de recompor a raiz inteira (ver 6.2). `prover/derisk-merkle.mjs` imprime as
  raízes de referência (n=2, n=3) usadas nos cross-checks.
- **1.5** ✅ Cross-check on-chain `==` off-chain: teste `root_matches_offchain_circomlibjs` afirma
  que a raiz do `registry` (soroban-poseidon) bate com a do circomlibjs — **duas implementações
  Poseidon independentes concordando**. Testes: `cargo +stable-x86_64-pc-windows-gnu test -p registry --lib` (4/4).
- **Saída:** selo da lista on-chain, reconstruível off-chain, sem expor a lista. _Demoável sozinho._

> **Nota de ambiente (Windows):** esta máquina não tem o linker MSVC; o `rust-toolchain.toml`
> força MSVC e o build padrão quebra. **Tudo roda com o toolchain gnu** (que tem linker funcional):
> - **Testes de host:** `cargo +stable-x86_64-pc-windows-gnu test -p <crate> --lib` (só a lib —
>   `cargo test --workspace` estoura "export ordinal too large" no **cdylib nativo**).
> - **Build wasm p/ deploy:** `rustup target add wasm32v1-none --toolchain stable-x86_64-pc-windows-gnu`
>   uma vez, depois `RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu stellar contract build`. **Não
>   precisa de MSVC** — o "export ordinal too large" é específico do cdylib nativo, não do alvo wasm.
>   _(Confirmado no Stage 2.5: os 7 wasm buildaram e o registry deployou na testnet.)_

### Stage 2 — Circuito `solvency.circom`
Incremental: cada sub-passo compila e prova localmente (snarkjs, sem chain).
- **2.0** ✅ Elo do Poseidon verificado: `circuits/leaf_check.circom` (circomlib `Poseidon(2)`)
  produz `Poseidon(0,600)` == `0x247c2fa2…` — **idêntico** à folha do `registry` (soroban-poseidon)
  e à off-chain (circomlibjs). Os três Poseidon batem.
- **2.1** ✅ `circuits/solvency_b.circom`: recompõe a raiz depth-5 das 32 folhas `(id, obrigação, ativo)`
  e soma as obrigações. **Verificado:** raiz do circuito == raiz do `registry` (`0x2fc574f6…`) e soma = 1200
  no caso n=2. ~32k constraints (prova leve). Folha inativa = 0; árvore perfeita (sem padding ímpar).
  _Binding anti-omissão:_ a raiz é sinal público; o attestor (Stage 4) confere `== guarantees_root` on-chain.
- **2.2** ✅ `circuits/solvency.circom`: raiz amarrada (`b.root === guarantees_root`) + reservas
  (`vault_stable_assets`) + comparação de faixa (`reserves*10000 >= obligations*ratio_bps`, via
  `GreaterEqThan(200)`). **Verificado:** aceita solvente; rejeita insolvente, raiz adulterada e
  faixa 120% insuficiente.
- **2.3** ✅ peça A: `EdDSAPoseidonVerifier` (circomlib) verifica a assinatura do oráculo-banco
  sobre `M = Poseidon(saldo, nonce)` → soma `bank_balance` às reservas (saldo nunca sai). Públicos:
  `nonce`, `oracle_Ax/Ay`. **Verificado:** banco cobre sozinho / combinado aceitam; insolvente e
  saldo adulterado pós-assinatura rejeitam. Gerador de assinatura: `circuits/gen_input.mjs` (chave
  do oráculo simulada/fixa). Circuito ~41k constraints.
- **finale** ✅ Prova Groth16 real gerada e **verificada off-chain** (`snarkjs groth16 verify` = OK):
  powers-of-tau 2^16 → `solvency_final.zkey` → `proof.json`/`public.json`/`verification_key.json`.
  A VK vai embutida no attestor (Stage 4).
- **2.4** _(stretch — primeiro a cortar)_ peça C: somar `wallet_balances[]` assinados (mesmo padrão da A).
- **Saída:** ✅ MVP **A+B** completo — `proof.json`/`public.json`/`verification_key.json` gerados.

### Stage 2.5 — Deploy na testnet (pré-requisito do Stage 3 e do Stage 4) ✅ CONCLUÍDO
Tudo até aqui rodou **local** (o Stage 0 adiou o deploy de propósito). Tanto o prover
(Stage 3 lê estado on-chain real) quanto o attestor (Stage 4 mora on-chain) precisam de
um deploy vivo. Por isso esta etapa entra **antes** do Stage 3.

**Decisão (registry-only):** o core de 2026-06-22 (`vault`/`policy`/`registry`) já estava
vivo e seedado, mas o **admin é `GBE3QZQS…` — chave que não temos** (só `mutav-test` =
`GCG2L74G…`), então o `registry` vivo (sem `guarantees_root`) **não pôde ser `upgrade()`-ado**.
Saída escolhida: deployar um **registry novo** sob nosso admin e **reusar o vault existente**
(que só precisamos *ler* — `stable_assets` é permissionless). O registry novo fica desacoplado
da `policy` antiga (writer = nós); seed direto via `put()`.

- **2.5.1** ✅ Build wasm com `stellar contract build` (NÃO `cargo build --release` — spec-shaking
  da soroban-sdk 26.1). ⚠️ **Windows:** **NÃO precisa de MSVC** — basta o toolchain **gnu** com o
  target wasm instalado: `rustup target add wasm32v1-none --toolchain stable-x86_64-pc-windows-gnu`
  e então `RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu stellar contract build`. (O gnu tem linker
  funcional p/ os proc-macros do host; o "export ordinal too large" só afeta o **cdylib nativo** de
  `cargo test --workspace`, não o target `wasm32v1-none`. A nota anterior de que "o build wasm
  precisa de MSVC" estava errada — corrigida aqui.)
- **2.5.2** ✅ Deploy do `registry` novo (admin = `mutav-test`) + `set_writer(mutav-test)`. Vault
  reusado (sem re-wire). **Contract IDs (testnet):**
  - **REGISTRY (novo, com `guarantees_root`):** `CCIIYG572C5HUJKPDVSCYWAJNUUPOEEXKXIURA3DMAPTMETE3HHOU3FC`
  - **VAULT (existente, read-only):** `CCOIGCO7JTWHFDAEQPXDONJABKFP2PQ5OBDUWHBTASUPZ4EMFCNESICO`
  - **USDC SAC:** `CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6`
  - (registry/vault/policy antigos administrados por `GBE3QZQS…`; o `solvency_attestor` entra no Stage 4.)
- **2.5.3** ✅ Seed: 4 garantias `[0,1,2,3]` espelhando o livro real do deploy antigo
  (obrigações 18.000 + 12.000 + 4.800 + 14.400 = **49.200 USDC**). Vault `stable_assets` =
  **50.420 USDC** → solvente (~**102,5%**).
- **2.5.4** ✅ Cross-check ao vivo: `guarantees_root()` on-chain ==
  `prover/merkle.mjs` off-chain == `0x2962a3bbb708bf58677b8a51a5605c5d45d03c87981e11b790606ff4d3342231`.
- **Saída:** ✅ registry novo deployado e semeado na testnet; `guarantees_root` + `stable_assets`
  prontos para o prover (Stage 3) e para o attestor (Stage 4).

### Stage 3 — Prover service (Node/TS + snarkjs) ✅ 3.1–3.3 (3.4 aguarda Stage 4)
Implementado em **`prover/prove.mjs`** (`npm run prove [bank_balance] [ratio_bps]`).
- **3.1** ✅ Lê on-chain (testnet, via `stellar contract invoke`): `registry.active_ids()` +
  `get(id)` por garantia + `guarantees_root()`; `vault.stable_assets()`.
- **3.2** ✅ Monta o witness — B: folhas reais na ordem de `active_ids`, padding a 2^5; recompõe a
  raiz off-chain (`merkle.mjs`) e **fail-fast se != raiz on-chain**. A (opção B): atestação de banco
  **simulada** com saldo, assinada EdDSA-Poseidon por chave-oráculo fixa (mesma do `gen_input.mjs`).
- **3.3** ✅ `snarkjs groth16 fullProve` (wasm + `solvency_final.zkey` do Stage 2) → `prover/out/`
  `proof.json`/`public.json`/`input.json` de **dados reais**. Re-verifica off-chain + confere os
  públicos (`root`==on-chain, `stable`==on-chain, `ratio`). _Run real:_ obrig. 49.200 + reservas
  vault 50.420 + banco sim. 10.000 → **cobertura 122,8%**, prova verde.
- **3.4** ✅ Submeter ao attestor: `prover/encode-for-soroban.mjs` converte `proof.json`/`public.json`
  → proof 256 bytes + públicos; `attest` submetido na testnet (tx `355bee82…`) → `last_attestation`
  gravado. `nonce` agora é timestamp (frescor). _(gate de integração fechado.)_
- **Saída:** ✅ prova de dados reais gerada **e verificada on-chain**.

### Stage 4 — `solvency_attestor` (Soroban) ✅ CONCLUÍDO
Crate `contracts/solvency-attestor`. Attestor na testnet:
**`CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT`** (admin=`mutav-test`,
wired p/ registry `CCIIYG57…` + vault `CCOIGCO7…` + oráculo fixo).
- **4.0** ✅ Vendorizado enxuto o `circom-groth16-verifier` da Nethermind (BN254): `build.rs`
  embute a `verification_key.json` como consts (só `serde_json`+`num-bigint`, sem `ark-*`/`circuit-keys`).
- **4.1** ✅ `groth16_verify` (BN254 `pairing_check`) com VK **embutida**. **Emenda fechada:** teste de
  host verifica a prova REAL do snarkjs DENTRO do contrato (item aberto do Stage 0).
- **4.2** ✅ Cross-check live **implícito**: `attest` lê `registry.guarantees_root()` e
  `vault.stable_assets()` AO VIVO e usa como públicos — prova feita p/ outro estado não verifica.
- **4.3** ✅ Frescor: `nonce` = timestamp assinado pelo oráculo; janela `WINDOW_SECS=3600`
  (`StaleProof`/`ProofFromFuture`). **Pinning da pubkey-oráculo** em storage (`set_oracle`) fecha a
  forja da peça A (findings 1 e 2 da revisão do Stage 3).
- **4.4** ✅ Grava/expõe `last_attestation -> Option<Attestation{solvent, ratio_bps, ledger, ts}>`.
  _Atestação real gravada:_ `{solvent:true, ratio_bps:10000, ledger:3249257, ts:1782260148}`.
- **4.5** ✅ Deploy + submit real na testnet. **Custo medido:** ~**37,96M instruções** (~38% do budget
  de 1 tx — bate com a estimativa "~40%"); `minResourceFee` ≈ 45.424 stroops. _(últimos 2 itens
  abertos do Stage 0 — deploy e medição de custo — fechados.)_
- **Saída:** ✅ a "luz verde" mora on-chain e é re-verificável; ciclo prover→attestor completo.

### Revisão Stages 0–4 — fixes aplicados (pós-ciclo completo)
Revisão cruzada com o caminho inteiro vivo. Consistência end-to-end de encoding/ordem
**provada** pelo `attest` real passar on-chain; binding ao estado vivo **provado adversarialmente**
(nonce/ratio errados → `InvalidProof`; controle → `Ok`). Fixes aplicados e **deployados via
`upgrade()`** (registry `CCIIYG57…` + attestor `CBYXNYYZ…`; storage preservado, root e
`last_attestation` intactos):
- **#1 [ALTO soundness]** `registry.put()` rejeita a `2^TREE_DEPTH+1`-ésima garantia ativa.
  Acima da capacidade o `compute_root` truncava a raiz silenciosamente (folhas excedentes somem
  da raiz E da soma → solvência falsa por omissão). Agora falha alto. _(Confirmado empírico:
  `root(33)==root(32)`.)_ Teste `put_rejects_beyond_tree_capacity`.
- **#2 [MED]** attestor estende TTL do instance storage (`attest` + setters) — selo não expira.
- **#3** attestor emite evento `attested` (confirmado on-chain) — front reage sem polling.
- **#4** nota: VK embutida e `solvency_final.zkey` são um par — manter em sincronia (Stage 7).
- **#7** prover satura `obligationOf` (>=0) igual ao `leaf()` do registry.
- _Não aplicados:_ **#5** (replay — não é vetor: idempotente vs estado vivo) e **#6** (embutir
  oráculo na VK — exige circuito + regenerar VK/zkey/prova + redeploy; stretch).
- **Observação (escala):** o recompute O(n) por `put` (seção 6.4) já pesa perto da capacidade 32
  (no teste, 32 puts cumulativos estouram o budget do `Env`); o cap (#1) limita o pior caso. A
  migração para Merkle Sum Tree incremental (6.4) continua sendo o caminho v2.

### Stage 5 — Selo no dashboard (front Investidor)
Pode começar **mockado** em paralelo aos stages 1–4.
- **5.1** `reads.solvencyAttestation()` em `lib/contracts.ts` (mock até o attestor estar live).
- **5.2** `ZkSolvencyBadge` acima do `SolvencyChip` em `transparency/page.tsx` (padrão
  `loading`/`error`; Precision Brutalism; skill `impeccable`).
- **5.3** Drawer "Como funciona?" + estado vermelho honesto + "re-verificar você mesmo".
- ⚠️ ler `node_modules/next/dist/docs/` **antes** de codar (breaking changes — ver `frontend/AGENTS.md`).
- **Saída:** selo funcional lendo o attestor.

### Stage 6 — Robustez + cenário anti-trapaça
- **6.1** Seed (vault + banco + N garantias) → prova → verde.
- **6.2** Anti-trapaça: alterar uma garantia → root muda → prova rejeitada → vermelho.
- **6.3** Se A+B sólidos: ativar a peça **C** (carteiras).
- **Saída:** fluxo redondo, à prova de ataque.

### Stage 7 — README + entrega
- Arquitetura, real vs. simulado, como rodar/reconferir; limpar repo; submeter.

---

**MVP garantido:** **A + B** (Stages 0–6 sem o sub-passo C) já é projeto premiável.
**C** é stretch — primeiro a cortar, sem quebrar a demo.

## 9. O selo no dashboard (front Investidor)

Componente `ZkSolvencyBadge`, acima do `SolvencyChip` em `transparency/page.tsx`:

```
🟢  RESERVA PROVADA · LASTRO VERIFICADO
As reservas do fundo cobrem 100%+ das garantias emitidas —
provado de forma independente, sem expor carteiras nem dados de clientes.
Suas cotas mtvR estão lastreadas.
Conferido: há poucos minutos
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
- `circuits/solvency.circom`: recomposição da raiz Merkle inteira (B) + EdDSA (A/C) + soma + comparação de faixa. _(reusa o Poseidon/hashing do `main.circom` do private-payments + `eddsaposeidon` do circomlib.)_
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

---

## Anexo A — Spike de de-risco do Stage 0 (código + resultados)

> Registro do de-risco da Opção B (confirmação local, sem testnet). O código rodou em
> `scratchpad/zk-spike/` (descartável, deletado após documentação). Reproduzível com a
> toolchain abaixo. Tudo passou.

### A.0 Toolchain confirmada
| Ferramenta | Versão |
|---|---|
| circom | 2.2.3 (binário pré-compilado em `~/.cargo/bin`) |
| snarkjs | 0.7.6 |
| Node | 25.9.0 |
| Stellar CLI | 26.0.0 |
| Rust / target | 1.96.0 / `wasm32v1-none` |
| soroban-sdk (no teste) | 26.1.0 |
| soroban-poseidon | 26.0.0 (`git: stellar/rs-soroban-poseidon`) |

### A.1 Parte 1 — esteira circom + snarkjs gera/valida prova BN254

Circuito trivial (`multiplier.circom`):
```circom
pragma circom 2.0.0;
template Multiplier() {
    signal input a;   // privado
    signal input b;   // privado
    signal output c;  // público
    c <== a * b;
}
component main = Multiplier();
```

Pipeline (curva bn128 = BN254):
```bash
circom multiplier.circom --r1cs --wasm --sym -p bn128
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau -e="..."
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau
snarkjs groth16 setup multiplier.r1cs pot12_final.ptau multiplier_0000.zkey
snarkjs zkey contribute multiplier_0000.zkey multiplier_final.zkey -e="..."
snarkjs zkey export verificationkey multiplier_final.zkey verification_key.json
echo '{"a":"3","b":"11"}' > input.json
node multiplier_js/generate_witness.js multiplier_js/multiplier.wasm input.json witness.wtns
snarkjs groth16 prove multiplier_final.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
```

**Resultado:** `public.json = ["33"]` (só o público `c` vazou; `a=3`/`b=11` ficaram secretos)
e `[INFO] snarkJS: OK!` — prova válida.

### A.2 Parte 2 — BN254 + Poseidon on-chain no soroban-sdk 26.1.0

`Cargo.toml` (deps):
```toml
[dependencies]
soroban-sdk = "26.1.0"
soroban-poseidon = { git = "https://github.com/stellar/rs-soroban-poseidon" }
[dev-dependencies]
soroban-sdk = { version = "26.1.0", features = ["testutils"] }
```

Testes (`src/lib.rs`, resumidos) — 3 verificações independentes:
```rust
// (1) Aritmética de curva: gerador na curva + G + G == 2*G.
#[test] fn bn254_curve_ops_work() {
    let env = Env::default(); let bn = env.crypto().bn254();
    let g = g1_gen(&env);                       // gerador G1 = (1, 2)
    assert!(bn.g1_is_on_curve(&g));
    let two = Bn254Fr::from_u256(U256::from_u32(&env, 2));
    assert_eq!(bn.g1_add(&g, &g).to_array(), bn.g1_mul(&g, &two).to_array());
}

// (2) pairing_check (núcleo do Groth16) executa de fato — testado por dois lados.
#[test] fn bn254_pairing_check_real() {
    let env = Env::default(); let bn = env.crypto().bn254();
    let (g1g, g2g, neg) = (g1_gen(&env), g2_gen(&env), g1_neg_gen(&env));
    assert!(!bn.pairing_check(vec![&env, g1g.clone()], vec![&env, g2g.clone()])); // e(G1,G2) != 1
    assert!( bn.pairing_check(vec![&env, g1g, neg], vec![&env, g2g.clone(), g2g])); // bilinearidade = 1
}

// (3) Poseidon on-chain bate com o vetor canônico do circomlib: poseidon([1,2]) com t=3.
#[test] fn poseidon_matches_circomlib() {
    use soroban_poseidon::poseidon_hash;
    let env = Env::default();
    let h = poseidon_hash::<3, Bn254Fr>(&env, &vec![&env, U256::from_u32(&env,1), U256::from_u32(&env,2)]);
    let expected = U256::from_be_bytes(&env,
        &Bytes::from(bytesn!(&env, 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a)));
    assert_eq!(h, expected); // == 7853200120776062878684798364095072458815029376092732009249414926327459813530
}
```

Detalhes de codificação confirmados no de-risco (úteis p/ Stage 1/4):
- **G1**: `x || y`, cada `Fp` big-endian (32+32 = 64 bytes).
- **G2**: formato Ethereum do host → `c1 || c0` por `Fp2`, cada `Fp` big-endian (4×32 = 128 bytes).
  (ref. `soroban-env-host` `crypto/bn254.rs`, ~linhas 99-102.)
- **-G1** de `(1,2)` = `(1, p-2)`, `p` = primo do campo base BN254.
- Poseidon: `CryptoHazmat::poseidon2_permutation` é a host fn crua (feature `hazmat-crypto`);
  usamos o crate `soroban-poseidon` (`poseidon_hash::<3, Bn254Fr>`), que casa com o circomlib.

**Resultado (`cargo test`):**
```
running 3 tests
test bn254_curve_ops_work ... ok
test poseidon_matches_circomlib ... ok
test bn254_pairing_check_real ... ok
test result: ok. 3 passed; 0 failed
```

### A.3 Conclusão do de-risco
Trilha A viável e provada localmente (toolchain, `pairing_check`, Poseidon↔circomlib).
**Em aberto p/ Stage 4** (por decisão da Opção B): a emenda completa (prova real do snarkjs
verificada dentro de um contrato Soroban), deploy na testnet, e a medição real do custo de
instruções (o "~40% do budget" segue não-medido).
