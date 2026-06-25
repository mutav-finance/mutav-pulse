#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};
use interfaces::{Guarantee, Policy as PolicyTrait, RegistryClient, VaultClient};

const BPS_DENOM: i128 = 10_000;

#[contracttype]
enum DataKey {
    Admin,
    Vault,
    Registry,
    CoverageRatioBps,
}

#[contract]
pub struct Policy;

fn premium_of(g: &Guarantee) -> i128 { g.monthly_amount * (g.fee_bps as i128) / BPS_DENOM }

#[contractimpl]
impl Policy {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::CoverageRatioBps, &10_000u32);
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    fn vault_addr(e: &Env) -> Address { e.storage().instance().get(&DataKey::Vault).unwrap() }
    fn registry_addr(e: &Env) -> Address { e.storage().instance().get(&DataKey::Registry).unwrap() }
    fn registry(e: &Env) -> RegistryClient<'_> { RegistryClient::new(e, &Self::registry_addr(e)) }
    fn vault(e: &Env) -> VaultClient<'_> { VaultClient::new(e, &Self::vault_addr(e)) }
    fn ratio(e: &Env) -> i128 {
        let v: u32 = e.storage().instance().get(&DataKey::CoverageRatioBps).unwrap();
        v as i128
    }

    pub fn set_vault(e: &Env, addr: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Vault, &addr); }
    pub fn set_registry(e: &Env, addr: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Registry, &addr); }
    pub fn set_coverage_ratio_bps(e: &Env, bps: u32) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::CoverageRatioBps, &bps); }
    pub fn set_admin(e: &Env, new_admin: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Admin, &new_admin); }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) { Self::admin(e).require_auth(); e.deployer().update_current_contract_wasm(new_wasm_hash); }

    pub fn guarantee(e: &Env, id: u32) -> Guarantee { Self::registry(e).get(&id) }
    pub fn is_current(e: &Env, id: u32) -> bool { Self::registry(e).get(&id).paid_until > e.ledger().timestamp() }
    pub fn monthly_premium(e: &Env, id: u32) -> i128 {
        let g = Self::registry(e).get(&id);
        premium_of(&g)
    }

    pub fn sign_guarantee(e: &Env, landlord: Address, monthly_amount: i128, months_covered: u32, fee_bps: u32, period_secs: u64) -> u32 {
        Self::admin(e).require_auth();
        assert!(monthly_amount > 0 && months_covered > 0, "invalid guarantee");
        assert!(fee_bps > 0 && period_secs > 0, "invalid premium terms");
        let reg = Self::registry(e);
        let id = reg.next_id();
        reg.put(&Guarantee {
            id, landlord, monthly_amount, months_covered, months_used: 0,
            fee_bps, period_secs, paid_until: 0, active: true,
        });
        id
    }

    pub fn pay_premium(e: &Env, payer: Address, id: u32) {
        payer.require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        let premium = premium_of(&g);
        assert!(premium > 0, "zero premium");
        Self::vault(e).collect_premium(&payer, &premium);
        let now = e.ledger().timestamp();
        let base = if g.paid_until > now { g.paid_until } else { now };
        g.paid_until = base + g.period_secs;
        reg.put(&g);
        assert!(Self::vault(e).stable_assets() >= Self::coverage_required(e.clone()), "insufficient capital to activate coverage");
    }

    pub fn cover_default(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        assert!(g.months_used < g.months_covered, "coverage exhausted");
        assert!(g.paid_until > e.ledger().timestamp(), "premiums not up to date");
        g.months_used += 1;
        if g.months_used == g.months_covered { g.active = false; }
        reg.put(&g);
        Self::vault(e).disburse(&g.landlord, &g.monthly_amount);
    }

    pub fn settle_guarantee(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        g.active = false;
        reg.put(&g);
    }
}

#[contractimpl]
impl PolicyTrait for Policy {
    fn coverage_required(e: Env) -> i128 {
        let ratio = Self::ratio(&e);
        let now = e.ledger().timestamp();
        let reg = Self::registry(&e);
        let mut raw = 0i128;
        for id in reg.active_ids().iter() {
            let g = reg.get(&id);
            if g.paid_until > now {
                raw += g.monthly_amount * (g.months_covered.saturating_sub(g.months_used) as i128);
            }
        }
        raw * ratio / BPS_DENOM
    }
}

mod test;
mod test_system;
