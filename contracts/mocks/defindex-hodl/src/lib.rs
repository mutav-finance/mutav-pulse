#![no_std]
//! Minimal hodl strategy implementing the **DeFindex strategy ABI** so a real
//! DeFindex vault can wrap it on testnet.
//!
//! Why this exists: DeFindex's own testnet yield strategies are bound to *their*
//! USDC (issuer `GATALTGT…`), which we can't mint. Our reserve settles in our own
//! mintable cUSD SAC (`CAWAVKYQ…`). To validate `adapter-defindex` against a
//! *real* DeFindex vault on testnet (Stage 1), we wrap our own USDC with a
//! strategy that just holds — no external pool, no yield. Real yield (Blend) is a
//! Stage-2 / mainnet concern. The factory does not allowlist strategy code, so a
//! hand-rolled strategy is accepted.
//!
//! ABI mirrors the **deployed** DeFindex testnet strategy exactly (8 methods:
//! `asset/balance/deposit/harvest/withdraw/get_keeper/set_keeper/__constructor`),
//! including `Result<_, StrategyError>` return types and the keeper surface the
//! keeper-aware deployed vault touches at construction.
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Bytes, Env, Val, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum StrategyError {
    NotInitialized = 401,
    NegativeNotAllowed = 410,
    InsufficientBalance = 412,
}

#[contracttype]
enum DataKey {
    Asset,
    /// Keeper address. The deployed DeFindex testnet vault is keeper-aware and
    /// reads/sets a keeper on its strategies, so we seed a default (= asset) so
    /// `get_keeper` never traps on an unset value.
    Keeper,
    /// Per-depositor balance, in underlying terms. The DeFindex vault is the only
    /// depositor (it calls with `from = vault`), but we key by address to match
    /// the reference strategy's accounting.
    Balance(Address),
}

#[contract]
pub struct HodlStrategy;

#[contractimpl]
impl HodlStrategy {
    pub fn __constructor(e: Env, asset: Address, _init_args: Vec<Val>) {
        e.storage().instance().set(&DataKey::Asset, &asset);
        e.storage().instance().set(&DataKey::Keeper, &asset);
    }

    pub fn asset(e: Env) -> Result<Address, StrategyError> {
        e.storage()
            .instance()
            .get(&DataKey::Asset)
            .ok_or(StrategyError::NotInitialized)
    }

    pub fn deposit(e: Env, amount: i128, from: Address) -> Result<i128, StrategyError> {
        if amount < 0 {
            return Err(StrategyError::NegativeNotAllowed);
        }
        from.require_auth();
        let asset: Address = e.storage().instance().get(&DataKey::Asset).unwrap();
        token::TokenClient::new(&e, &asset).transfer(&from, e.current_contract_address(), &amount);
        let key = DataKey::Balance(from);
        let bal: i128 = e.storage().persistent().get(&key).unwrap_or(0) + amount;
        e.storage().persistent().set(&key, &bal);
        Ok(bal)
    }

    pub fn withdraw(
        e: Env,
        amount: i128,
        from: Address,
        to: Address,
    ) -> Result<i128, StrategyError> {
        if amount < 0 {
            return Err(StrategyError::NegativeNotAllowed);
        }
        from.require_auth();
        let key = DataKey::Balance(from);
        let bal: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        if amount > bal {
            return Err(StrategyError::InsufficientBalance);
        }
        let asset: Address = e.storage().instance().get(&DataKey::Asset).unwrap();
        token::TokenClient::new(&e, &asset).transfer(&e.current_contract_address(), &to, &amount);
        let remaining = bal - amount;
        e.storage().persistent().set(&key, &remaining);
        Ok(remaining)
    }

    pub fn balance(e: Env, from: Address) -> Result<i128, StrategyError> {
        Ok(e.storage()
            .persistent()
            .get(&DataKey::Balance(from))
            .unwrap_or(0))
    }

    /// Hodl accrues no yield, so harvesting is a no-op.
    pub fn harvest(_e: Env, _from: Address, _data: Option<Bytes>) -> Result<(), StrategyError> {
        Ok(())
    }

    pub fn get_keeper(e: Env) -> Result<Address, StrategyError> {
        e.storage()
            .instance()
            .get(&DataKey::Keeper)
            .ok_or(StrategyError::NotInitialized)
    }

    pub fn set_keeper(e: Env, new_keeper: Address) -> Result<(), StrategyError> {
        e.storage().instance().set(&DataKey::Keeper, &new_keeper);
        Ok(())
    }
}
