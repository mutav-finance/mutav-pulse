#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use vault::{Vault, VaultClient};
use registry::{Registry, RegistryClient};
use mock_strategy::MockStrategy;
use crate::{Policy, PolicyClient};

struct Sys {
    e: Env, admin: Address, underlying: Address,
    token_admin: token::StellarAssetClient<'static>,
    vault: VaultClient<'static>, vault_id: Address,
    registry_id: Address, policy: PolicyClient<'static>, policy_id: Address,
}

fn wire() -> Sys {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let registry_id = e.register(Registry, (admin.clone(),));
    let vault_id = e.register(Vault, (admin.clone(), underlying.clone()));
    let policy_id = e.register(Policy, (admin.clone(),));
    let registry = RegistryClient::new(&e, &registry_id);
    let vault = VaultClient::new(&e, &vault_id);
    let policy = PolicyClient::new(&e, &policy_id);
    registry.set_writer(&policy_id);
    policy.set_vault(&vault_id); policy.set_registry(&registry_id); policy.set_coverage_ratio_bps(&10_000);
    vault.set_policy(&policy_id);
    Sys { token_admin: token::StellarAssetClient::new(&e, &underlying),
          e, admin, underlying, vault, vault_id, registry_id, policy, policy_id }
}

#[test]
fn full_demo_flow_holds_solvency_invariant() {
    let s = wire();
    let alice = Address::generate(&s.e);
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&alice, &20_000);
    s.token_admin.mint(&agency, &10_000);

    s.vault.deposit(&alice, &20_000);
    let sid = s.e.register(MockStrategy, (s.underlying.clone(),));
    s.vault.add_strategy(&sid, &10_000, &false);
    s.vault.rebalance();
    assert_eq!(s.policy.coverage_required(), 0); // no guarantees signed yet — coverage is vacuously zero

    let g1 = s.policy.sign_guarantee(&landlord, &500, &6, &1_000, &2_592_000);
    let g2 = s.policy.sign_guarantee(&landlord, &300, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &g1);
    s.policy.pay_premium(&agency, &g2);
    assert_eq!(s.policy.coverage_required(), 4_800);
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());

    s.policy.cover_default(&g1);
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());

    let rid = s.vault.request_redeem(&alice, &5_000);
    s.vault.process_redemptions(&10);
    if s.vault.request(&rid).fulfilled { s.vault.claim(&rid); }
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());
    let _ = (s.vault_id, s.registry_id, s.policy_id, s.admin);
}

#[test]
fn policy_swap_preserves_data_and_funds() {
    let s = wire();
    let alice = Address::generate(&s.e);
    let agency = Address::generate(&s.e);
    let landlord = Address::generate(&s.e);
    s.token_admin.mint(&alice, &10_000);
    s.token_admin.mint(&agency, &10_000);
    s.vault.deposit(&alice, &10_000);
    let gid = s.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    s.policy.pay_premium(&agency, &gid);
    let assets_before = s.vault.total_assets();
    let coverage_before = s.policy.coverage_required();

    // Deploy policy-v2, re-point writer + vault.policy. Same registry + vault.
    let policy2_id = s.e.register(Policy, (s.admin.clone(),));
    let policy2 = PolicyClient::new(&s.e, &policy2_id);
    policy2.set_vault(&s.vault_id);
    policy2.set_registry(&s.registry_id);
    policy2.set_coverage_ratio_bps(&10_000);
    RegistryClient::new(&s.e, &s.registry_id).set_writer(&policy2_id);
    s.vault.set_policy(&policy2_id);

    // Data and funds survived the swap; v2 sees the existing guarantee.
    assert_eq!(s.vault.total_assets(), assets_before);
    assert_eq!(policy2.coverage_required(), coverage_before);
    assert_eq!(policy2.guarantee(&gid).monthly_amount, 100);
    // v2 can now operate: a default pays out through the same vault.
    policy2.cover_default(&gid);
    let _ = &s.token_admin;
}
