#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};
use strategy::Strategy;

#[contracttype]
enum DataKey {
    Underlying,
    Deposited, // underlying terms; balance() = token balance held
}

#[contract]
pub struct MockStrategy;

#[contractimpl]
impl MockStrategy {
    pub fn __constructor(e: &Env, underlying: Address) {
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::Deposited, &0i128);
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
        // Funds already transferred in by the caller; just record intent.
        let d: i128 = e.storage().instance().get(&DataKey::Deposited).unwrap_or(0);
        e.storage().instance().set(&DataKey::Deposited, &(d + amount));
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        let token = token::TokenClient::new(&e, &underlying);
        let held = token.balance(&e.current_contract_address());
        let out = if amount < held { amount } else { held };
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
