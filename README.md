# Mutav Pulse

**Mutav is an institutional guarantor (*fiador institucional*) for Brazilian rentals: instead of a personal co-signer or a multi-month deposit, Mutav backs your lease itself — provably, from a tokenized USDC reserve on Stellar whose solvency anyone can verify onchain.**

> PULSO Hackathon submission (Brazil track) · Stellar / Soroban · live on testnet
> Built by the [mutav](https://mutav.finance) team — **Draau** (CEO) & **Julia** (CTO). Org: `mutav-finance`.

---

## TL;DR for judges

- **What:** an onchain *fiador institucional* (institutional rental guarantor) for Brazil — a PoC of MUTAV, a decentralized rental-guarantee system.
- **The Stellar integration is the product:** every core operation (deposit, premium, default payout, yield allocation) is a Soroban contract call across a modular vault / policy / registry / strategy design. Frontend holds no keys.
- **The hard technical thing:** an onchain solvency invariant (`stable_assets ≥ coverage_required`) enforced *re-entrancy-safely* — the policy reduces coverage before the vault disburses, dodging a Soroban re-entrancy trap.
- **Real-World ZK:** on top of that public invariant, a **zero-knowledge proof-of-solvency seal** proves reserves cover *all* liabilities — including off-chain bank balances and a private client list — without revealing any values ([details](#zk-solvency-seal--proof-of-reserves-stellar-hacks-real-world-zk-track)).
- **Live on testnet:** vault/policy/registry deployed + seeded; 23 contract unit tests + 10 frontend tests green. Contract addresses + verify links [below](#live-on-testnet).
- **Yield:** the DeFindex yield adapter is built and unit-tested; deploying it onto a live DeFindex testnet vault is the next step (the live strategy slot currently runs a mock — see [Roadmap](#roadmap--extensibility)).
- **Customer discovery:** real-estate agencies interviewed; investor interviews in progress.
- ▶️ **Demo video:** <!-- TODO: link --> · 🌐 **Live demo:** <!-- TODO: Vercel URL -->

---

## The problem

In Brazil, you cannot sign a lease without a rental guarantee (*garantia locatícia*) — it is mandatory by law. Every lease must be backed by one of a few legally-recognized forms: a personal guarantor (*fiador*), a deposit of up to three months' rent, *seguro-fiança* (guarantee insurance), or a *título de capitalização* (a capitalization bond). This locks up tenant capital, excludes the many renters with no wealthy guarantor to offer, and still leaves landlords exposed when a tenant defaults. And every one of these options is **opaque**: a landlord has no way to verify that the guarantee behind their lease is actually solvent.

Mutav is a **fiador institucional** — an institutional guarantor. Instead of forcing a tenant to find a personal *fiador* or lock up a multi-month deposit, **Mutav provides the *fiança* itself**: it stands as guarantor on the lease and pays the landlord if the tenant defaults. *Fiança* is one of the legally-recognized forms and the **lightest to launch** — unlike SUSEP-regulated *seguro-fiança* insurance, it needs no insurance license. It's the entry point; the model can expand into adjacent guarantee products later. The twist: Mutav's *fiança* is backed by an **onchain, solvency-verifiable reserve** — a landlord can confirm in real time that the guarantor behind their lease is solvent, which no personal *fiador* or opaque insurer can offer.

**Mutav Pulse is a proof of concept of that decentralized guarantee system.** It implements MUTAV's financial core on Stellar testnet: the tokenized **reserve** that backs the *fiança*, makes its solvency verifiable onchain, and pays out defaults — proving the guarantee can run transparently and trust-minimized, instead of on an opaque institutional balance sheet. Two surfaces sit on top: the **MUTAV Reserve** investor app and the **MUTAV Protocol** operator cockpit.

## The solution

A reserve of USDC on Stellar — held by the `vault` contract — that is **provably always able to cover the *fianças* Mutav has written**:

- **Tenants** get a *fiança* from Mutav and pay a monthly **premium** — no personal guarantor, no large deposit. Real-estate agencies (*imobiliárias*) are the distribution channel that onboards them.
- **Investors** fund the reserve: they deposit USDC and receive `mtvR` vault shares (a tokenized position). Their capital is what backs the *fianças*, and it earns yield.
- **Mutav** pays the landlord on a tenant default (`cover_default`) — one month of rent at a time, and stops paying out the moment a *fiança* falls behind on premiums.
- The whole thing is **solvency-gated**: the invariant `stable_assets ≥ coverage_required` is enforced onchain on every payout and every redemption. Only *surplus* capital (`free_capital = stable_assets − coverage_required`) can ever leave the reserve — an onchain anti-bank-run guarantee.
- Idle reserve capital is **put to work earning DeFi yield** through a pluggable strategy allocator — a DeFindex adapter today, with Soroswap / Blend designed against the same interface.

**The proof is public.** The `/earn/transparency` dashboard shows a live solvency chip, coverage metrics, and the full guarantee registry — and every number on screen links back to its onchain source. Nothing to take on trust.

> **Why "Pulse":** the reserve runs on a constant pulse of liquidity — premiums in, default payouts out, redemptions clearing from surplus — metered beat by beat through the redemption queue.

---

## Stellar integration (where the protocol lives)

The integration *is* the product — every core operation is a Soroban contract call; the frontend holds no keys and signs nothing server-side.

### Soroban smart contracts (`contracts/`, Rust)

A modular, single-responsibility design — custody, data, and the underwriting model are split by how often each is expected to change, so the monetary model can evolve without ever touching the contract that holds the money. Contracts are wired by setters at deploy time (`bootstrap.sh`), never constructor-baked, and every contract is upgradeable (admin-gated `upgrade(wasm_hash)`).

| Contract | Responsibility |
|---|---|
| `vault` | **Custody** — USDC funds, tokenized `mtvR` shares (OpenZeppelin fungible token, virtual-offset anti-inflation), NAV, surplus-gated redemption queue, strategy allocator. [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) (Tokenized Vault Standard) surface — note `withdraw`/`redeem` are intentionally disabled in favor of the async redemption queue (a conformant "withdrawals-gated" configuration). |
| `policy` | **Underwriting brain** — premium model, coverage math, `cover_default`. Swappable without moving funds. |
| `registry` | Writer-gated typed store of guarantee records. |
| `strategy` (trait) + `adapter-defindex` | Yield venues. `adapter-defindex` integrates **[DeFindex](https://www.defindex.io/)**, a Stellar DeFi yield protocol — `invest` deposits idle reserve into a DeFindex vault, `balance` values the position in real time, `divest` withdraws. Built and unit-tested against the DeFindex interface; live testnet deployment is the next step (see [Roadmap](#roadmap--extensibility)). |
| `interfaces` | Shared cross-contract client traits + the `Guarantee` type. |

**The safety spine (three onchain authority rules):**
1. **Money moves only through `vault`** — `disburse` / `collect_premium` callable only by the registered `policy`.
2. **Guarantee data is written only by `policy`** — registry mutators are writer-gated.
3. **Solvency is enforced at the vault** — `stable_assets ≥ coverage_required` on every disburse and every redemption.

Technical depth worth noting:

- **Re-entrancy-safe solvency** — the policy reduces coverage in the registry *before* calling `vault.disburse`, so the vault never has to call back into a policy already on the stack (a Soroban re-entrancy trap). Exercised by the full-default-path test in `contracts/policy/src/test_system.rs`.
- **Premiums mint no shares** — they accrue to NAV instead (test: `contracts/vault/src/test.rs`).
- **Virtual-offset share token** — an anti-inflation (donation-attack) defense on `mtvR`, with a dedicated test.

See `docs/specs/` and `docs/plans/` for the full design history (one spec + one plan per phase).

**Why this matters for Stellar:** Mutav Pulse is a reusable, solvency-gated **RWA vault primitive** on Soroban — the first onchain *fiança* for Brazil's mandatory-guarantee rental market. It brings a real LATAM cash-flow use case onchain and contributes a SEP-0056-aligned, strategy-pluggable vault pattern other builders can fork.

### Building blocks used (from the Stellar Integration List)

- **Soroban smart contracts** — the entire protocol.
- **OpenZeppelin Stellar contracts** — audited fungible-token base for the share token.
- **Stellar Wallets Kit** — wallet connection in the frontend (no injected keys).
- **DeFindex** — yield adapter built and unit-tested against the DeFindex interface (live testnet wiring pending; see [Roadmap](#roadmap--extensibility)).

### Frontend (`frontend/`, Next.js 16)

The **MUTAV Reserve** investor app (`/earn` deposit·redeem, `/earn/transparency` proof dashboard — which now also hosts the yield-venue directory) + the admin-gated **MUTAV Protocol** operator cockpit (`/protocol`). Stellar Wallets Kit for signing; typed bindings generated directly from the deployed contracts. See [`frontend/README.md`](frontend/README.md).

---

## Live on testnet

Deployed and wired on Stellar testnet (RPC `https://soroban-testnet.stellar.org`). Seeded with a **synthetic demo state** (for demonstration, not real traction): ~$50.4k reserve, NAV 1.0084, 4 guarantees (3 active / 1 lapsed), $420 premiums collected.

| Contract | Address | Verify |
|---|---|---|
| vault | `CAJ2L2JBV3B5JZDOQNAKU6SZSIDB354VFCPRAAXHD5FD73WFXSRWPBMR` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAJ2L2JBV3B5JZDOQNAKU6SZSIDB354VFCPRAAXHD5FD73WFXSRWPBMR) |
| policy | `CA7SROLJVJXMPCUG7DLI5EUOWFMYCT2SJSKHXG35PV2I36KXSNA3BTHO` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CA7SROLJVJXMPCUG7DLI5EUOWFMYCT2SJSKHXG35PV2I36KXSNA3BTHO) |
| registry | `CCFYHEAI5SBPAE44ZGV5QNDHIMCLZSIMTBT26NBYQDEDMJGPRMB2PAZ6` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CCFYHEAI5SBPAE44ZGV5QNDHIMCLZSIMTBT26NBYQDEDMJGPRMB2PAZ6) |
| mock-strategy *(yield slot; DeFindex adapter pending deploy)* | `CDULHUYDOO7W3FKHACBC4ER7EMDJMBKZJRKXGT4XTCXGFWMHJKW5RXPJ` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDULHUYDOO7W3FKHACBC4ER7EMDJMBKZJRKXGT4XTCXGFWMHJKW5RXPJ) |

USDC settles in SAC `CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6`.

**Proof of operation** — verify the protocol actually runs onchain, not just deployed:
<!-- TODO before submit: add stellar.expert tx links to the seeded operations — the deposit that minted mtvR, a collect_premium, and a cover_default disbursement. -->

▶️ **Demo video:** <!-- TODO: 1–2 min walkthrough link --> · 🌐 **Live demo:** <!-- TODO: Vercel URL, e.g. https://pulse.mutav.finance -->

---

## ZK Solvency Seal — proof of reserves *(Stellar Hacks: Real-World ZK track)*

On top of the public `stable_assets ≥ coverage_required` invariant above, Mutav Pulse adds a
**zero-knowledge proof-of-solvency seal**: it proves on-chain (Soroban, Groth16 / BN254) that

```
reserves (on-chain vault + bank + wallets)  ≥  obligations (the whole guarantee list) × band
```

— including **off-chain bank balances** and a **private client list** — **without revealing any
values, wallets, or client data**. Only a green/red light + a coverage band (e.g. "≥ 100%") leak.
This is the classic proof of reserves / proof of solvency pattern (what serious exchanges adopted
post-FTX), brought to a real-world fund on Stellar.

**Why it can't be faked (the crown jewel — anti-omission):** the circuit recomposes the *entire*
Poseidon-Merkle root from all guarantee leaves and requires it to equal the on-chain
`guarantees_root`; the attestor re-reads that root **live**. Omitting or shrinking a guarantee
changes the recomposed root → no valid proof. `cd prover && npm run anti-tamper -- --submit` shows
all three paths live: honest → green; omission with the real root → proof impossible to generate;
omission with a fake root → forged proof reverts on-chain (`InvalidProof`) → red.

**Real vs simulated vs assumed (honest disclosure):**
- ✅ **Real** — the cryptography (Groth16 zk-SNARK over BN254) + its on-chain verification (`pairing_check`); the binding to the **live** vault `stable_assets` + registry root; the anti-omission property; the ≥100% ratio floor enforced on-chain; measured cost ≈ 37.96M instructions (~38% of one tx).
- 🟡 **Simulated** — the bank attestation oracle key (fixed for the hackathon; no Open Finance yet). The math/verification are real, only the data source is simulated.
- ⚪ **Assumed** — a dedicated ZK registry mirrors the core guarantee book (in production the `policy` writes it on every transition). Piece C (multi-wallet reserves) is a cut stretch goal — A + B is the MVP.

| ZK contract | ID |
|---|---|
| `solvency_attestor` (the seal — read `last_attestation`) | `CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT` |
| `registry` (with `guarantees_root`) | `CCIIYG572C5HUJKPDVSCYWAJNUUPOEEXKXIURA3DMAPTMETE3HHOU3FC` |

It proves against the same `vault` and USDC SAC listed above. Verify it yourself:

```bash
cd circuits && snarkjs groth16 verify verification_key.json public.json proof.json   # → OK!
cargo test -p registry -p solvency-attestor --lib                                    # 6/6 · 8/8
cd prover && npm install && npm run prove                                             # real proof from live state
```

The seal renders as the `ZkSolvencyBadge` above the SolvencyChip on `/earn/transparency`. Full
architecture, stage-by-stage build, and the migration decision: [`docs/zk-solvency-plan.md`](docs/zk-solvency-plan.md).

---

## Customer discovery

MUTAV is built directly against the two sides of the Brazilian rental market it serves:

- **Real-estate agencies (*imobiliárias*)** — interviews completed. Findings: <!-- TODO: summarize key findings — what guarantee products they use today, pain points, what would make them adopt an onchain guarantee. -->
- **Investors (DeFi / yield)** — interviews in progress. <!-- TODO: add findings on appetite for solvency-verifiable rental-guarantee yield. -->

Full write-ups, methodology, and the investor interview guide are in [`docs/customer-discovery.md`](docs/customer-discovery.md).

---

## Run it locally

```bash
# Contracts — test + build (use the Stellar CLI, NOT `cargo build --release`;
# soroban-sdk 26.1 spec-shaking needs the CLI)
cargo test            # 23 unit tests
stellar contract build

# Frontend
cd frontend
cp .env.example .env.local   # pre-filled with the live testnet contract IDs above
bun install
bun dev                       # → http://localhost:3000/earn
```

Redeploy + reseed from scratch (`bootstrap.sh` deploys + wires; `seed.sh` restores the demo state) — see [`HANDOFF.md`](HANDOFF.md) for the full operator runbook, invariants, and gotchas.

## Repository layout

```
contracts/        Soroban smart contracts (Rust workspace)
  vault/  policy/  registry/  interfaces/  strategy/
  adapter-defindex/   mock-strategy/  mock-policy/  mock-defindex/
  solvency-attestor/  (ZK: on-chain Groth16 verifier + last_attestation)
circuits/         ZK: solvency.circom (Groth16/BN254) + proof/VK
prover/           ZK: off-chain prover + anti-tamper demo (Node + snarkjs)
frontend/         Next.js 16 investor app + /protocol operator cockpit
docs/specs/       one design spec per phase
docs/plans/       one implementation plan per phase
docs/zk-solvency-plan.md   ZK seal: full stage-by-stage build plan
HANDOFF.md        operator runbook: deploy, seed, invariants, gotchas
PRODUCT.md        product brief: users, purpose, design principles
```

## Stack

Soroban (soroban-sdk 26.1) · Rust · OpenZeppelin Stellar contracts · DeFindex · Stellar Wallets Kit · Next.js 16 · TypeScript · Bun · Tailwind v4 · Stellar CLI · Circom / snarkjs (ZK).

## Team

- **Draau** — CEO · [@draaujpeg](https://github.com/draaujpeg)
- **Julia** — CTO · [@jubscodes](https://github.com/jubscodes) · protocol, contracts, frontend

PULSO Hackathon · Brazil track · team of 2 (both based in Brazil 🇧🇷).

## Roadmap & extensibility

The strategy allocator is a trait, so new yield venues plug in without touching custody:

- **DeFindex (live wiring)** — deploy the built `adapter-defindex` onto a DeFindex testnet vault and make it the active strategy, so real yield flows into NAV (the slot runs a mock today).
- **Soroswap / Blend** — additional adapters against the same `Strategy` trait (listed as Planned in the venue directory on `/earn/transparency`); add a `max_volatile_bps` cap when the first volatile venue lands.
- **Mainnet path** — set a real slippage floor on the DeFindex adapter (`min_amounts_out` is `[0]` for the demo) before any mainnet deploy.

## License

[MIT](LICENSE) © 2026 Mutav (mutav-finance).

---

*Mutav Pulse is a hackathon proof of concept of MUTAV's decentralized guarantee system, on Stellar testnet — not coupled to mutav's audited production `mutav-stellar` Fund. Built to demonstrate the integration and the trust-minimized guarantee model.*
