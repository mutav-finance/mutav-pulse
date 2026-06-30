# Mutav Pulse

**Mutav is an institutional guarantor (*fiador institucional*) for Brazilian rentals: instead of a personal co-signer or a multi-month deposit, Mutav backs your lease itself — provably, from a tokenized USDC reserve on Stellar whose solvency anyone can verify onchain.**

> PULSO Hackathon submission (Brazil track) · Stellar / Soroban · live on testnet
> Built by the [mutav](https://mutav.finance) team — **Draau** (CEO) & **Julia** (CTO). Org: `mutav-finance`.

---

## TL;DR for judges

- **What:** an onchain rental guarantor (institutional rental guarantor) for Brazil — a PoC of MUTAV, a decentralized rental-guarantee system.
- **The Stellar integration is the product:** every core operation (deposit, fee, default payout, yield allocation) is a Soroban contract call across a modular vault / policy / registry / strategy design. Frontend holds no keys.
- **The hard technical thing:** an onchain solvency invariant (`stable_assets ≥ coverage_required`) enforced *re-entrancy-safely* — the policy reduces coverage before the vault disburses, dodging a Soroban re-entrancy trap.
- **Live on testnet:** three reserves (MUSD · MTESOURO · MBRL) deployed + seeded; 135 contract unit tests + 28 frontend tests green. Contract addresses + verify links [below](#live-on-testnet).
- **Yield:** the DeFindex yield adapter is built and unit-tested; deploying it onto a live DeFindex testnet vault is the next step (the live strategy slot currently runs a mock — see [Roadmap](#roadmap--extensibility)).
- **Customer discovery:** real-estate agencies interviewed; four investor interviews completed.
- ▶️ **Demo video:** [YouTube walkthrough](https://www.youtube.com/watch?v=ndJkO3XGN6Q) · 🌐 **Live demo:** [pulse.mutav.finance](https://pulse.mutav.finance) · 📊 **Pitch deck:** [pulse.mutav.finance/deck](https://pulse.mutav.finance/deck)

---

## The problem

In Brazil, you cannot sign a lease without a rental guarantee (*garantia locatícia*) — it is mandatory by law. Every lease must be backed by one of a few legally-recognized forms: a personal guarantor (*fiador*), a deposit of up to three months' rent, *seguro-fiança* (guarantee insurance), or a *título de capitalização* (a capitalization bond). This locks up tenant capital, excludes the many renters with no wealthy guarantor to offer, and still leaves landlords exposed when a tenant defaults. And every one of these options is **opaque**: a landlord has no way to verify that the guarantee behind their lease is actually solvent.

Mutav is a **fiador institucional** — an institutional guarantor. Instead of forcing a tenant to find a personal *fiador* or lock up a multi-month deposit, **Mutav provides the *fiança* itself**: it stands as guarantor on the lease and pays the landlord if the tenant defaults. *Fiança* is one of the legally-recognized forms and the **lightest to launch** — unlike SUSEP-regulated *seguro-fiança* insurance, it needs no insurance license. It's the entry point; the model can expand into adjacent guarantee products later. The twist: Mutav's *fiança* is backed by an **onchain, solvency-verifiable reserve** — a landlord can confirm in real time that the guarantor behind their lease is solvent, which no personal *fiador* or opaque insurer can offer.

**Mutav Pulse is a proof of concept of that decentralized guarantee system.** It implements MUTAV's financial core on Stellar testnet: the tokenized **reserve** that backs the *fiança*, makes its solvency verifiable onchain, and pays out defaults — proving the guarantee can run transparently and trust-minimized, instead of on an opaque institutional balance sheet. Two surfaces sit on top: the **MUTAV Reserve** investor app and the **MUTAV Protocol** operator cockpit.

## The solution

A reserve of USDC on Stellar — held by the `vault` contract — that is **provably always able to cover the *fianças* Mutav has written**:

- **Tenants** get a *fiança* from Mutav and pay a monthly **fee** — no personal guarantor, no large deposit. Real-estate agencies (*imobiliárias*) are the distribution channel that onboards them.
- **Investors** fund the reserve: they deposit USDC and receive `MUSD` vault shares (a tokenized position — each reserve mints a per-currency share; `MUSD` is the USD reserve). Their capital is what backs the *fianças*, and it earns yield.
- **Mutav** pays the landlord on a tenant default (`cover_default`) — one month of rent at a time, and stops paying out the moment a *fiança* falls behind on fees.
- The whole thing is **solvency-gated**: the invariant `stable_assets ≥ coverage_required` is enforced onchain on every payout and every redemption. Only *surplus* capital (`free_capital = stable_assets − coverage_required`) can ever leave the reserve — an onchain anti-bank-run guarantee.
- Idle reserve capital is **put to work earning DeFi yield** through a pluggable strategy allocator — a DeFindex adapter today, with Soroswap / Blend designed against the same interface.

**The proof is public.** The `/earn/transparency` dashboard shows a live solvency chip, coverage metrics, and the full guarantee registry — and every number on screen links back to its onchain source. Nothing to take on trust.

> **Why "Pulse":** the reserve runs on a constant pulse of liquidity — fees in, default payouts out, redemptions clearing from surplus — metered beat by beat through the redemption queue.

---

## Stellar integration (where the protocol lives)

The integration *is* the product — every core operation is a Soroban contract call; the frontend holds no keys and signs nothing server-side.

### Soroban smart contracts (`contracts/`, Rust)

A modular, single-responsibility design — custody, data, and the underwriting model are split by how often each is expected to change, so the monetary model can evolve without ever touching the contract that holds the money. Contracts are wired by setters at deploy time (`bootstrap.sh`), never constructor-baked, and every contract is upgradeable (admin-gated `upgrade(wasm_hash)`).

| Contract | Responsibility |
|---|---|
| `vault` | **Custody** — USDC funds, tokenized per-currency shares (`MUSD` for the USD reserve; OpenZeppelin fungible token, virtual-offset anti-inflation), NAV, surplus-gated redemption queue, strategy allocator. [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) (Tokenized Vault Standard) surface — note `withdraw`/`redeem` are intentionally disabled in favor of the async redemption queue (a conformant "withdrawals-gated" configuration). |
| `policy` | **Underwriting brain** — fee model, coverage math, `cover_default`. Swappable without moving funds. |
| `registry` | Writer-gated typed store of guarantee records. |
| `strategy` (trait) + `adapter-defindex` | Yield venues. `adapter-defindex` integrates **[DeFindex](https://www.defindex.io/)**, a Stellar DeFi yield protocol — `invest` deposits idle reserve into a DeFindex vault, `balance` values the position in real time, `divest` withdraws. Built and unit-tested against the DeFindex interface; live testnet deployment is the next step (see [Roadmap](#roadmap--extensibility)). |
| `interfaces` | Shared cross-contract client traits + the `Guarantee` type. |

**The safety spine (three onchain authority rules):**
1. **Money moves only through `vault`** — `disburse` / `collect_fee` callable only by the registered `policy`.
2. **Guarantee data is written only by `policy`** — registry mutators are writer-gated.
3. **Solvency is enforced at the vault** — `stable_assets ≥ coverage_required` on every disburse and every redemption.

Technical depth worth noting:

- **Re-entrancy-safe solvency** — the policy reduces coverage in the registry *before* calling `vault.disburse`, so the vault never has to call back into a policy already on the stack (a Soroban re-entrancy trap). Exercised by the full-default-path test in `contracts/policy/src/test_system.rs`.
- **Fees mint no shares** — they accrue to NAV instead (test: `contracts/vault/src/test.rs`).
- **Virtual-offset share token** — an anti-inflation (donation-attack) defense on the `MUSD` share token, with a dedicated test.

Full protocol documentation — concepts, contract reference, the security model, and guides — lives in [`docs/`](docs/README.md). The build-evolution history is preserved in the git log.

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

Deployed and wired on Stellar testnet (RPC `https://soroban-testnet.stellar.org`) — **three reserves live**: **MUSD** (USD · cUSD), **MTESOURO** (Brazilian treasury · cTSR), and **MBRL** (BRL-native · cBRL). Each is its own contract set (vault + policy + registry) and carries a **synthetic demo state** (for demonstration, not real traction); the primary MUSD reserve holds ~$305k with ~$144k coverage reserved behind its guarantee book.

<!-- deploy:start — generated by `make sync-deploy`; do not edit by hand -->
Primary reserve (MUSD) below; the full address set for all three reserves + their assets is in [`docs/reference/deployments.md`](docs/reference/deployments.md).

| Contract | Address | Verify |
|---|---|---|
| vault | `CA26WJGO5MINAT47DCGMU54HYW5A3RQ7VSE4ANPCYYA4TGXTJZQJ5EZQ` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CA26WJGO5MINAT47DCGMU54HYW5A3RQ7VSE4ANPCYYA4TGXTJZQJ5EZQ) |
| policy | `CBC2IJHH3FQMIQETFYDIEQG7OFJXTRKKLJDDONQ6N47AB3HLWWEIZQVO` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CBC2IJHH3FQMIQETFYDIEQG7OFJXTRKKLJDDONQ6N47AB3HLWWEIZQVO) |
| registry | `CDJYJLUJL55SFD5YPSEKH6IZN3XRPLOCSFG33LDXOHEI2JY2ILITUSZ4` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDJYJLUJL55SFD5YPSEKH6IZN3XRPLOCSFG33LDXOHEI2JY2ILITUSZ4) |

The MUSD vault settles in the cUSD SAC `CAWAVKYQ5AFSM3PVEZ4COPMBCOQDRCNB4LVGDOZ6GWX5ZK6OQJZTEDAH`. The three deposit tokens (cUSD / cTSR / cBRL) are mock testnet assets issued by `GA6LJT75ZRW3GWJ3NUQFBIL7CL66ITLT5BS35ZA7E7G35IOMGTSFJRIO`.
<!-- deploy:end -->

**Proof of operation** — verify the protocol actually runs onchain, not just deployed.

**1. The guarantee lifecycle (the protocol itself)** — underwrite a *fiança* → collect the premium → pay out both coverage legs to a real landlord, live on the MBRL (cBRL) pilot reserve. Landlord [`GAEILCIV…R2LB`](https://stellar.expert/explorer/testnet/account/GAEILCIVINMSDUXWQEQF7OVIHM563B5U2JTG4JHLMI2TG3UIJMWLR2LB) received **3,000 cBRL** across the two payouts:

| Operation | What it proves | Transaction |
|---|---|---|
| `sign_guarantee` | underwrite a fiança (solvency-gated) | [`ff173e3c`](https://stellar.expert/explorer/testnet/tx/ff173e3c87bdf5a402bad12ec6cf161da3e52c6bda3eabc522c4a0141cdbd555) |
| `pay_fee` | premium collected → accrues to NAV | [`05bddeb1`](https://stellar.expert/explorer/testnet/tx/05bddeb16842bc1ed68d5e04102f64e4f154be40520a6f9bb60baff9d62fc9f5) |
| **`cover_exit`** | **property-recovery payout — 1,000 cBRL → landlord** | [`18cfe2d0`](https://stellar.expert/explorer/testnet/tx/18cfe2d01e79c7c9d093b54a295b7aced74a0e5048c5b6c146e6a8cd1a152d11) |
| **`cover_default`** | **rent-arrears payout — 2,000 cBRL → landlord** | [`5aa4b5bc`](https://stellar.expert/explorer/testnet/tx/5aa4b5bc0f8f01d93ca89adeefd2dce3dc1ba02386847d2db50867d49dbb80ce) |

**2. The yield integration (DeFindex)** — the MUSD reserve routes idle capital through our audited `adapter-defindex` into a **real [DeFindex](https://www.defindex.io/) vault** (created via DeFindex's testnet factory over our cUSD) and back:

| Operation | What it proves | Transaction |
|---|---|---|
| `create_defindex_vault` | DeFindex factory creates our cUSD vault | [`66d249ad`](https://stellar.expert/explorer/testnet/tx/66d249add8f18158b499473befc4d2cfe5daef269bceeedc9a6c12cd2de2fb81) |
| **`rebalance`** | **~454k cUSD allocated INTO the DeFindex vault** | [`9402013f`](https://stellar.expert/explorer/testnet/tx/9402013f7ab667cc17bd2f3df5d799acf7f15a332af7e1a79b1dcb2caf837da0) |
| **`process_redemptions`** | **~95k cUSD divested back OUT of DeFindex** | [`7fa65a91`](https://stellar.expert/explorer/testnet/tx/7fa65a91f87540a735b07b1128a278ed69fe2143d789afa755446e29e44aea63) |

Full operation list (deploy, wiring, async redemption, governance) and contract addresses: [`docs/reference/proof-of-operation.md`](docs/reference/proof-of-operation.md).

🌐 **Live demo:** [pulse.mutav.finance](https://pulse.mutav.finance)

---

## Customer discovery

MUTAV is built directly against the two sides of the Brazilian rental market it serves:

- **Real-estate agencies (*imobiliárias*)** — across seven interviews, the complaint was consistent: today's guarantee providers are slow and opaque to claim against (payouts stretching to 60–90 days, line items contested to pay less, some exonerating themselves at any time, even going bankrupt). Because the agency sold the guarantee, the loss lands on it — almost all advance the rent to the owner and wait months for a reimbursement that rarely arrives in full. This is the gap MUTAV closes: a guarantor whose solvency is verifiable onchain, with transparent, rules-based payouts, instead of an opaque counterparty that delays, underpays, or walks away.
- **Investors (DeFi / yield)** — across four interviews the signal is clear: for real-world-backed yield, trust hinges on transparency of the backing and the team, not on the APY. The recurring frustration with RWAs is never being able to confirm whether the "real" is actually real. Investors judge a protocol by what they can check themselves (TVL, a doxxed team, and verified contracts), expect yield to stay realistic (three of four anchor it to risk/realism, treating an unexplained double-digit APY on a stablecoin as a red flag), and accept a lockup when the rationale is clear. This validates MUTAV's bet on onchain-verifiable solvency, makes the solvency gate and contract addresses something to surface rather than bury, and frames the surplus-gated redemption queue as solvency protection.

Full write-ups, methodology, and the investor interview guide are in [`docs/resources/customer-discovery.md`](docs/resources/customer-discovery.md).

---

## Run it locally

```bash
# Contracts — test + build (use the Stellar CLI, NOT `cargo build --release`;
# soroban-sdk 26.1 spec-shaking needs the CLI)
cargo test            # 135 unit tests
stellar contract build

# Frontend
cd frontend
cp .env.example .env.local   # pre-filled with the live testnet contract IDs above
bun install
bun dev                       # → http://localhost:3000/earn
```

Redeploy + reseed from scratch: `bootstrap.sh` deploys + wires every contract; `seed.sh` restores the demo state. See the [Quickstart](docs/guides/quickstart.md) and [Deploying & wiring](docs/guides/deploying-and-wiring.md) guides for detail.

## Documentation

Full protocol docs are in [`docs/`](docs/README.md):

- [Overview](docs/overview.md) · [Concepts](docs/concepts/solvency-and-coverage.md) (solvency, coverage, vault, yield) · [Economic model](docs/concepts/economic-model.md)
- [Guides](docs/guides/quickstart.md) — quickstart, running locally, deploying & wiring
- [Contract reference](docs/reference/contracts/vault.md) · [Deployments](docs/reference/deployments.md) · [Errors](docs/reference/errors.md)
- [Security model](docs/security/security-model.md) · [Threat model](docs/security/threat-model.md) · [Testing & audits](docs/security/testing-and-audits.md)

## Repository layout

```
contracts/        Soroban smart contracts (Rust workspace)
  vault/  policy/  registry/  interfaces/  strategy/
  adapter-defindex/   mock-strategy/  mock-policy/  mock-defindex/
frontend/         Next.js 16 investor app + /protocol operator cockpit
docs/             protocol documentation (overview, concepts, guides, reference, security)
model/            economic model (mutav_model.py) backing the docs economic-model page
PRODUCT.md        product brief: users, purpose, design principles
```

## Stack

Soroban (soroban-sdk 26.1) · Rust · OpenZeppelin Stellar contracts · DeFindex · Stellar Wallets Kit · Next.js 16 · TypeScript · Bun · Tailwind v4 · Stellar CLI.

## Team

- **Draau** — CEO · [@draaujpeg](https://github.com/draaujpeg)
- **Julia** — CTO · [@jubscodes](https://github.com/jubscodes) · protocol, contracts, frontend

PULSO Hackathon · Brazil track · team of 2 (both based in Brazil 🇧🇷).

## Roadmap & extensibility

The strategy allocator is a trait, so new yield venues plug in without touching custody:

- **DeFindex (live wiring)** — deploy the built `adapter-defindex` onto a DeFindex testnet vault and make it the active strategy, so real yield flows into NAV (the slot runs a mock today).
- **Soroswap / Blend** — additional adapters against the same `Strategy` trait (listed as Planned in the venue directory on `/earn/transparency`); add a `max_volatile_bps` cap when the first volatile venue lands.
- **Mainnet path** — characterize and tune the DeFindex adapter's slippage floor (today a conservative 0.5% default via `max_slippage_bps`, not yet validated against a live DeFindex vault) before any mainnet deploy.

## License

[MIT](LICENSE) © 2026 Mutav (mutav-finance).

---

*Mutav Pulse is a hackathon proof of concept of MUTAV's decentralized guarantee system, on Stellar testnet — not coupled to mutav's audited production `mutav-stellar` Fund. Built to demonstrate the integration and the trust-minimized guarantee model.*
