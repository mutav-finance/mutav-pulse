# Overview

What mutav-pulse is, the problem it solves, and how the protocol is put together.

## The problem

In Brazil a lease cannot be signed without a rental guarantee (*garantia locatícia*) — it is mandatory by law. The legally-recognized forms (a personal guarantor / *fiador*, a multi-month deposit, *seguro-fiança* insurance, or a *título de capitalização*) all lock up tenant capital, exclude renters without a wealthy guarantor, and leave landlords exposed on default. Every one of them is also **opaque**: a landlord cannot verify that the guarantee behind their lease is actually solvent.

## The solution

Mutav is a **fiador institucional** (institutional guarantor). Instead of a personal *fiador* or a deposit, **Mutav provides the *fiança* itself** — it stands as guarantor on the lease and pays the landlord if the tenant defaults. The difference: Mutav's *fiança* is backed by an **on-chain, solvency-verifiable reserve**. A landlord (or anyone) can confirm in real time that the guarantor is solvent — something no personal *fiador* or opaque insurer offers.

**mutav-pulse** is a proof of concept of that reserve on Stellar testnet: a tokenized USDC reserve that backs the *fiança*, makes its solvency verifiable on-chain, pays out defaults, and earns DeFi yield on idle capital.

## How it works

| Actor | Interaction |
|---|---|
| **Tenant** | Gets a *fiança*, pays a monthly **fee**. No personal guarantor, no large deposit. |
| **Investor** | Deposits USDC into the reserve, receives `MUSD` vault shares (a tokenized, yield-bearing position). Their capital backs the *fianças*. |
| **Mutav (operator)** | Underwrites guarantees (`sign_guarantee`), pays landlords on default (`cover_default`) and on property recovery (`cover_exit`), allocates idle capital to yield. |

The reserve is **solvency-gated**: the invariant `stable_assets ≥ coverage_required` is enforced on every payout and every redemption, and only surplus capital (`free_capital`) can ever leave. See [solvency & coverage](./concepts/solvency-and-coverage.md).

## Architecture

A modular, single-responsibility Soroban (Rust) design — custody, data, and the underwriting model are split by how often each changes, so the monetary model can evolve without touching the contract that holds the money. Contracts are wired by setters at deploy time (`bootstrap.sh`), never constructor-baked, and every contract is upgradeable.

| Contract | Responsibility |
|---|---|
| [`vault`](./reference/contracts/vault.md) | Custody — USDC funds, tokenized `MUSD` shares, NAV, surplus-gated redemption queue, strategy allocator. |
| [`policy`](./reference/contracts/policy.md) | Underwriting brain — fee model, two-leg coverage, `cover_default` / `cover_exit`. Swappable without moving funds. |
| [`registry`](./reference/contracts/registry.md) | Writer-gated typed store of guarantee records + the O(1) coverage aggregate. |
| [`strategy` + `adapter-defindex`](./reference/contracts/strategy-and-adapter.md) | Pluggable yield venues; the DeFindex adapter is the real integration. |

The **safety spine** — money moves only through the `vault`; guarantee data is written only by the `policy`; solvency is enforced at the `vault`. See the [security model](./security/security-model.md) for how these are enforced re-entrancy-safely.

## Where to go next

- **Run it** → [Quickstart](./guides/quickstart.md)
- **Understand it** → [Solvency & coverage](./concepts/solvency-and-coverage.md), [Vault & shares](./concepts/vault-and-shares.md), [Yield strategies](./concepts/yield-strategies.md), [Funding & access](./concepts/funding-and-access.md), [Economic model](./concepts/economic-model.md)
- **Evaluate it** → [Security model](./security/security-model.md), [Threat model](./security/threat-model.md), [Testing & audits](./security/testing-and-audits.md)
- **Reference** → [Contract reference](./reference/contracts/vault.md), [Deployments](./reference/deployments.md)
