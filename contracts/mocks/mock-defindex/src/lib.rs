//! TEST DOUBLE — never deployed to mainnet. Intentionally omits `from.require_auth()`
//! in deposit/withdraw so unit tests can drive it without auth setup.
#![no_std]
// MuxedAddress is required by the FungibleToken macro even though it is not used directly.
use soroban_sdk::{contract, contractimpl, contracttype, token, vec, Address, Env, IntoVal, MuxedAddress, String, Val, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use interfaces::DefindexVault as DefindexVaultTrait;

#[contracttype]
enum DataKey {
    Underlying,
    /// Test-only: withdraw haircut in bps. The vault pays out
    /// `pro_rata * (10_000 - haircut_bps) / 10_000`, letting a test simulate a
    /// withdraw that settles below `get_asset_amounts_per_shares`' preview so the
    /// adapter's slippage floor can reject it. Defaults to 0 (faithful vault).
    WithdrawHaircutBps,
}

#[contract]
pub struct MockDefindex;

#[contractimpl]
impl MockDefindex {
    pub fn __constructor(e: &Env, underlying: Address) {
        Base::set_metadata(e, 7, String::from_str(e, "Mock DeFindex Share"), String::from_str(e, "mDFX"));
        e.storage().instance().set(&DataKey::Underlying, &underlying);
    }

    fn underlying_addr(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }
    fn held(e: &Env) -> i128 {
        token::TokenClient::new(e, &Self::underlying_addr(e)).balance(&e.current_contract_address())
    }

    /// Simulate yield: mint extra underlying to this vault.
    pub fn accrue(e: &Env, amount: i128) {
        token::StellarAssetClient::new(e, &Self::underlying_addr(e))
            .mint(&e.current_contract_address(), &amount);
    }

    /// Test-only: set the withdraw haircut (bps). Lets a test make `withdraw`
    /// settle below the `get_asset_amounts_per_shares` preview so the adapter's
    /// slippage floor trips.
    pub fn set_withdraw_haircut_bps(e: &Env, bps: u32) {
        e.storage().instance().set(&DataKey::WithdrawHaircutBps, &bps);
    }

    fn haircut_bps(e: &Env) -> i128 {
        e.storage()
            .instance()
            .get(&DataKey::WithdrawHaircutBps)
            .unwrap_or(0u32) as i128
    }
}

#[contractimpl]
impl DefindexVaultTrait for MockDefindex {
    fn deposit(e: Env, amounts_desired: Vec<i128>, _amounts_min: Vec<i128>, from: Address, _invest: bool) -> Val {
        let amount = amounts_desired.get(0).unwrap();
        let supply = Base::total_supply(&e);
        let held_before = Self::held(&e);
        let shares = if supply == 0 || held_before == 0 { amount } else { amount * supply / held_before };
        token::TokenClient::new(&e, &Self::underlying_addr(&e))
            .transfer(&from, e.current_contract_address(), &amount);
        Base::mint(&e, &from, shares);
        shares.into_val(&e)
    }

    fn withdraw(e: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128> {
        let supply = Base::total_supply(&e);
        // Defensive guard: supply==0 is unreachable after a deposit, but avoids div-by-zero.
        if supply == 0 { return vec![&e, 0]; }
        // Integer truncation: withdrawer may receive 1 raw unit less than the exact pro-rata value.
        let pro_rata = df_amount * Self::held(&e) / supply;
        // Optional haircut (default 0) lets a test settle below the preview.
        let usdc_out = pro_rata * (10_000 - Self::haircut_bps(&e)) / 10_000;
        // Honor the caller's slippage floor: real DeFindex reverts when the realised
        // amount is below `min_amounts_out`. Trap (panic) to mirror that revert so the
        // adapter's floor is actually enforced under test.
        let min_out = min_amounts_out.get(0).unwrap_or(0);
        if usdc_out < min_out {
            panic!("withdraw below min_amounts_out");
        }
        Base::update(&e, Some(&from), None, df_amount); // burn shares
        token::TokenClient::new(&e, &Self::underlying_addr(&e))
            .transfer(&e.current_contract_address(), &from, &usdc_out);
        vec![&e, usdc_out]
    }

    fn get_asset_amounts_per_shares(e: Env, vault_shares: i128) -> Vec<i128> {
        let supply = Base::total_supply(&e);
        let value = if supply == 0 { 0 } else { vault_shares * Self::held(&e) / supply };
        vec![&e, value]
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for MockDefindex {
    type ContractType = Base;
}

mod test;
