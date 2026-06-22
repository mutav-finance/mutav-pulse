# mutav-pulse Modular Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the `reserve` monolith into composed single-responsibility contracts — `vault` (custody), `registry` (storage), `policy` (underwriting brain) — behind a shared `interfaces` crate, so the monetary model can be swapped/upgraded without re-touching custody.

**Architecture:** Money lives only in `vault`; guarantee data is written only by `policy`; the solvency invariant `stable_assets ≥ coverage_required` is enforced at the `vault`. Cross-contract calls go through client traits in a shared `interfaces` rlib (no crate depends on another contract's crate). Behavior is preserved from the monolith — this is a repackaging, not a feature change.

**Tech Stack:** Rust, soroban-sdk 26.1.0, stellar-tokens 0.7.2, Cargo workspace, `stellar contract build`.

## Global Constraints

- soroban-sdk = `26.1.0`; stellar-tokens = `0.7.2`; edition `2021`; toolchain `stable`.
- Wasm builds with `stellar contract build` (NOT raw `cargo build --release`).
- Tests use `e.mock_all_auths_allowing_non_root_auth()` (SAC mint nests auth).
- `FungibleToken` impls require `MuxedAddress` imported; burn/escrow shares via internal `Base::update` (the public `transfer` wants a `MuxedAddress`).
- All amounts `i128` (7 decimals). `*_bps` are `u32` out of `10_000`. `VIRTUAL_OFFSET = 1`.
- Coverage ratio lives in `policy` (default `10_000`); the hard solvency invariant holds at ratio ≥ 100%.
- Premiums mint **no shares** — `collect_premium` only moves underlying and bumps `premium_income`.
- All swappable deps are wired by **setters**, never constructor-baked (the one exception is `vault`'s `underlying`).
- Every deployable contract keeps an admin-gated `upgrade(BytesN<32>)`.
- Work happens on branch `feat/modular-architecture`; `main` (the monolith) stays intact until the suite is green.

---

### Task 1: Branch + `interfaces` crate

**Files:**
- Create: `contracts/interfaces/Cargo.toml`, `contracts/interfaces/src/lib.rs`

**Interfaces:**
- Produces: `Guarantee` (shared type); `VaultClient` (`disburse`, `collect_premium`, `stable_assets`); `PolicyClient` (`coverage_required`); `RegistryClient` (`next_id`, `put`, `get`, `active_ids`).

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/modular-architecture
```

- [ ] **Step 2: Create the crate manifest**

Create `contracts/interfaces/Cargo.toml`:

```toml
[package]
name = "interfaces"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["rlib"]

[dependencies]
soroban-sdk = { workspace = true }
```

- [ ] **Step 3: Define shared type + client traits**

Create `contracts/interfaces/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contractclient, contracttype, Address, Env, Vec};

/// Stable core of a guarantee. Model-specific extras live in the policy's own
/// storage, keyed by id — never here.
#[contracttype]
#[derive(Clone)]
pub struct Guarantee {
    pub id: u32,
    pub landlord: Address,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub months_used: u32,
    pub fee_bps: u32,
    pub period_secs: u64,
    pub paid_until: u64,
    pub active: bool,
}

#[contractclient(name = "VaultClient")]
pub trait Vault {
    fn disburse(env: Env, to: Address, amount: i128);
    fn collect_premium(env: Env, from: Address, amount: i128);
    fn stable_assets(env: Env) -> i128;
}

#[contractclient(name = "PolicyClient")]
pub trait Policy {
    fn coverage_required(env: Env) -> i128;
}

#[contractclient(name = "RegistryClient")]
pub trait Registry {
    fn next_id(env: Env) -> u32;
    fn put(env: Env, g: Guarantee);
    fn get(env: Env, id: u32) -> Guarantee;
    fn active_ids(env: Env) -> Vec<u32>;
}
```

- [ ] **Step 4: Verify build**

Run: `cargo build -p interfaces`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add contracts/interfaces
git commit -m "feat: shared interfaces crate (Guarantee + cross-contract clients)"
```

---

### Task 2: `registry` contract

**Files:**
- Create: `contracts/registry/Cargo.toml`, `contracts/registry/src/lib.rs`, `contracts/registry/src/test.rs`

**Interfaces:**
- Consumes: `interfaces::Guarantee`.
- Produces: `registry` implementing `interfaces::Registry` + `set_writer`/`writer`/`set_admin`/`upgrade`. `next_id`/`put` are writer-gated; `get`/`active_ids` public.

- [ ] **Step 1: Create the manifest**

Create `contracts/registry/Cargo.toml`:

```toml
[package]
name = "registry"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
interfaces = { path = "../interfaces" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 2: Write the failing test**

Create `contracts/registry/src/test.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};
use interfaces::Guarantee;
use crate::{Registry, RegistryClient};

fn g(e: &Env, id: u32, landlord: &Address, active: bool) -> Guarantee {
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test -p registry`
Expected: FAIL to compile — `Registry` not defined.

- [ ] **Step 4: Implement the registry**

Create `contracts/registry/src/lib.rs`:

```rust
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

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn writer(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Writer).unwrap()
    }

    pub fn set_writer(e: &Env, policy: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Writer, &policy);
    }

    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn require_writer(e: &Env) {
        Self::writer(e).require_auth();
    }
}

#[contractimpl]
impl RegistryTrait for Registry {
    fn next_id(e: Env, ) -> u32 {
        Self::require_writer(&e);
        let id: u32 = e.storage().instance().get(&DataKey::NextId).unwrap();
        e.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    fn put(e: Env, g: Guarantee) {
        Self::require_writer(&e);
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test -p registry`
Expected: PASS — `writer_gating_and_active_set ... ok`.

- [ ] **Step 6: Commit**

```bash
git add contracts/registry
git commit -m "feat: registry contract (writer-gated typed guarantee store)"
```

---

### Task 3: `mock-policy` test helper + `vault` custody core

**Files:**
- Create: `contracts/mock-policy/Cargo.toml`, `contracts/mock-policy/src/lib.rs`
- Create: `contracts/vault/Cargo.toml`, `contracts/vault/src/lib.rs`, `contracts/vault/src/types.rs`, `contracts/vault/src/test.rs`

**Interfaces:**
- Consumes: `interfaces::{PolicyClient, Vault}`, `strategy::StrategyClient`, `mock-strategy`.
- Produces: `vault` — `__constructor(admin, underlying)`, `deposit`, `total_assets`, `stable_assets`, `available_held`, `nav_per_share`, `add_strategy`, `remove_strategy`, `strategies`, `rebalance`, `set_policy`, `policy`, `free_capital`, `set_admin`, `upgrade`. `mock-policy` — a settable `coverage_required`.

- [ ] **Step 1: Create the mock-policy helper**

Create `contracts/mock-policy/Cargo.toml`:

```toml
[package]
name = "mock-policy"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
interfaces = { path = "../interfaces" }
```

Create `contracts/mock-policy/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};
use interfaces::{Policy as PolicyTrait, VaultClient};

#[contracttype]
enum DataKey {
    Coverage,
    Vault,
}

#[contract]
pub struct MockPolicy;

#[contractimpl]
impl MockPolicy {
    pub fn __constructor(e: &Env, vault: Address) {
        e.storage().instance().set(&DataKey::Vault, &vault);
        e.storage().instance().set(&DataKey::Coverage, &0i128);
    }

    pub fn set_coverage(e: &Env, amount: i128) {
        e.storage().instance().set(&DataKey::Coverage, &amount);
    }

    /// Proxies a disburse so vault's policy-gating can be exercised in tests.
    pub fn call_disburse(e: &Env, to: Address, amount: i128) {
        let vault: Address = e.storage().instance().get(&DataKey::Vault).unwrap();
        VaultClient::new(e, &vault).disburse(&to, &amount);
    }

    /// Proxies a premium collection for the same reason.
    pub fn call_collect(e: &Env, from: Address, amount: i128) {
        let vault: Address = e.storage().instance().get(&DataKey::Vault).unwrap();
        VaultClient::new(e, &vault).collect_premium(&from, &amount);
    }
}

#[contractimpl]
impl PolicyTrait for MockPolicy {
    fn coverage_required(e: Env) -> i128 {
        e.storage().instance().get(&DataKey::Coverage).unwrap_or(0)
    }
}
```

- [ ] **Step 2: Create the vault manifest + types**

Create `contracts/vault/Cargo.toml`:

```toml
[package]
name = "vault"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
stellar-tokens = { workspace = true }
strategy = { path = "../strategy" }
interfaces = { path = "../interfaces" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
mock-strategy = { path = "../mock-strategy" }
mock-policy = { path = "../mock-policy" }
```

Create `contracts/vault/src/types.rs`:

```rust
use soroban_sdk::{contracttype, Address};

pub const NAV_SCALE: i128 = 10_000_000; // 1e7
pub const VIRTUAL_OFFSET: i128 = 1;

#[contracttype]
#[derive(Clone)]
pub struct StrategyAlloc {
    pub address: Address,
    pub weight_bps: u32,
    pub volatile: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct RedeemRequest {
    pub id: u32,
    pub owner: Address,
    pub shares: i128,
    pub fulfilled: bool,
    pub claimed: bool,
    pub claimable: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Underlying,
    Policy,
    ReservedForClaims,
    PremiumIncome,
    Strategies,
    NextRequestId,
    PendingRequests,
    Request(u32),
    Locked,
}
```

- [ ] **Step 3: Write the failing test**

Create `contracts/vault/src/test.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use mock_strategy::{MockStrategy, MockStrategyClient};
use mock_policy::{MockPolicy, MockPolicyClient};
use crate::{Vault, VaultClient};

pub struct Ctx {
    pub e: Env,
    pub admin: Address,
    pub underlying: Address,
    pub token: token::TokenClient<'static>,
    pub token_admin: token::StellarAssetClient<'static>,
    pub vault: VaultClient<'static>,
    pub vault_id: Address,
    pub policy: MockPolicyClient<'static>,
}

pub fn setup() -> Ctx {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token = token::TokenClient::new(&e, &underlying);
    let token_admin = token::StellarAssetClient::new(&e, &underlying);
    let vault_id = e.register(Vault, (admin.clone(), underlying.clone()));
    let vault = VaultClient::new(&e, &vault_id);
    let policy_id = e.register(MockPolicy, (vault_id.clone(),));
    vault.set_policy(&policy_id);
    let policy = MockPolicyClient::new(&e, &policy_id);
    Ctx { e, admin, underlying, token, token_admin, vault, vault_id, policy }
}

pub fn add_mock(c: &Ctx, weight_bps: u32) -> MockStrategyClient<'static> {
    let id = c.e.register(MockStrategy, (c.underlying.clone(),));
    c.vault.add_strategy(&id, &weight_bps, &false);
    MockStrategyClient::new(&c.e, &id)
}

#[test]
fn deposit_and_nav_and_free_capital() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    assert_eq!(c.vault.deposit(&alice, &1_000), 1_000);
    assert_eq!(c.vault.nav_per_share(), 10_000_000);

    let s1 = add_mock(&c, 10_000);
    c.vault.rebalance();
    assert_eq!(s1.balance(), 1_000);
    assert_eq!(c.vault.total_assets(), 1_000);

    // free_capital reads the (mock) policy coverage.
    c.policy.set_coverage(&600);
    assert_eq!(c.vault.free_capital(), 400);
}
```

- [ ] **Step 4: Run to verify it fails**

Run: `cargo test -p vault deposit_and_nav`
Expected: FAIL to compile — `Vault` not defined.

- [ ] **Step 5: Implement the vault custody core**

Create `contracts/vault/src/lib.rs`. The shares/NAV/strategy/allocator bodies are
**ported verbatim** from the monolith `contracts/reserve/src/lib.rs` on `main`
(functions `deposit`, `available_held`, `nav_per_share`, `add_strategy`,
`strategies`, `strategies_balance`, `stable_assets`, `rebalance`,
`remove_strategy`, `ensure_liquidity`, and the token/reserved helpers), with
these differences: the constructor drops `coverage_ratio_bps`; `total_assets`
stays `available_held + strategies_balance`; and `free_capital`/`policy` are new.

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, MuxedAddress, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use strategy::StrategyClient;
use interfaces::PolicyClient;

mod types;
use types::{DataKey, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};

mod test;

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        Base::set_metadata(
            e, 7,
            String::from_str(e, "Mutav Pulse Reserve Share"),
            String::from_str(e, "mtvR"),
        );
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::ReservedForClaims, &0i128);
        e.storage().instance().set(&DataKey::PremiumIncome, &0i128);
        e.storage().instance().set(&DataKey::Strategies, &Vec::<StrategyAlloc>::new(e));
        e.storage().instance().set(&DataKey::NextRequestId, &0u32);
        e.storage().instance().set(&DataKey::PendingRequests, &Vec::<u32>::new(e));
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    pub fn underlying(e: &Env) -> Address { e.storage().instance().get(&DataKey::Underlying).unwrap() }
    pub fn policy(e: &Env) -> Address { e.storage().instance().get(&DataKey::Policy).unwrap() }
    pub fn premium_income(e: &Env) -> i128 { e.storage().instance().get(&DataKey::PremiumIncome).unwrap_or(0) }

    pub fn set_policy(e: &Env, policy: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Policy, &policy);
    }

    fn reserved_for_claims(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::ReservedForClaims).unwrap_or(0)
    }
    fn token_client(e: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(e, &Self::underlying(e))
    }
    pub fn available_held(e: &Env) -> i128 {
        Self::token_client(e).balance(&e.current_contract_address()) - Self::reserved_for_claims(e)
    }
    pub fn total_assets(e: &Env) -> i128 { Self::available_held(e) + Self::strategies_balance(e) }

    pub fn add_strategy(e: &Env, address: Address, weight_bps: u32, volatile: bool) {
        Self::admin(e).require_auth();
        let mut list: Vec<StrategyAlloc> = e.storage().instance().get(&DataKey::Strategies).unwrap();
        list.push_back(StrategyAlloc { address, weight_bps, volatile });
        e.storage().instance().set(&DataKey::Strategies, &list);
    }
    pub fn strategies(e: &Env) -> Vec<StrategyAlloc> {
        e.storage().instance().get(&DataKey::Strategies).unwrap()
    }
    fn strategies_balance(e: &Env) -> i128 {
        let mut total = 0i128;
        for s in Self::strategies(e).iter() { total += StrategyClient::new(e, &s.address).balance(); }
        total
    }
    pub fn stable_assets(e: &Env) -> i128 {
        let mut total = Self::available_held(e);
        for s in Self::strategies(e).iter() {
            if !s.volatile { total += StrategyClient::new(e, &s.address).balance(); }
        }
        total
    }
    pub fn rebalance(e: &Env) {
        Self::admin(e).require_auth();
        let idle = Self::available_held(e);
        if idle <= 0 { return; }
        let list = Self::strategies(e);
        let total_weight: i128 = list.iter().map(|s| s.weight_bps as i128).sum();
        if total_weight == 0 { return; }
        let tok = Self::token_client(e);
        for s in list.iter() {
            let portion = idle * (s.weight_bps as i128) / total_weight;
            if portion > 0 {
                tok.transfer(&e.current_contract_address(), &s.address, &portion);
                StrategyClient::new(e, &s.address).invest(&portion);
            }
        }
    }
    pub fn remove_strategy(e: &Env, address: Address) {
        Self::admin(e).require_auth();
        let client = StrategyClient::new(e, &address);
        let bal = client.balance();
        if bal > 0 { client.divest(&bal, &e.current_contract_address()); }
        let mut next = Vec::<StrategyAlloc>::new(e);
        for s in Self::strategies(e).iter() {
            if s.address != address { next.push_back(s); }
        }
        e.storage().instance().set(&DataKey::Strategies, &next);
    }
    fn ensure_liquidity(e: &Env, needed: i128) {
        if Self::available_held(e) >= needed { return; }
        for s in Self::strategies(e).iter() {
            if Self::available_held(e) >= needed { break; }
            let short = needed - Self::available_held(e);
            let client = StrategyClient::new(e, &s.address);
            let avail = client.balance();
            let pull = if short < avail { short } else { avail };
            if pull > 0 { client.divest(&pull, &e.current_contract_address()); }
        }
        assert!(Self::available_held(e) >= needed, "insufficient liquidity");
    }

    pub fn nav_per_share(e: &Env) -> i128 {
        let supply = Base::total_supply(e);
        if supply == 0 { return NAV_SCALE; }
        Self::total_assets(e) * NAV_SCALE / supply
    }
    pub fn deposit(e: &Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        let supply = Base::total_supply(e);
        let assets_before = Self::total_assets(e);
        Self::token_client(e).transfer(&from, &e.current_contract_address(), &amount);
        let shares = amount * (supply + VIRTUAL_OFFSET) / (assets_before + VIRTUAL_OFFSET);
        assert!(shares > 0, "zero shares minted");
        Base::mint(e, &from, shares);
        shares
    }

    pub fn free_capital(e: &Env) -> i128 {
        let coverage = PolicyClient::new(e, &Self::policy(e)).coverage_required();
        let fc = Self::stable_assets(e) - coverage;
        if fc > 0 { fc } else { 0 }
    }

    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Vault {
    type ContractType = Base;
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cargo test -p vault deposit_and_nav`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add contracts/mock-policy contracts/vault
git commit -m "feat: vault custody core + mock-policy test helper"
```

---

### Task 4: `vault` redemption queue

**Files:**
- Modify: `contracts/vault/src/lib.rs`, `contracts/vault/src/test.rs`

**Interfaces:**
- Produces: `request_redeem(owner, shares) -> u32`, `cancel_redeem(id)`, `process_redemptions(max_batch)`, `claim(id)`, `request(id) -> RedeemRequest`, `pending_requests() -> Vec<u32>`.

- [ ] **Step 1: Write the failing test**

Append to `contracts/vault/src/test.rs`:

```rust
#[test]
fn redemption_gated_by_free_capital() {
    let c = setup();
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.vault.deposit(&alice, &1_000);

    c.policy.set_coverage(&800); // free capital = 200
    let rid = c.vault.request_redeem(&alice, &1_000);
    c.vault.process_redemptions(&10);
    assert!(!c.vault.request(&rid).fulfilled); // blocked

    c.policy.set_coverage(&0); // floor releases
    c.vault.process_redemptions(&10);
    assert!(c.vault.request(&rid).fulfilled);
    c.vault.claim(&rid);
    assert_eq!(c.token.balance(&alice), 1_000);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p vault redemption_gated`
Expected: FAIL to compile — `request_redeem` not defined.

- [ ] **Step 3: Implement the queue**

Add `RedeemRequest` to the types import in `contracts/vault/src/lib.rs`
(`use types::{DataKey, RedeemRequest, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};`).
Then **port verbatim** from the monolith `contracts/reserve/src/lib.rs` on `main`
the functions `request`, `pending_requests`, `request_redeem`, `cancel_redeem`,
`process_redemptions`, and `claim` — they are unchanged (they already gate on
`Self::free_capital(e)`, which now reads the policy). Paste them into the
`impl Vault` block before the closing brace.

- [ ] **Step 4: Run to verify it passes**

Run: `cargo test -p vault redemption_gated`
Expected: PASS.

- [ ] **Step 5: Run the crate**

Run: `cargo test -p vault`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/vault
git commit -m "feat: vault surplus-gated redemption queue (free_capital via policy)"
```

---

### Task 5: `vault` policy-gated `disburse` + `collect_premium`

**Files:**
- Modify: `contracts/vault/src/lib.rs`, `contracts/vault/src/test.rs`

**Interfaces:**
- Produces (implements `interfaces::Vault`): `disburse(to, amount)`, `collect_premium(from, amount)`, plus `stable_assets` already present.

- [ ] **Step 1: Write the failing test**

Append to `contracts/vault/src/test.rs`:

```rust
#[test]
fn disburse_and_collect_are_policy_gated() {
    let c = setup();
    let alice = Address::generate(&c.e);
    let agency = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&agency, &1_000);
    c.vault.deposit(&alice, &1_000);

    // collect_premium via the policy: no shares minted, NAV rises.
    let supply_before = c.vault.total_supply();
    c.policy.call_collect(&agency, &50);
    assert_eq!(c.vault.total_supply(), supply_before); // no new shares
    assert_eq!(c.vault.premium_income(), 50);
    assert_eq!(c.vault.total_assets(), 1_050);

    // disburse via the policy pays out.
    c.policy.call_disburse(&landlord, &100);
    assert_eq!(c.token.balance(&landlord), 100);

    // A non-policy caller cannot disburse.
    assert!(c.vault.try_disburse(&landlord, &10).is_err());
}
```

> Note: `try_disburse` fails because `disburse` calls `policy().require_auth()`;
> under `mock_all_auths_allowing_non_root_auth` a *direct* test call is not the
> policy contract, so the policy's auth is absent and the call errors.

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p vault disburse_and_collect`
Expected: FAIL to compile — `disburse` not defined.

- [ ] **Step 3: Implement the policy-facing functions**

Add `use interfaces::PolicyClient;` is already present. Add inside `impl Vault`:

```rust
    fn require_policy(e: &Env) {
        Self::policy(e).require_auth();
    }

    pub fn disburse(e: &Env, to: Address, amount: i128) {
        Self::require_policy(e);
        Self::ensure_liquidity(e, amount);
        Self::token_client(e).transfer(&e.current_contract_address(), &to, &amount);
        // Solvency must still hold after a payout.
        let coverage = PolicyClient::new(e, &Self::policy(e)).coverage_required();
        assert!(Self::stable_assets(e) >= coverage, "disburse breaches solvency");
    }

    pub fn collect_premium(e: &Env, from: Address, amount: i128) {
        Self::require_policy(e);
        assert!(amount > 0, "amount must be positive");
        Self::token_client(e).transfer(&from, &e.current_contract_address(), &amount);
        let total = Self::premium_income(e) + amount;
        e.storage().instance().set(&DataKey::PremiumIncome, &total);
        // No shares minted: premium accrues to existing holders via NAV.
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cargo test -p vault disburse_and_collect`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/vault
git commit -m "feat: vault policy-gated disburse + collect_premium (zero-mint)"
```

---

### Task 6: `policy` contract

**Files:**
- Create: `contracts/policy/Cargo.toml`, `contracts/policy/src/lib.rs`, `contracts/policy/src/test.rs`

**Interfaces:**
- Consumes: `interfaces::{Guarantee, VaultClient, RegistryClient, Policy}`.
- Produces: `policy` — `__constructor(admin)`, setters `set_vault`/`set_registry`/`set_coverage_ratio_bps`, `coverage_required`, `is_current`, `monthly_premium`, `sign_guarantee`, `pay_premium`, `cover_default`, `settle_guarantee`, `set_admin`, `upgrade`.

- [ ] **Step 1: Create the manifest**

Create `contracts/policy/Cargo.toml`:

```toml
[package]
name = "policy"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
interfaces = { path = "../interfaces" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
vault = { path = "../vault" }
registry = { path = "../registry" }
mock-strategy = { path = "../mock-strategy" }
```

- [ ] **Step 2: Write the failing integration test**

Create `contracts/policy/src/test.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test -p policy premium_gated`
Expected: FAIL to compile — `Policy` not defined.

- [ ] **Step 4: Implement the policy**

Create `contracts/policy/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};
use interfaces::{Guarantee, Policy as PolicyTrait, RegistryClient, VaultClient};

const BPS_DENOM: i128 = 10_000;

#[contracttype]
enum DataKey {
    Admin,
    Vault,
    Registry,
    CoverageRatioBps,
}

#[contract]
pub struct Policy;

#[contractimpl]
impl Policy {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::CoverageRatioBps, &10_000u32);
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    fn vault_addr(e: &Env) -> Address { e.storage().instance().get(&DataKey::Vault).unwrap() }
    fn registry_addr(e: &Env) -> Address { e.storage().instance().get(&DataKey::Registry).unwrap() }
    fn registry(e: &Env) -> RegistryClient<'_> { RegistryClient::new(e, &Self::registry_addr(e)) }
    fn vault(e: &Env) -> VaultClient<'_> { VaultClient::new(e, &Self::vault_addr(e)) }
    fn ratio(e: &Env) -> i128 {
        let v: u32 = e.storage().instance().get(&DataKey::CoverageRatioBps).unwrap();
        v as i128
    }

    pub fn set_vault(e: &Env, addr: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Vault, &addr); }
    pub fn set_registry(e: &Env, addr: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Registry, &addr); }
    pub fn set_coverage_ratio_bps(e: &Env, bps: u32) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::CoverageRatioBps, &bps); }
    pub fn set_admin(e: &Env, new_admin: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Admin, &new_admin); }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) { Self::admin(e).require_auth(); e.deployer().update_current_contract_wasm(new_wasm_hash); }

    pub fn guarantee(e: &Env, id: u32) -> Guarantee { Self::registry(e).get(&id) }
    pub fn is_current(e: &Env, id: u32) -> bool { Self::registry(e).get(&id).paid_until > e.ledger().timestamp() }
    pub fn monthly_premium(e: &Env, id: u32) -> i128 {
        let g = Self::registry(e).get(&id);
        g.monthly_amount * (g.fee_bps as i128) / BPS_DENOM
    }

    pub fn sign_guarantee(e: &Env, landlord: Address, monthly_amount: i128, months_covered: u32, fee_bps: u32, period_secs: u64) -> u32 {
        Self::admin(e).require_auth();
        assert!(monthly_amount > 0 && months_covered > 0, "invalid guarantee");
        assert!(fee_bps > 0 && period_secs > 0, "invalid premium terms");
        let id = Self::registry(e).next_id();
        Self::registry(e).put(&Guarantee {
            id, landlord, monthly_amount, months_covered, months_used: 0,
            fee_bps, period_secs, paid_until: 0, active: true,
        });
        id
    }

    pub fn pay_premium(e: &Env, payer: Address, id: u32) {
        payer.require_auth();
        let mut g = Self::registry(e).get(&id);
        assert!(g.active, "guarantee inactive");
        let premium = g.monthly_amount * (g.fee_bps as i128) / BPS_DENOM;
        assert!(premium > 0, "zero premium");
        Self::vault(e).collect_premium(&payer, &premium);
        let now = e.ledger().timestamp();
        let base = if g.paid_until > now { g.paid_until } else { now };
        g.paid_until = base + g.period_secs;
        Self::registry(e).put(&g);
        assert!(Self::vault(e).stable_assets() >= Self::coverage_required(), "insufficient capital to activate coverage");
    }

    pub fn cover_default(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let mut g = Self::registry(e).get(&id);
        assert!(g.active, "guarantee inactive");
        assert!(g.months_used < g.months_covered, "coverage exhausted");
        assert!(g.paid_until > e.ledger().timestamp(), "premiums not up to date");
        g.months_used += 1;
        if g.months_used == g.months_covered { g.active = false; }
        Self::registry(e).put(&g);
        Self::vault(e).disburse(&g.landlord, &g.monthly_amount);
    }

    pub fn settle_guarantee(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let mut g = Self::registry(e).get(&id);
        g.active = false;
        Self::registry(e).put(&g);
    }
}

#[contractimpl]
impl PolicyTrait for Policy {
    fn coverage_required(e: Env) -> i128 {
        let ratio = Self::ratio(&e);
        let now = e.ledger().timestamp();
        let reg = Self::registry(&e);
        let mut raw = 0i128;
        for id in reg.active_ids().iter() {
            let g = reg.get(&id);
            if g.paid_until > now {
                raw += g.monthly_amount * ((g.months_covered - g.months_used) as i128);
            }
        }
        raw * ratio / BPS_DENOM
    }
}

mod test;
```

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test -p policy premium_gated`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/policy
git commit -m "feat: policy contract (premium-gated coverage over vault + registry)"
```

---

### Task 7: Full-narrative + migration integration tests

**Files:**
- Create: `contracts/policy/src/test_system.rs`
- Modify: `contracts/policy/src/lib.rs` (add `mod test_system;`)

**Interfaces:**
- Consumes: every entry point built so far.

- [ ] **Step 1: Write the narrative + migration tests**

Create `contracts/policy/src/test_system.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use vault::{Vault, VaultClient};
use registry::{Registry, RegistryClient};
use mock_strategy::{MockStrategy, MockStrategyClient};
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
    assert!(s.vault.stable_assets() >= s.policy.coverage_required());

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
    assert_eq!(s.token_admin.address, s.token_admin.address); // touch to silence unused
}
```

> The final `token_admin.address` line is a no-op touch; if it does not compile,
> replace it with `let _ = &s.token_admin;`.

- [ ] **Step 2: Register the module**

In `contracts/policy/src/lib.rs`, add after `mod test;`:

```rust
mod test_system;
```

- [ ] **Step 3: Run the system tests**

Run: `cargo test -p policy full_demo_flow policy_swap_preserves`
Expected: PASS both.

- [ ] **Step 4: Run the entire workspace**

Run: `cargo test`
Expected: all crates PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/policy
git commit -m "test: cross-contract narrative + policy-swap migration"
```

---

### Task 8: Retire the monolith + update bootstrap

**Files:**
- Delete: `contracts/reserve/`
- Modify: `bootstrap.sh`

**Interfaces:**
- Consumes: the deployed `registry` / `vault` / `policy` / `mock-strategy` wasm.

- [ ] **Step 1: Remove the monolith crate**

```bash
git rm -r contracts/reserve
```

- [ ] **Step 2: Verify the workspace still builds and tests**

Run: `cargo test && stellar contract build`
Expected: all tests PASS; `reserve.wasm` no longer built; `registry.wasm`, `vault.wasm`, `policy.wasm`, `mock_strategy.wasm` present.

- [ ] **Step 3: Rewrite bootstrap.sh for the modular wiring**

Replace `bootstrap.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail
NETWORK=testnet
SOURCE=deployer
ADMIN=$(stellar keys address "$SOURCE")
: "${USDC_SAC:?set USDC_SAC to the underlying token contract id}"

make build
dep(){ stellar contract deploy --wasm "target/wasm32v1-none/release/$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }
inv(){ stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}"; }

REGISTRY=$(dep registry.wasm --admin "$ADMIN")
VAULT=$(dep vault.wasm --admin "$ADMIN" --underlying "$USDC_SAC")
POLICY=$(dep policy.wasm --admin "$ADMIN")
MOCK=$(dep mock_strategy.wasm --underlying "$USDC_SAC")

inv "$REGISTRY" set_writer --policy "$POLICY"
inv "$POLICY" set_vault --addr "$VAULT"
inv "$POLICY" set_registry --addr "$REGISTRY"
inv "$POLICY" set_coverage_ratio_bps --bps 10000
inv "$VAULT" set_policy --policy "$POLICY"
inv "$VAULT" add_strategy --address "$MOCK" --weight_bps 10000 --volatile false

echo "REGISTRY=$REGISTRY"; echo "VAULT=$VAULT"; echo "POLICY=$POLICY"; echo "MOCK=$MOCK"
```

- [ ] **Step 4: Make executable and commit**

```bash
chmod +x bootstrap.sh
git add -A
git commit -m "refactor: retire reserve monolith; bootstrap wires vault/registry/policy"
```

---

## Self-Review

**Spec coverage:**
- 5 modules (vault, registry, policy, strategy, interfaces) → Tasks 1–6 (strategy unchanged, reused). ✓
- Share token inside vault → Task 3 (Vault is the FungibleToken). ✓
- Authority graph: money only via vault `disburse`/`collect_premium` (policy-gated) → Task 5; data only via policy-written registry (writer-gated) → Tasks 2/6; solvency at vault → Tasks 3/5. ✓
- `interfaces` crate with the three client traits + `Guarantee` → Task 1. ✓
- `collect_premium` zero-mint + `premium_income` → Task 5. ✓
- Cross-contract solvency ordering (registry-before-disburse; funds+paid_until before activation assert) → Tasks 5/6 code. ✓
- Setter-based wiring + per-contract `upgrade` → Tasks 2/3/6; bootstrap → Task 8. ✓
- Migration story → Task 7 `policy_swap_preserves_data_and_funds`. ✓
- Preserve behavior + integration tests → Tasks 6/7. ✓

**Placeholder scan:** Ported functions point at a concrete source (`contracts/reserve/src/lib.rs` on `main`) and name each function exactly — not a vague "similar to." New code is shown in full. No TBD/TODO.

**Type consistency:** `Guarantee` defined once in `interfaces` (Task 1) and used by registry/policy unchanged. `VaultClient::{disburse, collect_premium, stable_assets}`, `PolicyClient::coverage_required`, `RegistryClient::{next_id, put, get, active_ids}` match their `impl`s in Tasks 2/3/5/6. `set_policy`/`policy`, `set_writer`/`writer`, `set_vault`/`set_registry`/`set_coverage_ratio_bps` are consistent across wiring in Tasks 6/7/8. `VIRTUAL_OFFSET`/`NAV_SCALE` live in `vault::types`.

## Out of scope (later)
- Live DeFindex/Soroswap adapters (Plan 2); frontend (Plan 3).
- `#[contracterror]` enums and richer events.
- Re-running the testnet demo against the modular deploy (do after merge).
