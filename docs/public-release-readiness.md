# Prontidão para abrir o repositório (público)

> **Para quê:** `mutav-finance/mutav-pulse` precisa virar **público** para passar no gate de
> elegibilidade do PULSO Hackathon (issues **#13** *Make repo public* e **#12** *Secrets audit
> before going public*). Tornar público é **irreversível na prática**: uma vez exposto, qualquer
> segredo no histórico deve ser tratado como vazado. Por isso a auditoria veio **antes** de virar a chave.
>
> **Este documento é para revisão/decisão.** Os itens 🔴 exigem uma decisão de uma pessoa antes
> do flip; os 🟡 são recomendados (não bloqueiam). O runbook no fim é o passo a passo de execução.

---

## 1. Auditoria de segredos — ✅ LIMPO

Varredura no working tree **e em todo o histórico do git** (`git log --all`):

| Verificação | Resultado |
|---|---|
| Chaves secretas Stellar (`S…`, 56 chars) no tree e no histórico | **nenhuma** |
| Tokens de provider (GitHub PAT `ghp_`/`github_pat_`, AWS `AKIA`, JWT `eyJ…`, OpenAI `sk-`, Slack `xox…`) | **nenhum** |
| `.env` / `.env.local` já commitado alguma vez | **não** — só `frontend/.env.example` |
| Arquivos sensíveis tracked (`*.key`, `*.pem`, `keypair`, `identity`, `.soroban`) | **nenhum** |
| E-mails pessoais / URLs internas (ngrok, IPs privados) | **nenhum** (só `localhost` em docs de dev) |
| `.gitignore` cobre `.env`, `.soroban`, `target` | **sim** |
| `LICENSE` presente | **sim** (MIT) |

**Endereços públicos NÃO são segredo.** O `frontend/.env.example` e o `HANDOFF.md` contêm IDs de
contrato (`C…`), o issuer do TESOURO (`G…`) e RPC de testnet — tudo já público on-chain, todos de
**testnet**. As chaves de admin/deploy vivem no `stellar keys` (keychain local, fora do repo),
confirmado por `bootstrap.sh`/`seed.sh` usarem identidades nomeadas (`pulse-admin`, `deployer`).

➡️ **Do ponto de vista de vazamento de credenciais, pode publicar.** O que resta abaixo são decisões
de **privacidade** e **conteúdo**, não vazamentos.

---

## 2. 🔴 Decisões obrigatórias antes de publicar

### D1 — Dados pessoais de terceiro na entrevista de discovery
**Arquivo:** `docs/customer-discovery.md` (Interview I1, linhas ~82–94)

A entrevista I1 está **nominal** ("Douglas") e o identifica publicamente: *"Stellar ambassador,
founder of Wallet Now"*, mais dados pessoais/financeiros sensíveis — *"100% of his income comes from
the decentralized market"*, posições de investimento, empréstimos de BTC para 2030/2035, e duas
citações verbatim. O próprio doc instrui *"Anonymize names if needed"* (linha 5).

Publicar isso expõe dados de uma pessoa real **sem consentimento explícito documentado**. É o item
mais sério da lista.

- **Opção A (recomendada):** anonimizar — trocar por papel + tipo ("Stellar ambassador / founder de
  infra de onboarding Web3"), remover o nome e a empresa, manter as citações (são a evidência mais
  forte para os jurados). Conecta com a issue **#8**.
- **Opção B:** manter nominal **somente com consentimento por escrito** do entrevistado para uso público.
- **Opção C:** remover a entrevista I1 do doc até a submissão.

### D2 — Carteira pessoal vinculada ao protocolo na doc
**Arquivo:** `HANDOFF.md` (linha 34)

O admin do vault+policy (testnet) é a **Freighter pessoal** do dev:
`GBGRCDMLN6NV7W64DUMCOOCRH3WEFU6PC5LIFCXSQQDDC7Q3MQAZK5O5`. Não é um vazamento (endereço público,
on-chain de qualquer forma), mas amarra publicamente uma carteira pessoal à operação do protocolo —
considerar se quer esse vínculo exposto/indexado.

- **Opção A (recomendada):** manter (é testnet, baixo risco) e **anotar a decisão** aqui.
- **Opção B:** rotacionar o admin de volta para `pulse-admin` antes do flip e generalizar a doc.

---

## 3. 🟡 Decisões recomendadas (não bloqueiam o flip)

### R1 — `customer-discovery.md` em estado de rascunho
Grande parte do arquivo são **templates com `<!-- TODO -->`** (entrevistas A1–A3, I2, summaries vazias).
Publicado pela metade, passa impressão de inacabado para jurados. → Preencher (issue **#8**), enxugar
para o que está pronto, ou marcar claramente como "work in progress". *Decisão: ___*

### R2 — Documentos internos viram públicos
`HANDOFF.md` e `hackathon-checklist.md` são docs de trabalho internos: próximos passos, backlog,
*"don't relearn these"*, plano de 7 dias, deadlines, lista de tarefas por owner. Nenhum segredo, mas
é a cozinha do time exposta. → Manter (transparência) ou mover para um local não publicado / privado.
*Decisão: ___*

### R3 — Bugs latentes ficam públicos (documentados e em código)
Ao publicar, ficam visíveis: a lista de bugs latentes no `HANDOFF.md` (ex.: AUM da reserva primária
renderizado para toda linha `live`; "USDC" hardcoded no `InvestPanel`) e os flags em código —
`adapter-defindex` com `min_amounts_out=[0]` (sem piso de slippage) e o `// TODO(solvency-oracle)` no
`vault/src/lib.rs`. Transparência é defensável num hackathon, mas é uma escolha consciente. →
Manter como sinal de transparência, ou limpar os mais sensíveis antes. *Decisão: ___*

### R4 — Skill de terceiros embarcada no repo
`.claude/skills/impeccable/` está versionada — é uma skill de terceiros copiada para dentro do repo
(licença/autoria alheia, além de peso). Não é segredo. → Avaliar remover do tracking
(`git rm -r --cached .claude/skills/impeccable` + `.gitignore`) ou manter. *Decisão: ___*

---

## 4. ✅ O que já está resolvido / OK

- **Fotos da equipe** (`deck/assets/team-*.png`) — **liberadas** pelo dono (decisão tomada).
- **LICENSE** MIT presente — requisito de submissão atendido.
- **`.env` nunca commitado**; `.gitignore` cobre segredos; sem credenciais no histórico.
- **Handles públicos** (`jubscodes`, `draaujpeg`) no HANDOFF — informação já pública, sem problema.

---

## 5. 🚀 Runbook de execução (na ordem)

### Passo 0 — Resolver as decisões
- [ ] D1 (Douglas / dados pessoais) resolvido
- [ ] D2 (carteira pessoal) decidido e anotado
- [ ] R1–R4 decididos (mesmo que a decisão seja "manter")

### Passo 1 — Tornar público
```bash
gh repo edit mutav-finance/mutav-pulse --visibility public   # fecha #13 (gate)
```

### Passo 2 — Blindar (grátis em repo público; rodar logo após o flip)
```bash
# Secret scanning + push protection (bloqueia commit futuro com segredo)
gh api -X PATCH repos/mutav-finance/mutav-pulse \
  -F security_and_analysis[secret_scanning][status]=enabled \
  -F security_and_analysis[secret_scanning_push_protection][status]=enabled

# Dependabot alerts (CVEs em deps npm + Cargo)
gh api -X PUT repos/mutav-finance/mutav-pulse/vulnerability-alerts

# Private vulnerability reporting (canal de report sem expor a falha)
gh api -X PUT repos/mutav-finance/mutav-pulse/private-vulnerability-reporting
```

### Passo 3 — Proteger a branch `main`
```bash
gh api -X PUT repos/mutav-finance/mutav-pulse/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -F enforce_admins=true \
  -F required_status_checks=null \
  -F restrictions=null
```
*(opcional — pode atrapalhar a velocidade do hackathon; decidir se vale agora.)*

### Passo 4 — Verificação pós-flip
- [ ] `gh repo view mutav-finance/mutav-pulse --json visibility` → `PUBLIC`
- [ ] Aba **Security** mostra Secret scanning + Dependabot **ativos**
- [ ] Abrir o repo numa janela anônima (deslogado) e confirmar que carrega
- [ ] README / demo URL / vídeo conferidos como público (issues #14, #9, #10)

---

## 6. Issues relacionadas

| Issue | Relação |
|---|---|
| **#13** Make repo public | **Fechada por este fluxo** (Passo 1) |
| **#12** Secrets audit before going public | **Atendida** pela seção 1 |
| **#8** Fill customer-discovery findings | Ligada à decisão **D1/R1** |
