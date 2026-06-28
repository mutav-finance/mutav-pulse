# The Vault and Its Shares

How the reserve holds custody, prices tokenized shares, and conforms to the
Tokenized Vault Standard while staying solvency-gated.

The `vault` contract is the protocol's single custody point: every unit of
underlying the reserve holds lives here, and money leaves only through this
contract's guarded paths. The same contract is also the share token. This is not
an accident of packaging — ERC-4626 (and its Soroban port, SEP-0056) defines a
vault as its own SEP-41 share token, and we follow that shape directly. One
contract, two faces: the SEP-41 fungible share ledger and the custody/NAV/queue
machinery that prices it. See `contracts/vault/src/lib.rs`.

## Shares price off NAV, and NAV counts deployed capital

A share is a claim on a fraction of the reserve. Its price is the net asset value
per share: `total_assets / total_supply`. The load-bearing decision is what
`total_assets` counts. It is **cash plus deployed strategy capital** —
`available_held() + Σ strategy.balance()` (`total_assets`, line 192) — not the
vault's idle token balance alone. The reserve deploys float into yield venues via
the allocator (see [yield strategies](./yield-strategies.md)), so idle balance is
only ever a fraction of what the vault is worth. Anchoring NAV to idle balance
would crater the share price the instant capital is deployed and inflate it back
on divest. Counting strategy positions keeps NAV stable across allocation moves —
this is the anchor every other calculation trusts.

Conversions run through `mul_div_with_rounding` with a virtual offset: assets to
shares multiplies by `total_supply + VIRTUAL_OFFSET` over `total_assets +
VIRTUAL_OFFSET` (`to_shares`/`to_assets`, lines 387-397). `VIRTUAL_OFFSET = 1`
(OZ `decimals_offset = 0`) is the standard anti-inflation defense: it makes the
empty vault behave as if it holds one virtual share backed by one virtual asset,
so the first depositor cannot seed a 1-wei supply and then donate underlying to
skew the price and steal rounding dust from later depositors. Rounding direction
always favors the vault (floor on the way out, ceil on `preview_mint` /
`preview_withdraw`).

## SEP-0056 conformance without a vanilla vault

SEP-0056 is the Soroban Tokenized Vault Standard — the same surface as ERC-4626
(`query_asset`, `total_assets`, `convert_to_*`, `preview_*`, `max_*`,
`deposit`/`mint`/`withdraw`/`redeem`, plus `Deposit`/`Withdraw` events). We expose
the full surface, not a read-only subset, because the point of conformance is
interop with aggregators and ERC-4626 tooling.

The implementation is **hand-rolled on OZ `Base`** (the share token), not built on
OZ's `FungibleVault` extension. The reason is the NAV decision above. Reading
`stellar-tokens 0.7.2` settled it: `FungibleVault::total_assets` is hardcoded to
the vault's idle `token.balance(self)`, and its `convert`/`deposit`/`withdraw`
math calls that same `total_assets` internally with no override hook. The trait
bound `FungibleVault: FungibleToken<ContractType = Vault>` pins OZ's concrete
`Vault` struct — you cannot substitute a type whose `total_assets` counts strategy
positions. Because our vault deploys capital, OZ's share-price math would be wrong
for us on every operation. So we keep `Base` for the SEP-41 shares and compute NAV
here, but reuse OZ's **audited arithmetic** — `mul_div_with_rounding` + `Rounding`
from `stellar-contract-utils 0.7.2`, a pure, overflow-checked, I256-backed
primitive with no `total_assets` dependency. The convert/preview formulas are
identical to OZ's `Vault`; the only divergence from the audited reference is the
`total_assets` source. See the condensed design decisions in
[testing & audits](../security/testing-and-audits.md).

## Per-currency share tokens

Each reserve mints a share symboled for its currency, not a generic ticker. The
USD reserve mints **MUSD**; a BRL reserve would mint MBRL. Metadata is set once at
construction (`__constructor` calls `Base::set_metadata(e, 7, name, symbol)`,
decimals fixed at 7), and can be re-labelled later by the admin via
`set_token_metadata` (lines 81-84) — a non-destructive `upgrade()`-friendly path
that preserves balances, NAV, and seeded state instead of forcing a redeploy.

## Redemptions are asynchronous, not synchronous

This is the sharpest divergence from a vanilla vault. SEP-0056's `withdraw` and
`redeem` are synchronous and unconditional — but a synchronous redeem would let
capital leave below the coverage floor, defeating the reserve's entire purpose.
The reconciliation (decision D2) is **queue-only**: `withdraw` and `redeem` are
overridden to revert (lines 458-465), and `max_withdraw`/`max_redeem` return `0`
(lines 407-410). This is an explicitly conformant configuration — the standard
says a vault with withdrawals disabled MUST report `max_* = 0` and revert. The
deposit/mint side stays fully standard, emitting the SEP `Deposit` event.

Investors instead redeem through a three-step async flow:
`request_redeem` (escrows the shares into the contract) → admin
`process_redemptions` (prices each request, gates it on stable surplus, burns
shares, reserves the payout) → `claim` (transfers the reserved underlying). The
gate is `free_capital = max(0, stable_assets − coverage_required)`: a request
only fulfils when the reserve has surplus above its coverage obligations.

The payoff is attack-surface reduction. With synchronous money-out disabled, the
only paths that move funds out are the existing guarded ones —
`process_redemptions`/`claim` (reentrancy-guarded, admin-batched, FIFO) and policy
`disburse`. SEP adds only `deposit`/`mint` as genuinely new fund-moving paths, and
those move money *in*. The solvency gate behind redemptions and the disburse
ordering are detailed in the [security model](../security/security-model.md).

For exact signatures, error codes, and event topics, see the
[vault reference](../reference/contracts/vault.md).
