#![cfg(test)]
//! Adversarial tests for `adapter-defindex` — strategy-manipulation scenarios.
//!
//! These complement `test.rs`. Where `test.rs` drives the adapter directly via its
//! own `Ctx`/`setup()`, the scenarios here need the FULL vault→adapter→mock-defindex
//! wiring (controller = vault) so that the adapter's slippage floor is exercised from
//! INSIDE a `vault.rebalance()` divest pass — mirroring the inline wiring used by
//! `test::adapter_drops_into_vault_allocator_and_earns_yield`.

use crate::{AdapterDefindex, AdapterDefindexClient};
use mock_defindex::MockDefindexClient;
use mock_policy::MockPolicy;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env, String};
use vault::{Vault, VaultClient};

/// SM-03 — a rebalance whose divest pass routes through `adapter-defindex` into an
/// adverse pool (withdraw haircut beyond `max_slippage_bps`) must trap at the
/// adapter slippage floor, reverting the ENTIRE rebalance. No partial slippage drain:
/// the adapter's position and the vault's cash are left exactly as they were.
///
/// Steps:
///   1. wire vault → adapter(controller = vault) → mock-defindex; add_strategy(10000, false).
///   2. deposit 10_000; rebalance (buffer 0) deploys the full 10_000 into the adapter.
///   3. raise the liquid buffer to 30% (forces a ~3_000 divest back to cash) AND set a
///      1% withdraw haircut on the pool (1% > the adapter's 0.5% default tolerance).
///   4. try_rebalance(): the divest of ~3_000 settles below the adapter's `min_amounts_out`
///      floor, the mock pool traps ("withdraw below min_amounts_out"), and the whole
///      rebalance reverts.
///
/// Invariant: try_rebalance is Err; adapter.balance() and vault.total_assets() are
/// unchanged (the position stays fully in the adapter, no slippage was realized).
#[test]
fn adv_rebalance_divest_adverse_pool_slippage_traps() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token_admin = token::StellarAssetClient::new(&e, &underlying);
    let token = token::TokenClient::new(&e, &underlying);

    // Wire vault + mock-policy (coverage 0) + adapter -> mock-defindex.
    let vault_id = e.register(
        Vault,
        (
            admin.clone(),
            underlying.clone(),
            String::from_str(&e, "Mutav Reserve"),
            String::from_str(&e, "mtvR"),
        ),
    );
    let vault = VaultClient::new(&e, &vault_id);
    let policy_id = e.register(MockPolicy, (vault_id.clone(),));
    vault.set_policy(&policy_id);
    let dfx_id = e.register(mock_defindex::MockDefindex, (underlying.clone(),));
    let dfx = MockDefindexClient::new(&e, &dfx_id);
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);
    adapter.set_vault(&dfx_id);
    // Controller is the reserve vault so vault-originated rebalance/divest authorize. (audit H1/H4)
    adapter.set_controller(&vault_id);
    vault.add_strategy(&adapter_id, &10_000, &false);

    // Investor deposits; admin rebalances reserve fully into DeFindex (default buffer 0).
    let alice = Address::generate(&e);
    token_admin.mint(&alice, &10_000);
    vault.deposit(&10_000, &alice, &alice, &alice);
    vault.rebalance();
    // The full deposit is now deployed into the adapter; vault holds no idle cash.
    assert_eq!(adapter.balance(), 10_000, "deposit deployed into adapter");
    assert_eq!(
        vault.available_held(),
        0,
        "no idle cash after first rebalance"
    );
    assert_eq!(vault.total_assets(), 10_000);

    // Now force a divest: a 30% liquid buffer means rebalance must pull ~3_000 back to
    // cash. Simultaneously make the pool adverse — a 1% withdraw haircut, larger than the
    // adapter's 0.5% default slippage tolerance — so the realised proceeds drop below the
    // adapter's `min_amounts_out` floor.
    vault.set_min_liquid_buffer_bps(&3_000);
    dfx.set_withdraw_haircut_bps(&100); // 1% > 0.5% adapter tolerance

    // The whole rebalance must revert at the adapter slippage floor — no partial drain.
    assert!(
        vault.try_rebalance().is_err(),
        "rebalance must trap at the adapter slippage floor and revert"
    );

    // INVARIANT: nothing moved. The adapter position is intact, the vault cash is intact,
    // and total assets are unchanged — the adverse-pool slippage was NOT realized.
    assert_eq!(
        adapter.balance(),
        10_000,
        "adapter position unchanged after reverted rebalance"
    );
    assert_eq!(
        vault.available_held(),
        0,
        "vault idle cash unchanged after reverted rebalance"
    );
    assert_eq!(
        vault.total_assets(),
        10_000,
        "total assets unchanged after reverted rebalance"
    );
    // Alice's shares are also untouched (no value leaked to the pool).
    assert_eq!(token.balance(&alice), 0);
}
