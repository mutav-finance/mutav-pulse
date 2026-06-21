use soroban_sdk::{contracttype, Address};

pub const BPS_DENOM: i128 = 10_000;
pub const NAV_SCALE: i128 = 10_000_000; // 1e7
pub const VIRTUAL_OFFSET: i128 = 1; // anti-inflation offset (H1)

#[contracttype]
#[derive(Clone)]
pub struct StrategyAlloc {
    pub address: Address,
    pub weight_bps: u32,
    pub volatile: bool, // price-variable venue (excluded from the coverage floor)
}

#[contracttype]
#[derive(Clone)]
pub struct Guarantee {
    pub id: u32,
    pub landlord: Address,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub months_used: u32,
    pub active: bool,
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
    CoverageRatioBps,
    ReservedForClaims,
    Strategies,        // Vec<StrategyAlloc>
    NextGuaranteeId,
    ActiveGuarantees,  // Vec<u32>
    Guarantee(u32),    // Guarantee
    NextRequestId,
    PendingRequests,   // Vec<u32> (FIFO queue)
    Request(u32),      // RedeemRequest
    Locked,            // reentrancy guard flag (M2)
}
