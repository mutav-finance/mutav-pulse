#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, vec, Address, BytesN, Env};
use strategy::Strategy;
use interfaces::DefindexVaultClient;

#[contracttype]
enum DataKey {
    Admin,
    Underlying,
    Vault, // the DeFindex vault address
}

#[contract]
pub struct AdapterDefindex;

#[contractimpl]
impl AdapterDefindex {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    pub fn vault(e: &Env) -> Address { e.storage().instance().get(&DataKey::Vault).expect("vault not set") }

    pub fn set_vault(e: &Env, addr: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Vault, &addr);
    }
    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn underlying_addr(e: &Env) -> Address { e.storage().instance().get(&DataKey::Underlying).unwrap() }
    fn dfx<'a>(e: &Env) -> DefindexVaultClient<'a> { DefindexVaultClient::new(e, &Self::vault(e)) }
    fn df_shares(e: &Env) -> i128 {
        token::TokenClient::new(e, &Self::vault(e)).balance(&e.current_contract_address())
    }
}

#[contractimpl]
impl Strategy for AdapterDefindex {
    fn invest(e: Env, amount: i128) {
        let me = e.current_contract_address();
        AdapterDefindex::dfx(&e).deposit(&vec![&e, amount], &vec![&e, 0], &me, &true);
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        // Read df_shares once; derive value inline to avoid a redundant cross-contract read.
        let shares = AdapterDefindex::df_shares(&e);
        if shares <= 0 { return 0; }
        let value = AdapterDefindex::dfx(&e).get_asset_amounts_per_shares(&shares).get(0).unwrap();
        if value <= 0 { return 0; }
        // amount * shares is i128; overflows only above ~1e19 raw units — unreachable at USDC 7-decimal scale.
        let burn = if amount >= value { shares } else { (amount * shares + value - 1) / value };
        // min_out=0: no slippage floor. The >=amount guarantee assumes the real DeFindex vault has no
        // withdrawal fee and floor-rounds at most like our mock.
        // TODO(testnet): set min_amounts_out to a real floor (e.g. amount) once real-vault withdraw behavior is confirmed.
        let out = AdapterDefindex::dfx(&e).withdraw(&burn, &vec![&e, 0], &e.current_contract_address());
        let received = out.get(0).unwrap();
        token::TokenClient::new(&e, &AdapterDefindex::underlying_addr(&e))
            .transfer(&e.current_contract_address(), &to, &received);
        received
    }

    fn balance(e: Env) -> i128 {
        // Reads only df-shares; assumes the adapter holds no idle underlying between calls.
        let shares = AdapterDefindex::df_shares(&e);
        if shares <= 0 {
            return 0;
        }
        AdapterDefindex::dfx(&e).get_asset_amounts_per_shares(&shares).get(0).unwrap()
    }

    fn underlying(e: Env) -> Address {
        AdapterDefindex::underlying_addr(&e)
    }
}

mod test;
