#![no_std]
use soroban_sdk::crypto::bn254::Bn254Fr;
use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, Bytes, BytesN, Env, Vec, U256};
use interfaces::{Guarantee, Registry as RegistryTrait};
use soroban_poseidon::poseidon_hash;

/// Fixed depth of the guarantees Merkle tree (2^5 = 32 active guarantees in the MVP).
/// The circuit (piece B) must use the SAME depth.
/// MVP: full-recompute O(n) per write. For scale (100k+), migrate to an incremental
/// Merkle Sum Tree (O(depth) update + total obligations proven in the root).
const TREE_DEPTH: u32 = 5;

#[contracttype]
enum DataKey {
    Admin,
    Writer,
    NextId,
    ActiveIds,    // Vec<u32>
    Guarantee(u32),
    GuaranteesRoot, // BytesN<32> — Poseidon-Merkle seal of the active guarantees
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

    pub fn set_writer(e: Env, policy: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Writer, &policy);
    }

    pub fn writer(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Writer).unwrap()
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn require_writer(e: &Env) {
        let writer: Address = e.storage().instance().get(&DataKey::Writer).unwrap();
        writer.require_auth();
    }

    // --- Piece B: Poseidon-Merkle accumulator ---

    /// 2-input Poseidon (t=3) — matches the circomlib used in the circuit.
    fn hash2(e: &Env, a: U256, b: U256) -> U256 {
        poseidon_hash::<3, Bn254Fr>(e, &vec![e, a, b])
    }

    /// Leaf of an active guarantee = Poseidon(id, obligation).
    /// `obligation = monthly_amount * (months_covered - months_used)` — same computation as
    /// `coverage_required`. (Conscious simplification: does not filter `paid_until > now`;
    /// counts all active ones, making the proven obligation an upper bound = safe side.)
    ///
    /// The writer (`policy`) guarantees `months_used <= months_covered` and `monthly_amount > 0`
    /// for active guarantees. We still use saturating arithmetic: if malformed data slips through,
    /// the leaf contributes obligation 0 instead of panicking and locking up `put()` (the root is
    /// wrong, but the write does not break). For valid data the value is identical.
    fn leaf(e: &Env, g: &Guarantee) -> U256 {
        let remaining = g.months_covered.saturating_sub(g.months_used) as i128;
        let obligation = g.monthly_amount.saturating_mul(remaining).max(0);
        Self::hash2(e, U256::from_u32(e, g.id), U256::from_u128(e, obligation as u128))
    }

    /// Recomputes the tree root (fixed depth, leaves to the left, rest = zero).
    /// Leaf order = order of `active_ids()` (the off-chain prover reads the same order).
    fn compute_root(e: &Env) -> BytesN<32> {
        let active: Vec<u32> = e.storage().instance().get(&DataKey::ActiveIds).unwrap();

        // Level 0: the leaves of the active guarantees.
        let mut level: Vec<U256> = Vec::new(e);
        for id in active.iter() {
            let g: Guarantee = e.storage().persistent().get(&DataKey::Guarantee(id)).unwrap();
            level.push_back(Self::leaf(e, &g));
        }

        // Climbs TREE_DEPTH levels; the missing sibling is the "zero" of that level.
        let mut zero = U256::from_u32(e, 0);
        let mut d = 0u32;
        while d < TREE_DEPTH {
            let mut next: Vec<U256> = Vec::new(e);
            let len = level.len();
            let mut j = 0u32;
            while j < len {
                let left = level.get(j).unwrap();
                let right = if j + 1 < len { level.get(j + 1).unwrap() } else { zero.clone() };
                next.push_back(Self::hash2(e, left, right));
                j += 2;
            }
            if next.len() == 0 {
                // empty tree: the root is the zero-subtree of this level.
                next.push_back(Self::hash2(e, zero.clone(), zero.clone()));
            }
            level = next;
            zero = Self::hash2(e, zero.clone(), zero.clone());
            d += 1;
        }

        Self::u256_to_bytesn(e, &level.get(0).unwrap())
    }

    fn u256_to_bytesn(e: &Env, v: &U256) -> BytesN<32> {
        let b: Bytes = v.to_be_bytes();
        let mut arr = [0u8; 32];
        let mut i = 0u32;
        while i < 32 {
            arr[i as usize] = b.get(i).unwrap();
            i += 1;
        }
        BytesN::from_array(e, &arr)
    }

    fn recompute_root(e: &Env) {
        let root = Self::compute_root(e);
        e.storage().instance().set(&DataKey::GuaranteesRoot, &root);
    }
}

#[contractimpl]
impl RegistryTrait for Registry {
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
            // The tree has fixed capacity 2^TREE_DEPTH. Exceeding it would make
            // `compute_root` return only the first sub-root (overflow leaves
            // disappear from the root AND from the obligations sum) → false solvency
            // by omission. Fail loud instead of corrupting silently: growing requires
            // a coordinated upgrade (registry + circuit/VK), never silent.
            if active.len() >= (1u32 << TREE_DEPTH) {
                panic!("registry: tree capacity exhausted (max active guarantees)");
            }
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
        Registry::recompute_root(&e);
    }

    fn get(e: Env, id: u32) -> Guarantee {
        e.storage().persistent().get(&DataKey::Guarantee(id)).unwrap()
    }

    fn active_ids(e: Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveIds).unwrap()
    }

    fn guarantees_root(e: Env) -> BytesN<32> {
        e.storage()
            .instance()
            .get(&DataKey::GuaranteesRoot)
            .unwrap_or_else(|| Registry::compute_root(&e))
    }
}

mod test;
