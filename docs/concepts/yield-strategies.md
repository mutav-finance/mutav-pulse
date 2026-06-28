# Yield Strategies

How idle reserve capital earns yield through a pluggable strategy interface,
without ever leaving the vault's custody model.

A solvency-gated reserve holds float it is contractually obligated to keep —
capital backing active guarantees. That float should not sit dead. The vault
deploys the surplus above its liquidity needs into yield venues through a uniform
`Strategy` trait, then pulls it back on demand. The key boundary holds throughout:
**money moves only via the vault**; a strategy adapter holds a position but never
becomes an independent spending authority.

## The Strategy trait

Every yield venue is reached through one small interface
(`contracts/strategy/src/lib.rs`):

- `invest(amount)` — the vault has already transferred `amount` underlying to the
  adapter; deploy it into the venue.
- `divest(amount, to)` — withdraw up to `amount` (underlying terms) and transfer
  it back to `to`; return what was actually realized.
- `balance()` — the current position value, denominated in underlying.
- `underlying()` — the asset this strategy settles in.

`balance()` is what makes the strategy show up in NAV: the vault's `total_assets`
sums every strategy's reported balance (see [the vault and its
shares](./vault-and-shares.md)). The contract is single-responsibility and venue-
agnostic — the vault knows nothing about DeFindex, lending pools, or mock doubles,
only the four methods above.

A non-negotiable invariant lives in the trait docs: `invest`/`divest` MUST
`require_auth()` the stored controller (the reserve vault), set via the adapter's
admin-gated `set_controller` setter. An equality-only `to == vault` check is
explicitly insufficient — it would let a third party force a liquidation and
realize slippage as a griefing vector.

## The vault's allocator

`rebalance` (`contracts/vault/src/lib.rs`, lines 236-302) is the policy that
decides how much sits in each venue. It is idempotent and bidirectional: it
snapshots `total_assets` once, retains `target_idle` as a liquid cash buffer
(`min_liquid_buffer_bps` of total assets — a *liquidity* optimization, not a
solvency reserve), and spreads the deployable surplus across strategies by
`weight_bps`. Each strategy's target is clamped to its `strategy_max_debt_bps`
concentration cap (default 100%, uncapped). Targets are computed once off the
frozen snapshot, so calling `rebalance` at-target is a no-op rather than a slow
drain.

The order matters: the **divest pass runs before the invest pass**. Over-target
strategies are pulled back first, raising live idle, so that the pulled-back funds
are on hand to fund the under-target deploys. The invest pass is clamped to the
*live* idle balance, not the stale snapshot — under a lossy adapter (one that
delivers less underlying than its reported balance implied) full convergence may
take an additional `rebalance` call, but the token transfer never traps on a
shortfall. `rebalance` never reads `coverage_required`; solvency stays enforced by
the `free_capital` redemption gate and the disburse ordering, not by the
allocator.

## Stable versus volatile, and the solvency line

Each strategy carries a `volatile` flag (set at `add_strategy`). It draws the line
that solvency depends on. The vault's `stable_assets` — the figure behind
`free_capital` and the disburse solvency check — counts cash plus **only
non-volatile** strategy balances (`sum_strategy_balance(e, true)`, line 206). A
strategy parked in a venue that can lose principal does not count toward the
capital the reserve is allowed to treat as backing guarantees. Volatile positions
still earn and still show up in NAV; they just cannot be leaned on for solvency.

## The DeFindex adapter

`adapter-defindex` (`contracts/adapter-defindex/src/lib.rs`) is the real-yield
implementation. `invest` deposits underlying into a DeFindex vault and receives
df-shares; `balance` values the held df-shares via the vault's own
`get_asset_amounts_per_shares` preview; `divest` burns df-shares and withdraws
underlying. It needs **two** setters wired (re-applied after any `upgrade()`):
`set_vault(defindex_vault)` (the venue it invests into) and
`set_controller(vault)` (the reserve allowed to call `invest`/`divest`).

Two safety properties are worth calling out:

- **Fail-closed Controller auth.** `controller()` traps with "controller not set"
  until wired, and `invest`/`divest` both `require_auth` it. An upgraded-but-not-
  yet-wired adapter bricks investing rather than silently accepting any caller —
  the safe direction, no funds lost.
- **Slippage floor.** Both `invest` and `divest` enforce an admin-tunable floor
  (`max_slippage_bps`, default 0.5%) against the vault's own per-share preview,
  rather than passing `min_amounts_out = [0]`. A deposit whose minted shares price
  below the floor reverts (`DepositSlippageExceeded`); a withdraw below the floor
  traps. The default is conservative, not characterized against real DeFindex
  fee/rounding behavior — tune via `set_max_slippage_bps` once that is known.

The adapter holds the df-share position; it never holds keys or a standing
authority to move the vault's money. For method signatures and error codes see the
[strategy and adapter reference](../reference/contracts/strategy-and-adapter.md);
for wiring the setters see the [deploying and wiring
guide](../guides/deploying-and-wiring.md).

## Where strategies end and the access layer begins

A strategy adapter is a **vault integration** — inside the protocol's custody,
under the vault's authority, working idle capital for yield. That is one of two
integration surfaces. The other is the **platform access layer** — client-signed
integrations *outside* custody (the testnet faucet, the Soroswap cUSD→cTSR swap,
future fiat on-ramps and bridges) that help an investor *acquire the deposit token
and get into a position* without ever touching the vault's authority model. The
same external venue can appear on both sides — a Soroswap *adapter* would deploy
reserve float for yield, while the Soroswap *swap* is a user-signed exchange — so
keep the trust boundary clear. See [funding & access](./funding-and-access.md).
