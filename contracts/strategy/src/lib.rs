#![no_std]
use soroban_sdk::{contractclient, Address, Env};

/// Uniform interface every yield venue adapter implements.
/// The reserve calls these via the generated `StrategyClient`.
#[contractclient(name = "StrategyClient")]
pub trait Strategy {
    /// Caller has already transferred `amount` underlying to this contract.
    /// Deploy it into the venue.
    fn invest(env: Env, amount: i128);

    /// Withdraw up to `amount` (underlying terms) from the venue and transfer
    /// the underlying back to `to`. Returns the amount actually returned.
    fn divest(env: Env, amount: i128, to: Address) -> i128;

    /// Current position value, denominated in the underlying asset.
    fn balance(env: Env) -> i128;

    /// The underlying asset this strategy settles in.
    fn underlying(env: Env) -> Address;
}
