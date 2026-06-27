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
    // ADDITIVE (audit H1/H4): the controlling reserve/vault authorized to call
    // invest/divest. Appended LAST to preserve layout. Wiring-only setter so the
    // test suite exercises the auth gate — mirrors mock-strategy / adapter-defindex.
    Controller,
}

#[contract]
pub struct MockTesouro;

#[contractimpl]
impl MockTesouro {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        // Value and ExitBps default to 0 via `unwrap_or(0)` — no need to seed them.
    }

    fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }
    fn value(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::Value).unwrap_or(0)
    }
    fn exit_bps(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::ExitBps).unwrap_or(0)
    }
    /// Mark the position up by `amount` BRL value. Caller has already transferred
    /// the matching `cBRL` into the adapter. Shared by `invest` (vault deposit)
    /// and `accrue` (keeper-pushed yield).
    fn mark_up(e: &Env, amount: i128) {
        e.storage().instance().set(&DataKey::Value, &(Self::value(e) + amount));
    }

    /// Testnet keeper path: `amount` of `cBRL` has already been transferred into
    /// the adapter by the keeper (same convention as `invest`); marks the
    /// position up by that BRL value. Stand-in for "TESOURO NAV rose".
    pub fn accrue(e: &Env, amount: i128) {
        Self::admin(e).require_auth();
        Self::mark_up(e, amount);
    }

    /// Admin-gated forced-exit spread, in basis points (<= 10_000).
    pub fn set_exit_bps(e: &Env, bps: u32) {
        Self::admin(e).require_auth();
        assert!(bps <= 10_000);
        e.storage().instance().set(&DataKey::ExitBps, &bps);
    }

    /// Wiring-only setter: the controlling vault authorized to call invest/divest.
    /// No admin gate (test double) — mirrors mock-strategy / adapter-defindex.
    pub fn set_controller(e: &Env, addr: Address) {
        e.storage().instance().set(&DataKey::Controller, &addr);
    }
    fn controller(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Controller).expect("controller not set")
    }
}

#[contractimpl]
impl Strategy for MockTesouro {
    fn invest(e: Env, amount: i128) {
        // Authorization gate (audit H1/H4): only the controlling vault.
        Self::controller(&e).require_auth();
        // Funds already transferred in by the caller; mark the position up.
        Self::mark_up(&e, amount);
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        // Authorization gate (audit H1/H4): only the controlling vault.
        Self::controller(&e).require_auth();
        let value = Self::value(&e);
        let amt = if amount < value { amount } else { value };
        let out = amt - amt * (Self::exit_bps(&e) as i128) / 10_000;
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        token::TokenClient::new(&e, &underlying).transfer(&e.current_contract_address(), &to, &out);
        e.storage().instance().set(&DataKey::Value, &(value - amt));
        // The withheld `amt - out` stays stranded here (the forced-exit spread).
        out
    }

    fn balance(e: Env) -> i128 {
        Self::value(&e)
    }

    fn underlying(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }
}

mod test;
