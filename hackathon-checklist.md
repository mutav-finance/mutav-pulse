# PULSO Hackathon — Submission Checklist

**Event:** PULSO Hackathon (Brazil track) · NearX + Stellar Development Foundation
**Single objective:** Integration depth with Stellar infrastructure.
**Submission deadline:** **2026-06-30 23:59** · Finalists 07-01 · Pitch day 07-06 (São Paulo, in person) · Winners 07-08
**Submit at:** [DoraHacks](https://dorahacks.io/hackathon/stellar-pulso-hackathon/) · **Contact:** [Telegram](https://t.me/+nR071cZP3LY2OGQx)

---

## ⛔ Eligibility gates (pass/fail — not scored, just required)

- [ ] **Public open-source repo** — `mutav-finance/mutav-pulse` is currently **PRIVATE**. Flip to public before submitting. *(decision deferred — do it later)*
- [ ] **Audit repo for secrets before going public** — no keys/secrets in history (test wallets in `local.env` are disposable, but confirm).
- [x] **Live testnet deployment on Stellar** — vault `CAJ2L2JB…` + policy/registry/strategy deployed & seeded.
- [ ] **≥3 customer-discovery interviews with evidence** (intro text said 5 — aim for 5).
  - [x] Real-estate agencies (*imobiliárias*) — interviews done
  - [ ] Investors (DeFi/yield) — **in progress** ← discovery gap
  - [ ] Written up as submission evidence → `docs/customer-discovery.md`
- [x] **Team of 2–4 people, residents of BR/AR/CO** — Julia ([@jubscodes](https://github.com/jubscodes)) & Draau ([@draaujpeg](https://github.com/draaujpeg)), both in Brazil 🇧🇷.

## 📦 Required submission artifacts

- [x] **Clear `README.md`** — judge-facing, written (TODO markers remain, see below)
- [x] **Open-source license** — MIT `LICENSE` added.
- [ ] **Pitch deck** — problem / solution / differentiation / impact. Must be beautiful (may pitch IRL on 07-06).
- [ ] **Demo video (1–2 min)** — clearly show the prototype working + the real-world problem. Not heavily produced; you needn't be on camera.
- [ ] **Deployed live demo URL** — Vercel (team `mutav`), e.g. `pulse.mutav.finance`.

## 🏆 Judging criteria (optimize for these)

1. **Integration depth & technical complexity**
   - [x] Modular Soroban contracts (vault/policy/registry/strategy/interfaces)
   - [x] SEP-0056 Tokenized Vault Standard conformance
   - [x] OpenZeppelin fungible-token share + virtual-offset anti-inflation
   - [x] `adapter-defindex` Strategy implementation written
   - [ ] **Deploy `adapter-defindex` to a real DeFindex testnet vault** so the integration is *load-bearing* in the live demo (today the slot runs `mock-strategy`). ← highest-leverage task
2. **Impact on the Stellar ecosystem**
   - [x] Real LATAM use case — *fiador institucional* for mandatory Brazilian rental guarantees, backed by an onchain solvency-verifiable reserve (lightest-to-launch *fiança*, no SUSEP license)
   - [ ] Articulate the ecosystem impact in README + deck
3. **Customer discovery & validation**
   - [ ] Agency + investor interviews written up (see gate above)
4. **Quality of testnet / mainnet deployment**
   - [x] Clean testnet deploy + realistic seed; tests green (23 contract unit tests + 10 frontend vitest)
   - [ ] *(scoring advantage, optional)* mainnet deployment or live traction — likely out of scope for 7 days

## 📝 README TODO markers to fill (`README.md`)

- [ ] Live demo URL (Vercel)
- [ ] Demo video link
- [ ] Agency interview findings summary
- [ ] Investor interview findings
- [ ] Create `docs/customer-discovery.md`
- [ ] Add LICENSE

---

## Suggested 7-day plan (06-23 → 06-30)

| Days | You | Claude / agent |
|---|---|---|
| 1–2 | Book + run the 5 discovery interviews (longest lead time) | Deploy live DeFindex integration; finish README; add LICENSE |
| 3–4 | Review deck draft; gather demo assets | Draft pitch-deck content + demo-video script; scaffold `docs/customer-discovery.md`; run `/protocol` flow end-to-end |
| 5–6 | Record the 1–2 min demo; finalize the (beautiful) deck | Polish README links; deploy frontend to Vercel |
| 7 | **Make repo public**, final review, **submit on DoraHacks** | Eligibility + secrets audit; final verification pass |

## Useful Stellar dev context (recommended by organizers)

- Stellar Skills: https://skills.stellar.org/ · Stellar Dev Skill: https://github.com/stellar/stellar-dev-skill
  - Install: `/plugin marketplace add stellar/stellar-dev-skill` then `/plugin install stellar-dev@stellar-dev`
- OpenZeppelin Skills: `/plugin marketplace add OpenZeppelin/openzeppelin-skills`
- Integration List + Building Apps on Stellar: https://developers.stellar.org/
- DeFindex (live integration target): https://www.defindex.io/
