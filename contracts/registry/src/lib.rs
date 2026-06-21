#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};
use interfaces::{Guarantee, Registry as RegistryTrait};

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

    fn require_writer(e: &Env) {
        let writer: Address = e.storage().instance().get(&DataKey::Writer).unwrap();
        writer.require_auth();
    }
}

#[contractimpl]
impl RegistryTrait for Registry {
    fn set_writer(e: Env, policy: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Writer, &policy);
    }

    fn writer(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Writer).unwrap()
    }

    fn set_admin(e: Env, new_admin: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    fn upgrade(e: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn next_id(e: Env, ) -> u32 {
        Registry::require_writer(&e);
        let id: u32 = e.storage().instance().get(&DataKey::NextId).unwrap();
        e.storage().instance().set(&DataKey::NextId, &(id + 1));
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

    fn get(e: Env, id: u32) -> Guarantee {
        e.storage().persistent().get(&DataKey::Guarantee(id)).unwrap()
    }

    fn active_ids(e: Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveIds).unwrap()
    }
}

mod test;
