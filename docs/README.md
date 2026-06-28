# mutav-pulse documentation

Protocol documentation for **mutav-pulse** — a solvency-gated tokenized reserve vault on Stellar/Soroban that backs Brazilian rental *fianças*, pays out tenant defaults, and earns DeFi yield on idle capital.

> Hackathon proof of concept on Stellar testnet. Not the audited production `mutav-stellar` Fund. Written for developers and technical reviewers.

New here? Start with the [Overview](./overview.md), then the [Quickstart](./guides/quickstart.md).

## Overview

- [Overview](./overview.md) — problem, solution, how-it-works, architecture, the safety spine

## Concepts

*The why and how of the protocol.*

- [Solvency & coverage](./concepts/solvency-and-coverage.md) — the `stable_assets ≥ coverage_required` invariant and the two-leg *fiança* model
- [Vault & shares](./concepts/vault-and-shares.md) — SEP-0056 conformance, NAV, virtual offset, per-currency shares, the redemption queue
- [Yield strategies](./concepts/yield-strategies.md) — the strategy trait, the allocator, the DeFindex adapter
- [Economic model](./concepts/economic-model.md) — APY, underwriting spread, the fee-as-oracle model

## Guides

*How to run, build, and deploy.*

- [Quickstart](./guides/quickstart.md) — fastest path to a running protocol against the live testnet
- [Running locally](./guides/running-locally.md) — the full local dev loop (contracts + frontend)
- [Deploying & wiring](./guides/deploying-and-wiring.md) — `bootstrap.sh` deploy + setter-wiring + the DeFindex adapter

## Reference

*Precise, code-mirroring reference.*

- Contracts — [`vault`](./reference/contracts/vault.md) · [`policy`](./reference/contracts/policy.md) · [`registry`](./reference/contracts/registry.md) · [`strategy` + `adapter`](./reference/contracts/strategy-and-adapter.md)
- [Deployments](./reference/deployments.md) — live testnet addresses + verify links
- [Errors](./reference/errors.md) — contract error codes

## Security

*The credibility layer — read these to evaluate the protocol.*

- [Security model](./security/security-model.md) — authority rules, the re-entrancy-safe witness, fail-closed design
- [Threat model](./security/threat-model.md) — attack surfaces → mitigations
- [Testing & audits](./security/testing-and-audits.md) — test coverage, audit status, design decisions

## Resources

- [Glossary](./resources/glossary.md) — domain (*fiança*, *fiador*, …) and protocol terms
- [Customer discovery](./resources/customer-discovery.md) — market research

---

The repository [`README`](../README.md) is the project entry point; `model/` holds the economic model that backs the [economic model](./concepts/economic-model.md) page.
