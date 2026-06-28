# Funding & access

How an investor acquires a position — and why that lives at a different layer than
the vault's yield integrations.

Mutav integrates with external protocols at **two distinct surfaces**, separated
by one question: does the integration touch the reserve's custody?

## Two integration surfaces

**1. Vault integrations — adapters (inside custody, for yield).**
Idle reserve capital is put to work through the `Strategy` trait: the vault
deploys surplus float into a yield venue via an adapter and pulls it back on
demand. DeFindex is the live adapter; Soroswap and Blend are designed against the
same interface. These integrations live *inside* the protocol — **money moves only
via the vault**, the adapter holds a position but never a standing spending
authority, and a `volatile` flag governs whether a venue's balance may back
solvency. See [yield strategies](./yield-strategies.md).

**2. Platform integrations — the access layer (outside custody, for reach).**
Before an investor can take a position they need the reserve's deposit token in
their own wallet. Acquiring it is an *access* problem, not a custody one — so it is
solved at the platform (app) layer with **client-signed** transactions the user
authorizes from their own wallet. The protocol never brokers the trade, never holds
keys, and its solvency invariant is untouched. The first such integration is the
**cUSD→cTSR swap** on the MTESOURO reserve: the app quotes and routes a swap
through the Soroswap AMM so a holder of cUSD can acquire cTSR without leaving the
page, then deposit it.

> Soroswap can appear at *both* surfaces, for different jobs: a future Soroswap
> **strategy adapter** would route idle reserve capital into LP for yield (inside
> custody, under the vault's authority); the **swap** uses Soroswap's AMM as a
> user-facing exchange venue (outside custody, under the user's own signature).
> Same venue, different trust boundary — don't conflate them.

## Funding rails (today and next)

The access layer is deliberately pluggable: each rail is an independent,
client-signed way to get the deposit token into the investor's wallet. None of
them change the contracts — they all end the same way, with the user holding the
deposit token and signing their own `deposit`.

| Rail | Status | What it does |
|---|---|---|
| **Testnet faucet** | live | Drips the demo deposit token (cUSD / cTSR / cBRL) after a trustline — the zero-friction path for testers. |
| **AMM swap** | live (cTSR) | Swaps a token the user already holds into the deposit token via Soroswap. |
| **Fiat on-ramp** | planned | Card / Pix → stablecoin, so an investor funds straight from fiat. |
| **Cross-chain bridge** | planned | Bring liquidity from another chain into the Stellar deposit token. |

Because each rail terminates at the app layer and leaves the protocol's authority
model untouched, adding one never requires a contract upgrade or a re-wire — the
same property that lets the [monetary model evolve](./yield-strategies.md) without
moving funds applies to how investors get *in*.

For the reproducible testnet setup of the faucet and the Soroswap swap, see
[deploying & wiring → acquiring the deposit token](../guides/deploying-and-wiring.md#acquiring-the-deposit-token).
