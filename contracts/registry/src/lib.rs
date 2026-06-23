#![no_std]
use soroban_sdk::crypto::bn254::Bn254Fr;
use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, Bytes, BytesN, Env, Vec, U256};
use interfaces::{Guarantee, Registry as RegistryTrait};
use soroban_poseidon::poseidon_hash;

/// Profundidade fixa da árvore Merkle das garantias (2^8 = 256 garantias ativas no MVP).
/// O circuito (peça B) tem que usar a MESMA profundidade.
const TREE_DEPTH: u32 = 8;

#[contracttype]
enum DataKey {
    Admin,
    Writer,
    NextId,
    ActiveIds,    // Vec<u32>
    Guarantee(u32),
    GuaranteesRoot, // BytesN<32> — selo Poseidon-Merkle das garantias ativas
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

    // --- Peça B: acumulador Poseidon-Merkle ---

    /// Poseidon de 2 entradas (t=3) — bate com o circomlib usado no circuito.
    fn hash2(e: &Env, a: U256, b: U256) -> U256 {
        poseidon_hash::<3, Bn254Fr>(e, &vec![e, a, b])
    }

    /// Folha de uma garantia ativa = Poseidon(id, obrigação).
    /// `obrigação = monthly_amount * (months_covered - months_used)` — mesma conta da
    /// `coverage_required`. (Simplificação consciente: não filtra `paid_until > now`;
    /// conta todas as ativas, tornando a obrigação provada um limite superior = lado seguro.)
    ///
    /// O writer (`policy`) garante `months_used <= months_covered` e `monthly_amount > 0` para
    /// garantias ativas. Mesmo assim usamos aritmética saturante: se um dado malformado escapar,
    /// a folha contribui obrigação 0 em vez de dar panic e travar o `put()` (a raiz fica errada,
    /// mas a escrita não quebra). Para dados válidos o valor é idêntico.
    fn leaf(e: &Env, g: &Guarantee) -> U256 {
        let remaining = g.months_covered.saturating_sub(g.months_used) as i128;
        let obligation = g.monthly_amount.saturating_mul(remaining).max(0);
        Self::hash2(e, U256::from_u32(e, g.id), U256::from_u128(e, obligation as u128))
    }

    /// Recalcula a raiz da árvore (profundidade fixa, folhas à esquerda, resto = zero).
    /// Ordem das folhas = ordem de `active_ids()` (o prover off-chain lê a mesma ordem).
    fn compute_root(e: &Env) -> BytesN<32> {
        let active: Vec<u32> = e.storage().instance().get(&DataKey::ActiveIds).unwrap();

        // Nível 0: as folhas das garantias ativas.
        let mut level: Vec<U256> = Vec::new(e);
        for id in active.iter() {
            let g: Guarantee = e.storage().persistent().get(&DataKey::Guarantee(id)).unwrap();
            level.push_back(Self::leaf(e, &g));
        }

        // Sobe TREE_DEPTH níveis; o sibling ausente é o "zero" daquele nível.
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
                // árvore vazia: a raiz é a subárvore-zero deste nível.
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
