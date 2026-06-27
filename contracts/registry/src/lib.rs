#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};
use interfaces::{Guarantee, Registry as RegistryTrait, RegistryError};

#[contracttype]
enum DataKey {
    Admin,
    Writer,
    NextId,
    ActiveIds,    // Vec<u32>
    Guarantee(u32),
}

#[contract]
pub struct Registry;

#[contractimpl]
impl Registry {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::NextId, &0u32);
        e.storage().instance().set(&DataKey::ActiveIds, &Vec::<u32>::new(e));
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn set_writer(e: Env, writer: Address) {
        Self::admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Writer, &writer);
    }

    pub fn writer(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Writer).unwrap()
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        Self::admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>) {
        Self::admin(&e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn require_writer(e: &Env) {
        let writer: Address = e.storage().instance().get(&DataKey::Writer).unwrap();
        writer.require_auth();
    }
}

#[contractimpl]
impl RegistryTrait for Registry {
    fn next_id(e: Env, ) -> u32 {
        Registry::require_writer(&e);
        let id: u32 = e.storage().instance().get(&DataKey::NextId).unwrap();
        // checked_add: in wasm release `id + 1` wraps silently at u32::MAX -> 0,
        // colliding the live Guarantee(0) entry. Panic instead (signature stays
        // plain u32, so the RegistryClient trait is unchanged).
        e.storage()
            .instance()
            .set(&DataKey::NextId, &id.checked_add(1).expect("registry id space exhausted"));
        id
    }

    fn put(e: Env, g: Guarantee) {
        Registry::require_writer(&e);
        let mut active: Vec<u32> = e.storage().instance().get(&DataKey::ActiveIds).unwrap();
        let present = active.iter().any(|x| x == g.id);
        if g.active && !present {
            active.push_back(g.id);
        } else if !g.active && present {
            let mut next = Vec::<u32>::new(&e);
            for x in active.iter() {
                if x != g.id {
                    next.push_back(x);
                }
            }
            active = next;
        }
        e.storage().instance().set(&DataKey::ActiveIds, &active);
        e.storage().persistent().set(&DataKey::Guarantee(g.id), &g);
    }

    fn get(e: Env, id: u32) -> Result<Guarantee, RegistryError> {
        e.storage()
            .persistent()
            .get(&DataKey::Guarantee(id))
            .ok_or(RegistryError::GuaranteeNotFound)
    }

    fn active_ids(e: Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveIds).unwrap()
    }
}

mod test;
