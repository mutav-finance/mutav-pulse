#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use mock_defindex::{MockDefindex, MockDefindexClient};
use crate::{AdapterDefindex, AdapterDefindexClient};

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    underlying: Address,
    adapter: AdapterDefindexClient<'static>,
    adapter_id: Address,
    dfx: MockDefindexClient<'static>,
}

fn setup() -> Ctx {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let dfx_id = e.register(MockDefindex, (underlying.clone(),));
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);
    adapter.set_vault(&dfx_id);
    Ctx {
        token: token::TokenClient::new(&e, &underlying),
        token_admin: token::StellarAssetClient::new(&e, &underlying),
        underlying, adapter, adapter_id,
        dfx: MockDefindexClient::new(&e, &dfx_id),
        e,
    }
}

#[test]
fn invest_balance_accrue_divest() {
    let c = setup();
    assert_eq!(c.adapter.underlying(), c.underlying);
    assert_eq!(c.adapter.balance(), 0); // nothing invested yet

    // The mutav vault transfers USDC to the adapter, then calls invest.
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    assert_eq!(c.adapter.balance(), 1_000); // value of df-shares

    // Yield in DeFindex lifts the adapter's reported balance.
    c.dfx.accrue(&100);
    assert_eq!(c.adapter.balance(), 1_100);

    // Divest 550 USDC back to a recipient; ceil share math returns >= 550.
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&550, &to);
    assert!(returned >= 550);
    assert_eq!(c.token.balance(&to), returned);
    // Remaining value ~ 1100 - returned.
    assert_eq!(c.adapter.balance(), 1_100 - returned);
}

#[test]
fn divest_full_value_exits_cleanly() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&1_000, &to);
    assert_eq!(returned, 1_000);
    assert_eq!(c.adapter.balance(), 0);
}

/// A malformed DeFindex vault double that returns an EMPTY per-asset vector
/// (the real ABI guarantees a single element). It also shims the token
/// `balance(Address)` the adapter reads for its df-share count, so the read is
/// non-zero and execution reaches the vec parse. No fungible-token machinery —
/// just the two surfaces the adapter touches. Used to prove the adapter
/// surfaces the typed `MalformedVaultResponse` error instead of an opaque
/// unwrap trap.
mod malformed {
    use soroban_sdk::{contract, contractimpl, Address, Env, IntoVal, Val, Vec};
    use interfaces::DefindexVault as DefindexVaultTrait;

    #[contract]
    pub struct MalformedDefindex;

    #[contractimpl]
    impl MalformedDefindex {
        pub fn __constructor(_e: &Env, _underlying: Address) {}
        /// Token-ABI shim: the adapter reads df-shares via `TokenClient::balance`.
        /// Report a fixed non-zero balance so `balance()` reaches the vec parse.
        pub fn balance(_e: &Env, _id: Address) -> i128 { 1_000 }
    }

    #[contractimpl]
    impl DefindexVaultTrait for MalformedDefindex {
        fn deposit(e: Env, _ad: Vec<i128>, _am: Vec<i128>, _from: Address, _i: bool) -> Val {
            0i128.into_val(&e)
        }
        fn withdraw(e: Env, _df: i128, _m: Vec<i128>, _from: Address) -> Vec<i128> {
            // Empty vector — the malformed shape under test.
            Vec::<i128>::new(&e)
        }
        fn get_asset_amounts_per_shares(e: Env, _s: i128) -> Vec<i128> {
            // Empty vector — the malformed shape under test.
            Vec::<i128>::new(&e)
        }
    }
}

/// balance() against a vault returning an empty per-asset vector traps with the
/// typed MalformedVaultResponse code rather than an opaque unwrap trap.
#[test]
fn balance_traps_typed_on_malformed_vault_response() {
    use crate::AdapterError;
    use malformed::{MalformedDefindex, MalformedDefindexClient};
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();

    let bad_id = e.register(MalformedDefindex, (underlying.clone(),));
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);
    adapter.set_vault(&bad_id);

    // The malformed mock reports a fixed non-zero df-share balance, so
    // balance() reaches the vec parse and traps with the typed code.
    let _ = MalformedDefindexClient::new(&e, &bad_id);

    // `balance` returns a plain i128 (no Result), so the typed panic surfaces as
    // a generic contract Error in the outer Err arm. Compare its code.
    match adapter.try_balance() {
        Err(Ok(err)) => assert_eq!(err, AdapterError::MalformedVaultResponse.into()),
        _ => panic!("expected MalformedVaultResponse typed trap"),
    }
}

use vault::{Vault, VaultClient};
use mock_policy::MockPolicy;

#[test]
fn adapter_drops_into_vault_allocator_and_earns_yield() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token_admin = token::StellarAssetClient::new(&e, &underlying);
    let token = token::TokenClient::new(&e, &underlying);

    // Wire vault + mock-policy (coverage 0) + adapter -> mock-defindex.
    let vault_id = e.register(Vault, (admin.clone(), underlying.clone()));
    let vault = VaultClient::new(&e, &vault_id);
    let policy_id = e.register(MockPolicy, (vault_id.clone(),));
    vault.set_policy(&policy_id);
    let dfx_id = e.register(MockDefindex, (underlying.clone(),));
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);
    adapter.set_vault(&dfx_id);
    vault.add_strategy(&adapter_id, &10_000, &false);

    // Investor deposits; admin rebalances reserve into DeFindex.
    let alice = Address::generate(&e);
    token_admin.mint(&alice, &10_000);
    vault.deposit(&10_000, &alice, &alice, &alice);
    vault.rebalance();
    assert_eq!(vault.total_assets(), 10_000);

    // DeFindex earns yield -> vault NAV rises with no vault changes.
    MockDefindexClient::new(&e, &dfx_id).accrue(&1_000);
    assert_eq!(vault.total_assets(), 11_000);
    assert_eq!(vault.nav_per_share(), 11_000_000); // 1.10

    // Alice redeems all -> vault divests from DeFindex -> she gets yield.
    let rid = vault.request_redeem(&alice, &10_000);
    vault.process_redemptions(&10);
    vault.claim(&rid);
    assert!(token.balance(&alice) >= 10_900); // ~ deposit + yield (minus rounding)
}
