#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};
use interfaces::{Policy as PolicyTrait, VaultClient};

#[contracttype]
enum DataKey {
    Coverage,
    Vault,
}

#[contract]
pub struct MockPolicy;

#[contractimpl]
impl MockPolicy {
    pub fn __constructor(e: &Env, vault: Address) {
        e.storage().instance().set(&DataKey::Vault, &vault);
        e.storage().instance().set(&DataKey::Coverage, &0i128);
    }

    pub fn set_coverage(e: &Env, amount: i128) {
        e.storage().instance().set(&DataKey::Coverage, &amount);
    }

    /// Proxies a disburse so vault's policy-gating can be exercised in tests.
    /// Forwards the caller-supplied `coverage_after` witness verbatim so vault
    /// solvency tests exercise both the pass and the revert branch.
    pub fn call_disburse(e: &Env, to: Address, amount: i128, coverage_after: i128) {
        let vault: Address = e.storage().instance().get(&DataKey::Vault).unwrap();
        VaultClient::new(e, &vault).disburse(&to, &amount, &coverage_after);
    }

    /// Proxies a fee collection for the same reason.
    pub fn call_collect(e: &Env, from: Address, amount: i128) {
        let vault: Address = e.storage().instance().get(&DataKey::Vault).unwrap();
        VaultClient::new(e, &vault).collect_fee(&from, &amount);
    }
}

#[contractimpl]
impl PolicyTrait for MockPolicy {
    fn coverage_required(e: Env) -> i128 {
        e.storage().instance().get(&DataKey::Coverage).unwrap_or(0)
    }
}
