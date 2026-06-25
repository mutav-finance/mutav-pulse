#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, token, vec, Address, BytesN, Env};
use strategy::Strategy;
use interfaces::DefindexVaultClient;

/// Adapter-side errors surfaced as stable `#[contracterror]` codes. Numbered in
/// the `5xx` band to stay clear of the registry `2xx`, policy `3xx`, and
/// strategy `4xx` codes. The `Strategy` trait returns plain `i128` (no `Result`),
/// so a malformed external response is surfaced via `panic_with_error!` — a
/// trap carrying a stable code rather than the opaque host trap that the prior
/// `Vec::get(0).unwrap()` produced.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AdapterError {
    /// The DeFindex vault returned an empty per-asset vector where a single
    /// underlying amount was expected (unexpected external-vault shape).
    MalformedVaultResponse = 500,
    /// `set_max_slippage_bps` was called with a value `> 10_000` (more than
    /// 100%), which would be a nonsensical floor.
    InvalidSlippageBps = 501,
}

/// Conservative default withdrawal slippage tolerance: 50 bps = 0.5%. This is a
/// SAFETY DEFAULT, not a mainnet-certified value — see `divest` for the
/// assumption it guards (real-vault fee/rounding behavior is unverified).
const DEFAULT_MAX_SLIPPAGE_BPS: u32 = 50;
const BPS_DENOM: i128 = 10_000;

#[contracttype]
enum DataKey {
    Admin,
    Underlying,
    Vault, // the DeFindex vault address
    MaxSlippageBps, // withdrawal slippage floor tolerance (u32, bps)
}

#[contract]
pub struct AdapterDefindex;

#[contractimpl]
impl AdapterDefindex {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        // Seed the conservative withdrawal slippage floor. Constructor signature
        // stays (admin, underlying) — the immutable underlying plus setter-wired
        // connections convention — so this is a default, tunable via the admin
        // `set_max_slippage_bps` setter.
        e.storage().instance().set(&DataKey::MaxSlippageBps, &DEFAULT_MAX_SLIPPAGE_BPS);
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    pub fn vault(e: &Env) -> Address { e.storage().instance().get(&DataKey::Vault).expect("vault not set") }

    /// Current withdrawal slippage tolerance in bps. Defaults to
    /// `DEFAULT_MAX_SLIPPAGE_BPS` (50 = 0.5%); falls back to the default for
    /// contracts upgraded in place before this key existed.
    pub fn max_slippage_bps(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::MaxSlippageBps)
            .unwrap_or(DEFAULT_MAX_SLIPPAGE_BPS)
    }

    pub fn set_max_slippage_bps(e: &Env, bps: u32) {
        Self::admin(e).require_auth();
        if bps > 10_000 {
            panic_with_error!(e, AdapterError::InvalidSlippageBps);
        }
        e.storage().instance().set(&DataKey::MaxSlippageBps, &bps);
    }

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

    /// First element of a DeFindex single-asset response vector. Traps with the
    /// typed `MalformedVaultResponse` code (instead of an opaque unwrap trap) if
    /// the external vault returns an empty vector.
    fn first_amount(e: &Env, v: &soroban_sdk::Vec<i128>) -> i128 {
        match v.get(0) {
            Some(x) => x,
            None => panic_with_error!(e, AdapterError::MalformedVaultResponse),
        }
    }

    /// Slippage floor for an expected underlying amount:
    /// `expected * (10_000 - max_slippage_bps) / 10_000`, floored. Guards against
    /// a non-positive expected (returns 0 — no floor on a degenerate read) and
    /// uses saturating subtraction so a bps value clamped at/over 100% yields 0
    /// rather than underflowing. `set_max_slippage_bps` rejects > 10_000, so the
    /// saturation is belt-and-suspenders.
    fn slippage_floor(e: &Env, expected: i128) -> i128 {
        if expected <= 0 {
            return 0;
        }
        let bps = Self::max_slippage_bps(e) as i128;
        let keep = BPS_DENOM.saturating_sub(bps); // [0, 10_000]
        // expected <= vault value (USDC 7-decimal scale, << 1e19), keep <= 10_000:
        // the product stays well inside i128.
        expected * keep / BPS_DENOM
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
        let value = AdapterDefindex::first_amount(&e, &AdapterDefindex::dfx(&e).get_asset_amounts_per_shares(&shares));
        if value <= 0 { return 0; }
        // amount * shares is i128; overflows only above ~1e19 raw units — unreachable at USDC 7-decimal scale.
        let burn = if amount >= value { shares } else { (amount * shares + value - 1) / value };
        // Slippage floor: read the vault's own preview of what `burn` shares are worth
        // (`get_asset_amounts_per_shares`), then require at least
        // `expected * (10_000 - max_slippage_bps) / 10_000` out of the withdraw.
        // Replaces the prior unconditional `min_amounts_out=[0]` (no floor).
        //
        // ASSUMPTION (unverified on a real vault): the preview is a faithful estimate of
        // realised withdraw proceeds. Our mock makes the two consistent, so a clean
        // withdraw clears the floor. On a real DeFindex vault, fees/rounding between the
        // preview and the settled withdraw are NOT yet characterised — this floor is a
        // conservative SAFETY DEFAULT (0.5% by default), not a mainnet-certified bound.
        // Tune via the admin `set_max_slippage_bps` setter once real behavior is confirmed.
        let expected_out = AdapterDefindex::first_amount(&e, &AdapterDefindex::dfx(&e).get_asset_amounts_per_shares(&burn));
        let min_out = AdapterDefindex::slippage_floor(&e, expected_out);
        let out = AdapterDefindex::dfx(&e).withdraw(&burn, &vec![&e, min_out], &e.current_contract_address());
        let received = AdapterDefindex::first_amount(&e, &out);
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
        AdapterDefindex::first_amount(&e, &AdapterDefindex::dfx(&e).get_asset_amounts_per_shares(&shares))
    }

    fn underlying(e: Env) -> Address {
        AdapterDefindex::underlying_addr(&e)
    }
}

mod test;
