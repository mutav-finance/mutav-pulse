#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::testutils::Ledger as _;
use soroban_sdk::{token, Address, Env};
use vault::{Vault, VaultClient};
use registry::{Registry, RegistryClient};
use crate::{Policy, PolicyClient};

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    vault: VaultClient<'static>,
    policy: PolicyClient<'static>,
}

fn setup() -> Ctx {
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
    policy.set_vault(&vault_id);
    policy.set_registry(&registry_id);
    policy.set_coverage_ratio_bps(&10_000);
    vault.set_policy(&policy_id);

    Ctx {
        token: token::TokenClient::new(&e, &underlying),
        token_admin: token::StellarAssetClient::new(&e, &underlying),
        e, vault, policy,
    }
}

#[test]
fn premium_gated_coverage_and_default() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&alice, &1_000);

    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &2_592_000);
    assert_eq!(c.policy.coverage_required(), 0); // unpaid -> uncovered
    assert!(c.policy.try_cover_default(&gid).is_err()); // halted

    c.policy.pay_premium(&agency, &gid); // activates + 10 revenue
    assert!(c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 600);
    assert_eq!(c.vault.total_assets(), 1_010);
    assert_eq!(c.vault.premium_income(), 10);

    c.policy.cover_default(&gid); // pays landlord via vault.disburse
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(c.policy.coverage_required(), 500);
}

/// Ported from monolith `coverage_lapses_when_premium_period_passes` +
/// `cover_default_halted_until_premiums_current`.
/// Uses a short 100-second period so ledger.set_timestamp can advance past it.
#[test]
fn cover_default_halted_and_coverage_lapses_over_time() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&alice, &1_000);

    // Unpaid: cover_default is halted, is_current is false.
    let gid = c.policy.sign_guarantee(&landlord, &100, &6, &1_000, &100); // 100-sec period
    assert!(!c.policy.is_current(&gid));
    assert!(c.policy.try_cover_default(&gid).is_err());

    // Pay the premium -> is_current, coverage active.
    c.policy.pay_premium(&agency, &gid);
    assert!(c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 600);

    // Advance past the paid_until timestamp -> coverage lapses.
    c.e.ledger().set_timestamp(150);
    assert!(!c.policy.is_current(&gid));
    assert_eq!(c.policy.coverage_required(), 0);
    assert!(c.policy.try_cover_default(&gid).is_err());
}
