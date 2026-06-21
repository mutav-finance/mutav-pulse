use soroban_sdk::{contracttype, Address};

pub const NAV_SCALE: i128 = 10_000_000; // 1e7
pub const VIRTUAL_OFFSET: i128 = 1;

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
}
