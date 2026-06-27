use soroban_sdk::{contracttype, Address};

pub const NAV_SCALE: i128 = 10_000_000; // 1e7
pub const VIRTUAL_OFFSET: i128 = 1;
pub const BPS_DENOM: i128 = 10_000;

// ───────────────────────────── H6 analog: RedeemRequest TTL hygiene ─────────────────────────────
//
// A RedeemRequest is an async request->claim obligation (ERC-7540 style) that
// lives across at least two transactions — request_redeem, then a later
// process_redemptions and claim — with an unbounded queue wait between them.
// Without an explicit extend_ttl the persistent Request entry decays to the
// default min and can archive while still queued, trapping process_redemptions /
// claim (needs a paid RestoreFootprint). We size it to the network max and
// re-extend on every lifecycle write/read.

/// ~5s/ledger → 86_400 / 5 = 17_280 ledgers/day. (Kept for documentation /
/// future use; the request TTL itself is pinned to the network max below.)
pub const LEDGERS_PER_DAY: u32 = 17_280;

/// Network max TTL (max_entry_ttl) — the documented testnet/mainnet cap and the
/// soroban-sdk default test-ledger value. extend_ttl traps above this.
pub const MAX_ENTRY_TTL: u32 = 6_312_000;

/// RedeemRequest TTL target: the network max. The queue wait is unbounded, so
/// size the obligation as long as the host allows.
pub const REQUEST_TTL_LEDGERS: u32 = MAX_ENTRY_TTL;

#[contracttype]
#[derive(Clone)]
pub struct StrategyAlloc {
    pub address: Address,
    pub weight_bps: u32,
    pub volatile: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct RedeemRequest {
    pub id: u32,
    pub owner: Address,
    pub shares: i128,
    pub fulfilled: bool,
    pub claimed: bool,
    pub claimable: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Underlying,
    Policy,
    ReservedForClaims,
    PremiumIncome,
    Strategies,
    NextRequestId,
    PendingRequests,
    Request(u32),
    Locked,
    MinLiquidBufferBps,
    /// Per-strategy concentration cap, in bps of TOTAL assets. Additive key
    /// (defaults to 100% = uncapped when unset) so adding it preserves the
    /// storage layout — the buffer fix ships as an in-place `upgrade()`.
    StrategyMaxDebtBps(Address),
}
