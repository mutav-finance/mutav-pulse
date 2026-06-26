#![no_std]
//! Testnet demo faucet for the mock USDC (`CALOXSNQ…`).
//!
//! Our reserve settles in a classic-asset USDC SAC issued by `pulse-admin`; only
//! the issuer can mint, so testers can't self-mint. This faucet holds a pre-funded
//! USDC balance (minted into it by `pulse-admin`) and lets anyone `drip` a fixed
//! amount to themselves — fully on-chain, no server key. Recipients must already
//! hold a trustline to the asset (added wallet-side); `drip` reverts otherwise.
//!
//! Anti-drain: `to.require_auth()` (you can only fund yourself + you pay gas) plus
//! a per-address cooldown.
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
enum DataKey {
    Token,
    Amount,
    CooldownSecs,
    LastDrip(Address),
}

#[contract]
pub struct Faucet;

#[contractimpl]
impl Faucet {
    pub fn __constructor(e: Env, token: Address, amount: i128, cooldown_secs: u64) {
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(&DataKey::Amount, &amount);
        e.storage().instance().set(&DataKey::CooldownSecs, &cooldown_secs);
    }

    /// Send the fixed drip amount to `to`. `to` must authorize (so you can only
    /// fund yourself), must hold a trustline to the token, and must wait out the
    /// per-address cooldown between drips.
    pub fn drip(e: Env, to: Address) {
        to.require_auth();
        let cooldown: u64 = e.storage().instance().get(&DataKey::CooldownSecs).unwrap();
        let now = e.ledger().timestamp();
        let key = DataKey::LastDrip(to.clone());
        if cooldown > 0 {
            if let Some(last) = e.storage().persistent().get::<_, u64>(&key) {
                if now < last + cooldown {
                    panic!("faucet: cooldown active");
                }
            }
        }
        let token: Address = e.storage().instance().get(&DataKey::Token).unwrap();
        let amount: i128 = e.storage().instance().get(&DataKey::Amount).unwrap();
        token::TokenClient::new(&e, &token).transfer(&e.current_contract_address(), &to, &amount);
        e.storage().persistent().set(&key, &now);
    }

    pub fn token(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Token).unwrap()
    }
    pub fn amount(e: Env) -> i128 {
        e.storage().instance().get(&DataKey::Amount).unwrap()
    }
    /// Remaining USDC the faucet can dispense.
    pub fn available(e: Env) -> i128 {
        let token: Address = e.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(&e, &token).balance(&e.current_contract_address())
    }
}
