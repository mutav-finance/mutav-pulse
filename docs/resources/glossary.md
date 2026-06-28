# Glossary

Domain (Brazilian rental) and protocol terms used across mutav-pulse.

## Domain — Brazilian rental

| Term | Definition |
|---|---|
| fiança | Rental guarantee; a third party's promise to cover the tenant's obligations if they default. |
| fiador | Guarantor; the person who personally backs the tenant's lease obligations. |
| fiador institucional | Institutional guarantor; an entity (here, the reserve) that replaces an individual `fiador`. |
| garantia locatícia | Lease guarantee; the umbrella term for any mechanism securing a rental contract (deposit, surety, insurance). |
| seguro-fiança | Rental-guarantee insurance; the conventional product mutav's reserve model substitutes onchain. |
| imobiliária | Real-estate agency that brokers leases and originates guarantees into the protocol. |

## Protocol

| Term | Definition |
|---|---|
| reserve | The solvency-gated capital pool backing active guarantees; realized onchain as the vault. |
| vault | Custody contract: tokenized shares, NAV, redemption queue, strategy allocator, policy-gated `disburse`/`collect_fee`. |
| MUSD | Per-currency share token (USD line; `MBRL` for BRL) minted on deposit; replaced the generic `mtvR` share. |
| NAV | Net asset value; `total_assets` ÷ `total_supply`, the price per share. |
| coverage_required | Total capital that must stay locked to back all active guarantee legs; the solvency floor. |
| free_capital | Redeemable surplus: `max(0, stable_assets − coverage_required)`; bounds the redemption queue. |
| stable_assets | The reserve's non-volatile asset total counted toward solvency (excludes assets flagged volatile). |
| two-leg coverage | Each guarantee reserves two independent obligations: a DEFAULT leg and an EXIT leg. |
| DEFAULT leg | Coverage for unpaid rent when a tenant defaults; drawn by `cover_default`. |
| EXIT leg | Coverage for end-of-lease damages/exit costs; drawn by `cover_exit`. |
| cover_default | Policy method that pays out the DEFAULT leg (capped, EXIT leg kept reserved), reducing coverage before `vault.disburse`. |
| cover_exit | Policy method that pays out the EXIT leg; partial draws accumulate up to the leg cap. |
| fee | Premium paid to underwrite a guarantee; accrues to NAV and mints no shares (formerly "premium"). |
| solvency gate | Invariant `stable_assets >= coverage_required`, enforced by the policy before any disburse. |
| redemption queue | Async surplus-gated exit: `request_redeem → process_redemptions (admin, FIFO) → claim`. |
| strategy / adapter | Pluggable yield venue (trait) and its concrete implementation (e.g. `adapter-defindex` for DeFindex). |
| volatile flag | Per-asset marker excluding an asset from `stable_assets`, so volatile yield can't satisfy the solvency floor. |
| virtual offset | OZ anti-inflation device (`VIRTUAL_OFFSET = 1`) that defeats the first-depositor share-price attack. |
| SEP-0056 | Soroban tokenized-vault standard (port of ERC-4626); the vault's standard method surface. |
| SAC | Stellar Asset Contract; the SEP-41 token interface wrapping a Stellar asset as the vault underlying. |
| stroops | Smallest Stellar unit; 1 whole unit = 10,000,000 stroops (7 decimals). |

See [../reference/contracts/vault.md](../reference/contracts/vault.md) for the method surface and [../security/security-model.md](../security/security-model.md) for trust assumptions.
