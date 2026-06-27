#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};
use strategy::Strategy;

#[contracttype]
enum DataKey {
    Underlying,
    Deposited, // underlying terms; balance() = token balance held
    // ADDITIVE (audit H1/H4): the controlling reserve/vault authorized to call
    // invest/divest. Appended LAST to preserve layout. No admin in this mock —
    // the setter is wiring-only so the test suite exercises the auth gate.
    Controller,
    // ADDITIVE (audit #34 / code-review H1): a slippage/fee haircut applied on
    // divest, in bps. Default 0 (loss-free) keeps every existing test green.
    // Lets the suite exercise a LOSSY adapter that reports balance() > what
    // divest() actually delivers — the divergence the ensure_liquidity /
    // rebalance fixes must bound. Test-only; never deployed.
    LossBps,
}

#[contract]
pub struct MockStrategy;

#[contractimpl]
impl MockStrategy {
    pub fn __constructor(e: &Env, underlying: Address) {
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::Deposited, &0i128);
    }

    /// Wiring-only setter (no admin gate — this is a test double). Sets the
    /// controlling reserve/vault authorized to call invest/divest so the auth
    /// gate is actually exercised by the test suite.
    pub fn set_controller(e: &Env, addr: Address) {
        e.storage().instance().set(&DataKey::Controller, &addr);
    }

    /// Test helper (no auth gate, like `accrue`): set a divest haircut in bps to
    /// simulate slippage/fees. `divest` then delivers only `amount*(10_000-bps)/
    /// 10_000`, leaving the remainder stranded so `balance()` keeps over-reporting
    /// versus what the next divest can realize. Default 0 = loss-free.
    pub fn set_loss_bps(e: &Env, bps: u32) {
        e.storage().instance().set(&DataKey::LossBps, &bps);
    }

    /// Test/demo helper: mint extra underlying to this contract to simulate yield.
    pub fn accrue(e: &Env, amount: i128) {
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        token::StellarAssetClient::new(e, &underlying).mint(&e.current_contract_address(), &amount);
    }
}

#[contractimpl]
impl Strategy for MockStrategy {
    fn invest(e: Env, amount: i128) {
        // Authorization gate (mirrors the adapter): only the controlling vault.
        let controller: Address = e.storage().instance().get(&DataKey::Controller).expect("controller not set");
        controller.require_auth();
        // Funds already transferred in by the caller; just record intent.
        let d: i128 = e.storage().instance().get(&DataKey::Deposited).unwrap_or(0);
        e.storage().instance().set(&DataKey::Deposited, &(d + amount));
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        // Authorization gate (mirrors the adapter): only the controlling vault.
        let controller: Address = e.storage().instance().get(&DataKey::Controller).expect("controller not set");
        controller.require_auth();
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        let token = token::TokenClient::new(&e, &underlying);
        let held = token.balance(&e.current_contract_address());
        let mut out = if amount < held { amount } else { held };
        // Apply the optional slippage/fee haircut: transfer only the lossy
        // amount, leaving the remainder stranded in the strategy so balance()
        // still over-reports vs. what this (and the next) divest delivers.
        let loss_bps: u32 = e.storage().instance().get(&DataKey::LossBps).unwrap_or(0);
        if loss_bps > 0 {
            out = out * (10_000 - loss_bps as i128) / 10_000;
        }
        token.transfer(&e.current_contract_address(), &to, &out);
        out
    }

    fn balance(e: Env) -> i128 {
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        token::TokenClient::new(&e, &underlying).balance(&e.current_contract_address())
    }

    fn underlying(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }
}

mod test;
