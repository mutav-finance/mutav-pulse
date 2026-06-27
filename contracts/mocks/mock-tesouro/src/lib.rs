#![no_std]
//! Mock TESOURO yield strategy for the BRL-native reserve (testnet only).
//!
//! Represents a TESOURO treasury position whose BRL value is **pushed by a
//! keeper to mirror the real instrument** (not an APY estimate), with a
//! configurable exit cost. Settles in `cBRL` (the reserve's BRL `underlying`),
//! so `balance()` is BRL-denominated and NAV marks back to BRL on every read.
//!
//! `value` tracks the BRL value of the position. The keeper pre-transfers `cBRL`
//! into the adapter and calls `accrue` (same convention as the vault's `invest`)
//! to simulate "TESOURO NAV rose". A forced `divest` withholds an `exit_bps`
//! spread that stays stranded here — modelling the cost of a forced unwind. On
//! mainnet, `balance()` reads the real Etherfuse NAV and `accrue` goes away.
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};
use strategy::Strategy;

#[contracttype]
enum DataKey {
    Underlying,
    Admin,
    Value,   // BRL value of the position (underlying terms)
    ExitBps, // forced-exit spread, basis points
}

#[contract]
pub struct MockTesouro;

#[contractimpl]
impl MockTesouro {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::Value, &0i128);
        e.storage().instance().set(&DataKey::ExitBps, &0u32);
    }

    fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Testnet keeper path: `amount` of `cBRL` has already been transferred into
    /// the adapter by the keeper (same convention as `invest`); marks the
    /// position up by that BRL value. Stand-in for "TESOURO NAV rose".
    pub fn accrue(e: &Env, amount: i128) {
        Self::admin(e).require_auth();
        let v: i128 = e.storage().instance().get(&DataKey::Value).unwrap_or(0);
        e.storage().instance().set(&DataKey::Value, &(v + amount));
    }

    /// Admin-gated forced-exit spread, in basis points (<= 10_000).
    pub fn set_exit_bps(e: &Env, bps: u32) {
        Self::admin(e).require_auth();
        assert!(bps <= 10_000);
        e.storage().instance().set(&DataKey::ExitBps, &bps);
    }
}

#[contractimpl]
impl Strategy for MockTesouro {
    fn invest(e: Env, amount: i128) {
        // Funds already transferred in by the caller; mark the position up.
        let v: i128 = e.storage().instance().get(&DataKey::Value).unwrap_or(0);
        e.storage().instance().set(&DataKey::Value, &(v + amount));
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        let value: i128 = e.storage().instance().get(&DataKey::Value).unwrap_or(0);
        let amt = if amount < value { amount } else { value };
        let exit_bps: u32 = e.storage().instance().get(&DataKey::ExitBps).unwrap_or(0);
        let out = amt - amt * (exit_bps as i128) / 10_000;
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        token::TokenClient::new(&e, &underlying).transfer(&e.current_contract_address(), &to, &out);
        e.storage().instance().set(&DataKey::Value, &(value - amt));
        // The withheld `amt - out` stays stranded here (the forced-exit spread).
        out
    }

    fn balance(e: Env) -> i128 {
        e.storage().instance().get(&DataKey::Value).unwrap_or(0)
    }

    fn underlying(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }
}
