#![cfg(test)]
use soroban_sdk::crypto::bn254::Bn254Fr;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{bytesn, vec, Address, Bytes, BytesN, Env, U256, Vec};
use interfaces::Guarantee;
use soroban_poseidon::poseidon_hash;
use crate::{Registry, RegistryClient};

const TREE_DEPTH: u32 = 5;

fn g(_e: &Env, id: u32, landlord: &Address, active: bool) -> Guarantee {
    Guarantee {
        id,
        landlord: landlord.clone(),
        monthly_amount: 100,
        months_covered: 6,
        months_used: 0,
        fee_bps: 1_000,
        period_secs: 2_592_000,
        paid_until: 0,
        active,
    }
}

#[test]
fn writer_gating_and_active_set() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);
    assert_eq!(r.writer(), policy);

    let id0 = r.next_id();
    let id1 = r.next_id();
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);

    r.put(&g(&e, id0, &landlord, true));
    r.put(&g(&e, id1, &landlord, true));
    assert_eq!(r.active_ids().len(), 2);
    assert_eq!(r.get(&id0).monthly_amount, 100);

    // Deactivate id0 -> drops from active set.
    r.put(&g(&e, id0, &landlord, false));
    assert_eq!(r.active_ids().len(), 1);
    assert_eq!(r.active_ids().get(0).unwrap(), id1);
}

// --- Peça B: árvore Poseidon-Merkle ---

fn hash2(e: &Env, a: U256, b: U256) -> U256 {
    poseidon_hash::<3, Bn254Fr>(e, &vec![e, a, b])
}

fn leaf(e: &Env, g: &Guarantee) -> U256 {
    let ob = g.monthly_amount * ((g.months_covered - g.months_used) as i128);
    hash2(e, U256::from_u32(e, g.id), U256::from_u128(e, ob as u128))
}

/// Reimplementação direta do fold (mesma estrutura), p/ pinar folha + ordem + profundidade.
fn fold_root(e: &Env, leaves: Vec<U256>) -> BytesN<32> {
    let mut level = leaves;
    let mut zero = U256::from_u32(e, 0);
    let mut d = 0u32;
    while d < TREE_DEPTH {
        let mut next: Vec<U256> = Vec::new(e);
        let len = level.len();
        let mut j = 0u32;
        while j < len {
            let left = level.get(j).unwrap();
            let right = if j + 1 < len { level.get(j + 1).unwrap() } else { zero.clone() };
            next.push_back(hash2(e, left, right));
            j += 2;
        }
        if next.len() == 0 {
            next.push_back(hash2(e, zero.clone(), zero.clone()));
        }
        level = next;
        zero = hash2(e, zero.clone(), zero.clone());
        d += 1;
    }
    let v = level.get(0).unwrap();
    let b: Bytes = v.to_be_bytes();
    let mut arr = [0u8; 32];
    let mut i = 0u32;
    while i < 32 {
        arr[i as usize] = b.get(i).unwrap();
        i += 1;
    }
    BytesN::from_array(e, &arr)
}

#[test]
fn root_is_pure_function_of_active_set() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let empty = r.guarantees_root(); // árvore vazia (determinística)
    assert_eq!(r.guarantees_root(), empty, "raiz vazia deve ser determinística");

    let id0 = r.next_id();
    let id1 = r.next_id();

    r.put(&g(&e, id0, &landlord, true));
    let r1 = r.guarantees_root();
    assert_ne!(r1, empty, "adicionar garantia deve mudar a raiz");

    r.put(&g(&e, id1, &landlord, true));
    let r2 = r.guarantees_root();
    assert_ne!(r2, r1, "segunda garantia deve mudar a raiz");

    // Remover id1 -> volta exatamente à raiz de {id0}.
    r.put(&g(&e, id1, &landlord, false));
    assert_eq!(r.guarantees_root(), r1, "remover deve restaurar a raiz anterior");

    // Remover id0 -> volta à raiz vazia.
    r.put(&g(&e, id0, &landlord, false));
    assert_eq!(r.guarantees_root(), empty, "esvaziar deve restaurar a raiz vazia");
}

#[test]
fn root_matches_offchain_circomlibjs() {
    // Cross-check 1.5: a raiz on-chain bate com a reconstrução off-chain em circomlibjs
    // (Poseidon independente do soroban-poseidon). Valor de `prover/derisk-merkle.mjs`
    // para o conjunto {id=0, id=1}, ambos com obrigação = 100*(6-0) = 600.
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = r.next_id();
    let id1 = r.next_id();
    r.put(&g(&e, id0, &landlord, true));
    r.put(&g(&e, id1, &landlord, true));

    let expected: BytesN<32> =
        bytesn!(&e, 0x2fc574f6cbc7b7c81c22b1680398106c66c1f59066c5eeca5387bf1720f4af4d);
    assert_eq!(r.guarantees_root(), expected, "raiz on-chain deve casar com circomlibjs");
}

#[test]
fn root_matches_offchain_circomlibjs_odd() {
    // n=3 (ímpar) — exercita o padding de folha ímpar; cross-checado com circomlibjs.
    // Valor de `prover/derisk-merkle.mjs` para {id=0,1,2}, obrigação 600 cada.
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = r.next_id();
    let id1 = r.next_id();
    let id2 = r.next_id();
    r.put(&g(&e, id0, &landlord, true));
    r.put(&g(&e, id1, &landlord, true));
    r.put(&g(&e, id2, &landlord, true));

    let expected: BytesN<32> =
        bytesn!(&e, 0x29165219251eb7206499ee0daa3626be631a2eea6478c5be1ef5534a0f0804ae);
    assert_eq!(r.guarantees_root(), expected, "raiz on-chain (n=3) deve casar com circomlibjs");
}

#[test]
fn root_matches_direct_fold() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let id0 = r.next_id();
    let id1 = r.next_id();
    let g0 = g(&e, id0, &landlord, true);
    let g1 = g(&e, id1, &landlord, true);
    r.put(&g0);
    r.put(&g1);

    // Ordem das folhas = ordem de active_ids() = [id0, id1].
    let expected = fold_root(&e, vec![&e, leaf(&e, &g0), leaf(&e, &g1)]);
    assert_eq!(r.guarantees_root(), expected, "raiz on-chain deve casar com o fold direto");
}

#[test]
#[should_panic(expected = "capacidade")]
fn put_rejects_beyond_tree_capacity() {
    // A 2^TREE_DEPTH+1-ésima garantia ativa deve ser rejeitada (senão a raiz
    // truncaria silenciosamente e abriria omissão de obrigações).
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let policy = Address::generate(&e);
    let landlord = Address::generate(&e);

    let id = e.register(Registry, (admin.clone(),));
    let r = RegistryClient::new(&e, &id);
    r.set_writer(&policy);

    let cap = 1u32 << TREE_DEPTH;
    for i in 0..cap {
        // O recompute O(n) por put acumula budget no Env de teste; resetar isola
        // a LÓGICA do cap (o custo por-put é avaliado à parte — ver plano 6.4).
        e.cost_estimate().budget().reset_unlimited();
        r.put(&g(&e, i, &landlord, true)); // preenche a capacidade
    }
    assert_eq!(r.active_ids().len(), cap);
    e.cost_estimate().budget().reset_unlimited();
    r.put(&g(&e, cap, &landlord, true)); // a +1 -> panic
}
