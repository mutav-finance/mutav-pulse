#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env, String};
use mock_defindex::{MockDefindex, MockDefindexClient};
use crate::{AdapterDefindex, AdapterDefindexClient};

struct Ctx {
    e: Env,
    token: token::TokenClient<'static>,
    token_admin: token::StellarAssetClient<'static>,
    underlying: Address,
    adapter: AdapterDefindexClient<'static>,
    adapter_id: Address,
    controller: Address,
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
    // Controller is a distinct generated address (a strategy never invests into
    // itself). Under mock_all_auths_allowing_non_root_auth its non-root
    // require_auth passes for direct client calls. (audit H1/H4 gate)
    let controller = Address::generate(&e);
    adapter.set_controller(&controller);
    Ctx {
        token: token::TokenClient::new(&e, &underlying),
        token_admin: token::StellarAssetClient::new(&e, &underlying),
        underlying, adapter, adapter_id, controller,
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
fn default_max_slippage_is_conservative() {
    let c = setup();
    // Constructor seeds the conservative 0.5% default.
    assert_eq!(c.adapter.max_slippage_bps(), 50);
}

#[test]
fn admin_can_tune_slippage_and_invalid_is_rejected() {
    use crate::AdapterError;
    let c = setup();
    c.adapter.set_max_slippage_bps(&100);
    assert_eq!(c.adapter.max_slippage_bps(), 100);
    // > 100% is nonsensical and rejected with the typed code.
    match c.adapter.try_set_max_slippage_bps(&10_001) {
        Err(Ok(err)) => assert_eq!(err, AdapterError::InvalidSlippageBps.into()),
        _ => panic!("expected InvalidSlippageBps"),
    }
    // The rejected write left the prior value intact.
    assert_eq!(c.adapter.max_slippage_bps(), 100);
}

// --- Audit H1 (CRITICAL) / H4: controller authorization gate ---

/// H1: divest must trap for any caller that is not the stored controller. After a
/// controller-authorized invest, drop all auths and assert a non-controller's
/// `divest` returns Err — proving no third party can drain the position.
#[test]
fn divest_traps_for_non_controller_caller() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000); // controller-authorized (mock_all_auths active)
    // No auths satisfied -> the controller's require_auth cannot pass.
    c.e.set_auths(&[]);
    let attacker = Address::generate(&c.e);
    assert!(c.adapter.try_divest(&100, &attacker).is_err());
}

/// H4: invest must trap for any caller that is not the stored controller.
#[test]
fn invest_traps_for_non_controller_caller() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.e.set_auths(&[]);
    assert!(c.adapter.try_invest(&1_000).is_err());
}

/// GREEN guard: with the controller set and authorized (mock_all_auths), divest
/// still returns the underlying to `to`. Behavior-preserving for the legit path.
#[test]
fn divest_succeeds_for_controller() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&500, &to);
    assert!(returned >= 500);
    assert_eq!(c.token.balance(&to), returned);
}

/// `set_controller` is admin-gated, and `controller()` is fail-closed before any
/// set. Mirrors `admin_can_tune_slippage_and_invalid_is_rejected`'s structure.
#[test]
fn controller_setter_is_admin_gated() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);

    // (a) Fail-closed: controller() traps before any set_controller.
    assert!(adapter.try_controller().is_err());

    // (b) Admin-gated: with no auths satisfied, set_controller traps.
    e.set_auths(&[]);
    let x = Address::generate(&e);
    assert!(adapter.try_set_controller(&x).is_err());
}

/// A withdraw whose realised proceeds stay within the slippage tolerance clears
/// the floor and succeeds. The mock's preview and settled amount are consistent
/// (no haircut), so the floor (expected * 0.995) is comfortably met.
#[test]
fn divest_within_tolerance_succeeds() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    c.dfx.accrue(&100); // value now 1_100
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&550, &to);
    assert!(returned >= 550);
    assert_eq!(c.token.balance(&to), returned);
}

/// With a withdraw haircut larger than the adapter's tolerance, the realised
/// amount falls below `min_amounts_out` and the vault reverts — the adapter no
/// longer silently accepts an unbounded shortfall (the old `min_amounts_out=[0]`
/// behavior). The mock honours the floor by trapping, mirroring a real vault's
/// revert.
#[test]
#[should_panic]
fn divest_out_of_tolerance_is_rejected() {
    let c = setup();
    c.token_admin.mint(&c.adapter_id, &1_000);
    c.adapter.invest(&1_000);
    // 0.5% adapter tolerance vs a 1% withdraw haircut -> realised < floor -> revert.
    c.dfx.set_withdraw_haircut_bps(&100);
    let to = Address::generate(&c.e);
    c.adapter.divest(&500, &to);
}

/// A haircut within the configured tolerance still clears the floor. Raise the
/// adapter tolerance to 2% and apply a 1% haircut: realised (~0.99 * expected) is
/// above the floor (~0.98 * expected), so the withdraw settles.
#[test]
fn divest_haircut_within_raised_tolerance_succeeds() {
    let c = setup();
    c.adapter.set_max_slippage_bps(&200); // 2% tolerance
    c.token_admin.mint(&c.adapter_id, &10_000);
    c.adapter.invest(&10_000);
    c.dfx.set_withdraw_haircut_bps(&100); // 1% haircut, inside tolerance
    let to = Address::generate(&c.e);
    let returned = c.adapter.divest(&5_000, &to);
    assert!(returned > 0);
    assert_eq!(c.token.balance(&to), returned);
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
    let dfx_id = e.register(MockDefindex, (underlying.clone(),));
    let adapter_id = e.register(AdapterDefindex, (admin.clone(), underlying.clone()));
    let adapter = AdapterDefindexClient::new(&e, &adapter_id);
    adapter.set_vault(&dfx_id);
    // Controller is the reserve vault so vault-originated rebalance/divest authorize. (audit H1/H4)
    adapter.set_controller(&vault_id);
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
