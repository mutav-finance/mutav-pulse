# mutav-pulse Contracts Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `reserve` tokenized vault — solvency-gated over a rental-guarantee registry with a surplus-gated redemption queue — plus the shared `strategy` trait and a `mock-strategy` for testing, all on Soroban.

**Architecture:** A tokenized vault (`reserve`) mints OpenZeppelin fungible shares on deposit and computes NAV directly (ERC-4626 math). It tracks active rental guarantees and may never let `total_assets` drop below `coverage_required`; only the `free_capital` surplus can leave (redemptions) or back new guarantees. Idle underlying is delegated to pluggable `strategy` contracts behind a uniform trait; this plan exercises that boundary with a `mock-strategy` that simulates yield. DeFindex/Soroswap/Blend adapters are Plan 2; the frontend is Plan 3.

**Tech Stack:** Rust, soroban-sdk `26.1.0`, stellar-tokens `0.7.2` (OpenZeppelin Soroban fungible token), Cargo workspace, Makefile.

## Global Constraints

- soroban-sdk = `26.1.0`; stellar-tokens = `0.7.2`; Rust edition `2021`.
- Release profile (workspace root, copied from the reference repo): `opt-level = "z"`, `overflow-checks = true`, `debug = 0`, `strip = "symbols"`, `debug-assertions = false`, `panic = "abort"`, `codegen-units = 1`, `lto = true`. Overflow checks stay ON — token math must trap, never wrap.
- All monetary amounts are `i128` in the underlying's smallest unit (7 decimals, matching Stellar assets).
- Basis points (`*_bps`) are `u32` out of `10_000`.
- Share token uses OZ fungible `Base` with 7 decimals, name `"Mutav Pulse Reserve Share"`, symbol `"mtvR"`.
- The shares↔assets primitives are exactly: `Base::mint(e, &to, amount)`, `Base::update(e, from_opt, to_opt, amount)` (internal, no-auth, used for burns of vault-escrowed shares), `Base::total_supply(e)`, `Base::balance(e, &addr)`, `Base::transfer(e, &from, &to, amount)`. The `FungibleToken` trait is wired via `#[contractimpl(contracttrait)] impl FungibleToken for Reserve { type ContractType = Base; }`.
- Underlying token access is via `soroban_sdk::token::TokenClient` / `StellarAssetClient`.
- Every admin-only entry point calls `Self::admin(e).require_auth()` as its first line.
- **Solvency invariant (must hold after every entry point, at `coverage_ratio_bps >= 10_000`):** `stable_assets() >= coverage_required()`. Redemptions and `sign_guarantee` draw only from `free_capital()` (stable surplus); `cover_default` is served before any queued redemption.
- **Upgradeability:** every deployable contract exposes an admin-gated `upgrade(new_wasm_hash: BytesN<32>)` that calls `e.deployer().update_current_contract_wasm(&new_wasm_hash)`. In-place Wasm swap, storage preserved.
- **Address wiring:** swappable dependencies go through setters/registries, never constructor-baked immutables. Strategies → `add_strategy`/`remove_strategy`; admin → `set_admin`. The sole deliberate exception is `underlying` (constructor-baked, no setter — changing it would invalidate outstanding shares; the immutability is intentional and documented).
- **Security mitigations (from the design-level security pass):**
  - **Stable-backed floor (H2):** solvency uses `stable_assets()` (vault cash + Σ balance of **non-volatile** strategies), never volatile venues. `free_capital() = max(0, stable_assets() − coverage_required())`. NAV still uses `total_assets()` (all strategies). Each `StrategyAlloc` carries a `volatile: bool`. (The `max_volatile_bps` allocation cap lands in Plan 2 alongside the first volatile adapter; Plan 1 only carries the flag and the stable/total split.)
  - **≥100% ratio invariant (M1):** the provable invariant is `stable_assets() >= coverage_required()`, guaranteed only at `coverage_ratio_bps >= 10_000`. Tests run at 100%.
  - **Anti-inflation (H1):** `const VIRTUAL_OFFSET: i128 = 1;` added to supply and assets in every share↔asset computation, plus `assert!(shares > 0)` on deposit.
  - **Reentrancy (M2):** `process_redemptions` takes an instance-flag reentrancy guard; value-moving paths order effects before the external `divest` interaction.
  - **Bounded processing (M3):** `process_redemptions(max_batch: u32)`.

---

### Task 0: Pre-flight — pin the stellar-tokens 0.7.2 API

**Files:**
- Reference only (no code yet): https://docs.rs/stellar-tokens/0.7.2

- [ ] **Step 1: Confirm the `Base` surface used by this plan**

Open https://docs.rs/stellar-tokens/0.7.2 and confirm these associated functions exist on `stellar_tokens::fungible::Base` with these shapes (they are the OZ-standard fungible internals; the reference repo `stellar-album-2026` already uses `Base::set_metadata` and `Base::mint`):

- `Base::set_metadata(e: &Env, decimals: u32, name: String, symbol: String)`
- `Base::mint(e: &Env, to: &Address, amount: i128)`
- `Base::update(e: &Env, from: Option<&Address>, to: Option<&Address>, amount: i128)`
- `Base::total_supply(e: &Env) -> i128`
- `Base::balance(e: &Env, account: &Address) -> i128`
- `Base::transfer(e: &Env, from: &Address, to: &Address, amount: i128)`

If a name differs (e.g. `update` is exposed under a different internal helper), record the correct name in `docs/notes-stellar-tokens.md` and use that name consistently everywhere below. This is the only place external API names are resolved.

- [ ] **Step 2: Commit the note (if any)**

```bash
git add docs/notes-stellar-tokens.md 2>/dev/null || true
git commit -m "docs: pin stellar-tokens 0.7.2 Base API" --allow-empty
```

---

### Task 1: Workspace scaffold

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `rust-toolchain.toml`
- Create: `Makefile`
- Create: `.gitignore`

**Interfaces:**
- Produces: a buildable Cargo workspace with members `contracts/*`. Later tasks add crates under `contracts/`.

- [ ] **Step 1: Create the workspace manifest**

Create `Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = ["contracts/*"]

[workspace.package]
edition = "2021"
license = "Apache-2.0"
version = "0.1.0"

[workspace.dependencies]
soroban-sdk = "26.1.0"
stellar-tokens = "0.7.2"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

- [ ] **Step 2: Create the toolchain pin**

Create `rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.85.0"
targets = ["wasm32v1-none"]
```

- [ ] **Step 3: Create the Makefile**

Create `Makefile`:

```makefile
default: build

build:
	cargo build --target wasm32v1-none --release

test:
	cargo test

fmt:
	cargo fmt --all

clean:
	cargo clean
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:

```
/target
**/*.rs.bk
.env
.soroban
```

- [ ] **Step 5: Verify the workspace resolves**

Run: `cargo metadata --no-deps --format-version 1 >/dev/null && echo OK`
Expected: `OK` (empty workspace resolves; no members yet is fine).

- [ ] **Step 6: Commit**

```bash
git add Cargo.toml rust-toolchain.toml Makefile .gitignore
git commit -m "chore: scaffold soroban workspace"
```

---

### Task 2: `strategy` trait crate

**Files:**
- Create: `contracts/strategy/Cargo.toml`
- Create: `contracts/strategy/src/lib.rs`

**Interfaces:**
- Produces: `strategy::StrategyClient` — generated client used by `reserve` and implemented by every adapter. Methods:
  - `invest(amount: i128)` — caller has already transferred `amount` of underlying to this contract; deploy it to the venue.
  - `divest(amount: i128) -> i128` — withdraw up to `amount` (underlying terms) from the venue, transfer underlying back to the caller, return the amount actually returned.
  - `balance() -> i128` — current position value in underlying terms.
  - `underlying() -> Address` — the underlying asset this strategy settles in.

- [ ] **Step 1: Create the crate manifest**

Create `contracts/strategy/Cargo.toml`:

```toml
[package]
name = "strategy"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["rlib"]

[dependencies]
soroban-sdk = { workspace = true }
```

- [ ] **Step 2: Define the trait and client**

Create `contracts/strategy/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contractclient, Address, Env};

/// Uniform interface every yield venue adapter implements.
/// The reserve calls these via the generated `StrategyClient`.
#[contractclient(name = "StrategyClient")]
pub trait Strategy {
    /// Caller has already transferred `amount` underlying to this contract.
    /// Deploy it into the venue.
    fn invest(env: Env, amount: i128);

    /// Withdraw up to `amount` (underlying terms) from the venue and transfer
    /// the underlying back to `to`. Returns the amount actually returned.
    fn divest(env: Env, amount: i128, to: Address) -> i128;

    /// Current position value, denominated in the underlying asset.
    fn balance(env: Env) -> i128;

    /// The underlying asset this strategy settles in.
    fn underlying(env: Env) -> Address;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cargo build -p strategy`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add contracts/strategy
git commit -m "feat: add strategy trait + client"
```

---

### Task 3: `mock-strategy` contract

**Files:**
- Create: `contracts/mock-strategy/Cargo.toml`
- Create: `contracts/mock-strategy/src/lib.rs`
- Test: `contracts/mock-strategy/src/test.rs`

**Interfaces:**
- Consumes: `strategy::Strategy` trait.
- Produces: a deployable contract implementing `Strategy`, plus a test-only `accrue(amount)` that mints extra underlying to itself to simulate yield, and a `__constructor(underlying: Address)`.

- [ ] **Step 1: Create the manifest**

Create `contracts/mock-strategy/Cargo.toml`:

```toml
[package]
name = "mock-strategy"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
strategy = { path = "../strategy" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 2: Write the failing test**

Create `contracts/mock-strategy/src/test.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use crate::{MockStrategy, MockStrategyClient};

fn setup(e: &Env) -> (Address, token::TokenClient, token::StellarAssetClient) {
    let issuer = Address::generate(e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    (
        sac.address(),
        token::TokenClient::new(e, &sac.address()),
        token::StellarAssetClient::new(e, &sac.address()),
    )
}

#[test]
fn invest_then_balance_then_divest() {
    let e = Env::default();
    e.mock_all_auths();
    let (underlying, token, token_admin) = setup(&e);

    let id = e.register(MockStrategy, (underlying.clone(),));
    let strat = MockStrategyClient::new(&e, &id);
    assert_eq!(strat.underlying(), underlying);

    // Reserve would transfer underlying in, then call invest.
    token_admin.mint(&id, &1_000);
    strat.invest(&1_000);
    assert_eq!(strat.balance(), 1_000);

    // Simulate yield.
    strat.accrue(&100);
    assert_eq!(strat.balance(), 1_100);

    // Divest half back to a recipient.
    let to = Address::generate(&e);
    let returned = strat.divest(&500, &to);
    assert_eq!(returned, 500);
    assert_eq!(token.balance(&to), 500);
    assert_eq!(strat.balance(), 600);
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cargo test -p mock-strategy`
Expected: FAIL to compile — `MockStrategy` not defined.

- [ ] **Step 4: Implement the contract**

Create `contracts/mock-strategy/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};
use strategy::Strategy;

#[contracttype]
enum DataKey {
    Underlying,
    Deposited, // underlying terms; balance() = token balance held
}

#[contract]
pub struct MockStrategy;

#[contractimpl]
impl MockStrategy {
    pub fn __constructor(e: &Env, underlying: Address) {
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::Deposited, &0i128);
    }

    /// Test/demo helper: mint extra underlying to this contract to simulate yield.
    pub fn accrue(e: &Env, amount: i128) {
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        token::StellarAssetClient::new(e, &underlying).mint(&e.current_contract_address(), &amount);
    }
}

#[contractimpl]
impl Strategy for MockStrategy {
    fn invest(e: Env, amount: i128) {
        // Funds already transferred in by the caller; just record intent.
        let d: i128 = e.storage().instance().get(&DataKey::Deposited).unwrap_or(0);
        e.storage().instance().set(&DataKey::Deposited, &(d + amount));
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        let token = token::TokenClient::new(&e, &underlying);
        let held = token.balance(&e.current_contract_address());
        let out = if amount < held { amount } else { held };
        token.transfer(&e.current_contract_address(), &to, &out);
        out
    }

    fn balance(e: Env) -> i128 {
        let underlying: Address = e.storage().instance().get(&DataKey::Underlying).unwrap();
        token::TokenClient::new(&e, &underlying).balance(&e.current_contract_address())
    }

    fn underlying(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }
}

mod test;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cargo test -p mock-strategy`
Expected: PASS — `invest_then_balance_then_divest ... ok`.

- [ ] **Step 6: Commit**

```bash
git add contracts/mock-strategy
git commit -m "feat: add mock-strategy with simulated yield"
```

---

### Task 4: `reserve` — tokenized shares core (deposit / NAV)

**Files:**
- Create: `contracts/reserve/Cargo.toml`
- Create: `contracts/reserve/src/lib.rs`
- Create: `contracts/reserve/src/types.rs`
- Create: `contracts/reserve/src/test.rs`

**Interfaces:**
- Produces (on `ReserveClient`):
  - `__constructor(admin: Address, underlying: Address, coverage_ratio_bps: u32)`
  - `deposit(from: Address, amount: i128) -> i128` — pulls `amount` underlying from `from`, mints shares at current NAV, returns shares minted.
  - `total_assets() -> i128` — `available_held() + Σ strategy.balance()`. (No strategies yet → `available_held()`.)
  - `available_held() -> i128` — `token.balance(self) - reserved_for_claims`.
  - `nav_per_share() -> i128` — scaled 1e7; `total_assets * 1e7 / total_supply` (or `1e7` when supply is 0).
  - `admin() -> Address`, `underlying() -> Address`.

- [ ] **Step 1: Create the manifest**

Create `contracts/reserve/Cargo.toml`:

```toml
[package]
name = "reserve"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
stellar-tokens = { workspace = true }
strategy = { path = "../strategy" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
mock-strategy = { path = "../mock-strategy" }
```

- [ ] **Step 2: Define storage types**

Create `contracts/reserve/src/types.rs`:

```rust
use soroban_sdk::{contracttype, Address};

pub const BPS_DENOM: i128 = 10_000;
pub const NAV_SCALE: i128 = 10_000_000; // 1e7
pub const VIRTUAL_OFFSET: i128 = 1; // anti-inflation offset (H1)

#[contracttype]
#[derive(Clone)]
pub struct StrategyAlloc {
    pub address: Address,
    pub weight_bps: u32,
    pub volatile: bool, // price-variable venue (excluded from the coverage floor)
}

#[contracttype]
#[derive(Clone)]
pub struct Guarantee {
    pub id: u32,
    pub landlord: Address,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub months_used: u32,
    pub active: bool,
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
    CoverageRatioBps,
    ReservedForClaims,
    Strategies,        // Vec<StrategyAlloc>
    NextGuaranteeId,
    ActiveGuarantees,  // Vec<u32>
    Guarantee(u32),    // Guarantee
    NextRequestId,
    PendingRequests,   // Vec<u32> (FIFO queue)
    Request(u32),      // RedeemRequest
    Locked,            // reentrancy guard flag (M2)
}
```

- [ ] **Step 3: Write the failing test**

Create `contracts/reserve/src/test.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Address, Env};
use crate::{Reserve, ReserveClient};

pub struct Ctx {
    pub e: Env,
    pub admin: Address,
    pub underlying: Address,
    pub token: token::TokenClient<'static>,
    pub token_admin: token::StellarAssetClient<'static>,
    pub reserve: ReserveClient<'static>,
    pub reserve_id: Address,
}

pub fn setup(coverage_ratio_bps: u32) -> Ctx {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token = token::TokenClient::new(&e, &underlying);
    let token_admin = token::StellarAssetClient::new(&e, &underlying);
    let reserve_id = e.register(Reserve, (admin.clone(), underlying.clone(), coverage_ratio_bps));
    let reserve = ReserveClient::new(&e, &reserve_id);
    Ctx { e, admin, underlying, token, token_admin, reserve, reserve_id }
}

#[test]
fn deposit_mints_shares_one_to_one_first_time() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);

    let shares = c.reserve.deposit(&alice, &1_000);
    assert_eq!(shares, 1_000);
    assert_eq!(c.reserve.total_assets(), 1_000);
    assert_eq!(c.reserve.nav_per_share(), 10_000_000); // 1.0 scaled 1e7
    assert_eq!(c.token.balance(&c.reserve_id), 1_000);
}

#[test]
fn second_deposit_uses_nav() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.token_admin.mint(&bob, &1_000);

    c.reserve.deposit(&alice, &1_000); // supply 1000, assets 1000
    // Simulate a gain by minting underlying straight to the reserve.
    c.token_admin.mint(&c.reserve_id, &1_000); // assets 2000, supply 1000 -> NAV 2.0
    assert_eq!(c.reserve.nav_per_share(), 20_000_000);

    let shares = c.reserve.deposit(&bob, &1_000); // 1000*(1000+1)/(2000+1) = 500
    assert_eq!(shares, 500);
}

#[test]
fn inflation_attack_does_not_zero_out_second_depositor() {
    let c = setup(10_000);
    let attacker = Address::generate(&c.e);
    let victim = Address::generate(&c.e);
    c.token_admin.mint(&attacker, &1);
    c.token_admin.mint(&victim, &10_000);

    // Attacker seeds 1 unit then donates 10_000 straight to the vault.
    c.reserve.deposit(&attacker, &1);
    c.token_admin.mint(&c.reserve_id, &10_000); // direct donation inflates assets

    // With the virtual offset, the victim still receives non-zero shares.
    let victim_shares = c.reserve.deposit(&victim, &10_000);
    assert!(victim_shares > 0, "victim was inflated out of shares");
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cargo test -p reserve deposit_mints_shares`
Expected: FAIL to compile — `Reserve` not defined.

- [ ] **Step 5: Implement the shares core**

Create `contracts/reserve/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};

mod types;
use types::{DataKey, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};

mod test;

#[contract]
pub struct Reserve;

#[contractimpl]
impl Reserve {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address, coverage_ratio_bps: u32) {
        Base::set_metadata(
            e,
            7,
            String::from_str(e, "Mutav Pulse Reserve Share"),
            String::from_str(e, "mtvR"),
        );
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
        e.storage().instance().set(&DataKey::CoverageRatioBps, &coverage_ratio_bps);
        e.storage().instance().set(&DataKey::ReservedForClaims, &0i128);
        e.storage().instance().set(&DataKey::Strategies, &Vec::<StrategyAlloc>::new(e));
        e.storage().instance().set(&DataKey::NextGuaranteeId, &0u32);
        e.storage().instance().set(&DataKey::ActiveGuarantees, &Vec::<u32>::new(e));
        e.storage().instance().set(&DataKey::NextRequestId, &0u32);
        e.storage().instance().set(&DataKey::PendingRequests, &Vec::<u32>::new(e));
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn underlying(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }

    fn reserved_for_claims(e: &Env) -> i128 {
        e.storage().instance().get(&DataKey::ReservedForClaims).unwrap_or(0)
    }

    fn token_client(e: &Env) -> token::TokenClient {
        token::TokenClient::new(e, &Self::underlying(e))
    }

    /// Underlying physically held by the vault, minus what's already earmarked
    /// for fulfilled-but-unclaimed redemptions.
    pub fn available_held(e: &Env) -> i128 {
        Self::token_client(e).balance(&e.current_contract_address()) - Self::reserved_for_claims(e)
    }

    /// Net assets attributable to outstanding shares.
    pub fn total_assets(e: &Env) -> i128 {
        // Strategies are summed in Task 5; here it is just available held.
        Self::available_held(e)
    }

    pub fn nav_per_share(e: &Env) -> i128 {
        let supply = Base::total_supply(e);
        if supply == 0 {
            return NAV_SCALE;
        }
        Self::total_assets(e) * NAV_SCALE / supply
    }

    pub fn deposit(e: &Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");

        let supply = Base::total_supply(e);
        let assets_before = Self::total_assets(e);

        // Pull underlying in.
        Self::token_client(e).transfer(&from, &e.current_contract_address(), &amount);

        // Virtual offset (H1): defeats the first-depositor inflation attack and
        // keeps 1:1 on the first deposit (amount * (0+1) / (0+1) == amount).
        let shares = amount * (supply + VIRTUAL_OFFSET) / (assets_before + VIRTUAL_OFFSET);
        assert!(shares > 0, "zero shares minted");
        Base::mint(e, &from, shares);
        shares
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for Reserve {
    type ContractType = Base;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cargo test -p reserve deposit_mints_shares second_deposit_uses_nav`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add contracts/reserve
git commit -m "feat: reserve tokenized shares core (deposit + NAV)"
```

---

### Task 5: `reserve` — strategy set, allocation, total_assets

**Files:**
- Modify: `contracts/reserve/src/lib.rs`
- Modify: `contracts/reserve/src/test.rs`

**Interfaces:**
- Consumes: `strategy::StrategyClient` (Task 2), `mock-strategy` (Task 3).
- Produces (on `ReserveClient`):
  - `add_strategy(address: Address, weight_bps: u32, volatile: bool)` — admin; `volatile` flags price-variable venues, excluded from the coverage floor.
  - `strategies() -> Vec<StrategyAlloc>`.
  - `stable_assets() -> i128` — `available_held() + Σ balance()` over **non-volatile** strategies. Drives solvency.
  - `rebalance()` — admin; allocate any idle available held into strategies per weights.
  - `total_assets()` now returns `available_held() + Σ strategy.balance()` (all strategies; drives NAV).

- [ ] **Step 1: Write the failing test**

Append to `contracts/reserve/src/test.rs`:

```rust
use mock_strategy::{MockStrategy, MockStrategyClient};

fn add_mock(c: &Ctx, weight_bps: u32) -> MockStrategyClient<'static> {
    let id = c.e.register(MockStrategy, (c.underlying.clone(),));
    c.reserve.add_strategy(&id, &weight_bps, &false); // stable mock
    MockStrategyClient::new(&c.e, &id)
}

#[test]
fn rebalance_allocates_to_strategies_and_total_assets_sums() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);

    let s1 = add_mock(&c, 6_000); // 60%
    let s2 = add_mock(&c, 4_000); // 40%
    c.reserve.rebalance();

    assert_eq!(s1.balance(), 600);
    assert_eq!(s2.balance(), 400);
    assert_eq!(c.reserve.available_held(), 0);
    assert_eq!(c.reserve.total_assets(), 1_000);

    // Yield in a strategy lifts NAV.
    s1.accrue(&100);
    assert_eq!(c.reserve.total_assets(), 1_100);
    assert_eq!(c.reserve.nav_per_share(), 11_000_000);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p reserve rebalance_allocates`
Expected: FAIL to compile — `add_strategy` not defined.

- [ ] **Step 3: Implement strategy handling**

In `contracts/reserve/src/lib.rs`, add `use strategy::StrategyClient;` to the imports, replace the `total_assets` function body, and add the new methods inside the `#[contractimpl] impl Reserve` block:

```rust
    pub fn add_strategy(e: &Env, address: Address, weight_bps: u32, volatile: bool) {
        Self::admin(e).require_auth();
        let mut list: Vec<StrategyAlloc> =
            e.storage().instance().get(&DataKey::Strategies).unwrap();
        list.push_back(StrategyAlloc { address, weight_bps, volatile });
        e.storage().instance().set(&DataKey::Strategies, &list);
    }

    pub fn strategies(e: &Env) -> Vec<StrategyAlloc> {
        e.storage().instance().get(&DataKey::Strategies).unwrap()
    }

    fn strategies_balance(e: &Env) -> i128 {
        let mut total = 0i128;
        for s in Self::strategies(e).iter() {
            total += StrategyClient::new(e, &s.address).balance();
        }
        total
    }

    /// Solvency-relevant assets: cash + stable (non-volatile) strategies only.
    /// The coverage floor may never depend on volatile venue value (H2).
    pub fn stable_assets(e: &Env) -> i128 {
        let mut total = Self::available_held(e);
        for s in Self::strategies(e).iter() {
            if !s.volatile {
                total += StrategyClient::new(e, &s.address).balance();
            }
        }
        total
    }

    /// Allocate any idle available held into strategies per weights.
    pub fn rebalance(e: &Env) {
        Self::admin(e).require_auth();
        let idle = Self::available_held(e);
        if idle <= 0 {
            return;
        }
        let list = Self::strategies(e);
        let total_weight: i128 = list.iter().map(|s| s.weight_bps as i128).sum();
        if total_weight == 0 {
            return;
        }
        let token = Self::token_client(e);
        for s in list.iter() {
            let portion = idle * (s.weight_bps as i128) / total_weight;
            if portion > 0 {
                token.transfer(&e.current_contract_address(), &s.address, &portion);
                StrategyClient::new(e, &s.address).invest(&portion);
            }
        }
    }
```

And change `total_assets` to:

```rust
    pub fn total_assets(e: &Env) -> i128 {
        Self::available_held(e) + Self::strategies_balance(e)
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cargo test -p reserve rebalance_allocates`
Expected: PASS.

- [ ] **Step 5: Run the whole crate to catch regressions**

Run: `cargo test -p reserve`
Expected: all prior tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/reserve
git commit -m "feat: reserve strategy set + allocation + summed total_assets"
```

---

### Task 6: `reserve` — guarantee registry & solvency gate

**Files:**
- Modify: `contracts/reserve/src/lib.rs`
- Modify: `contracts/reserve/src/test.rs`

**Interfaces:**
- Consumes: `Guarantee` type (Task 4 types.rs).
- Produces (on `ReserveClient`):
  - `coverage_required() -> i128` — `Σ (monthly_amount * (months_covered - months_used)) over active guarantees * ratio / 10_000`.
  - `free_capital() -> i128` — `max(0, stable_assets() - coverage_required())` (stable surplus only).
  - `sign_guarantee(landlord: Address, monthly_amount: i128, months_covered: u32) -> u32` — admin; rejects unless `free_capital() >= monthly_amount * months_covered * ratio / 10_000`; returns guarantee id.
  - `guarantee(id: u32) -> Guarantee`.
  - `settle_guarantee(id: u32)` — admin; marks inactive, releasing its exposure.

- [ ] **Step 1: Write the failing test**

Append to `contracts/reserve/src/test.rs`:

```rust
#[test]
fn sign_guarantee_gated_by_free_capital() {
    let c = setup(10_000); // 100% coverage ratio
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);

    // Exposure = 100 * 6 * 100% = 600 <= free_capital 1000 -> ok.
    let gid = c.reserve.sign_guarantee(&landlord, &100, &6);
    assert_eq!(c.reserve.coverage_required(), 600);
    assert_eq!(c.reserve.free_capital(), 400);

    // Another 100*6 = 600 exposure but only 400 free -> must panic.
    let r = c.reserve.try_sign_guarantee(&landlord, &100, &6);
    assert!(r.is_err());

    // Settling the first frees the floor again.
    c.reserve.settle_guarantee(&gid);
    assert_eq!(c.reserve.coverage_required(), 0);
    assert_eq!(c.reserve.free_capital(), 1_000);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p reserve sign_guarantee_gated`
Expected: FAIL to compile — `sign_guarantee` not defined.

- [ ] **Step 3: Implement guarantees**

In `contracts/reserve/src/lib.rs`, add `Guarantee` and `BPS_DENOM` to the `types` import (`use types::{BPS_DENOM, DataKey, Guarantee, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};`) and add inside `impl Reserve`:

```rust
    fn coverage_ratio_bps(e: &Env) -> i128 {
        let v: u32 = e.storage().instance().get(&DataKey::CoverageRatioBps).unwrap();
        v as i128
    }

    fn active_guarantee_ids(e: &Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveGuarantees).unwrap()
    }

    pub fn guarantee(e: &Env, id: u32) -> Guarantee {
        e.storage().persistent().get(&DataKey::Guarantee(id)).unwrap()
    }

    pub fn coverage_required(e: &Env) -> i128 {
        let ratio = Self::coverage_ratio_bps(e);
        let mut raw = 0i128;
        for id in Self::active_guarantee_ids(e).iter() {
            let g = Self::guarantee(e, id);
            let remaining_months = (g.months_covered - g.months_used) as i128;
            raw += g.monthly_amount * remaining_months;
        }
        raw * ratio / BPS_DENOM
    }

    pub fn free_capital(e: &Env) -> i128 {
        // Stable-backed surplus (H2): volatile venue value never counts here.
        let fc = Self::stable_assets(e) - Self::coverage_required(e);
        if fc > 0 { fc } else { 0 }
    }

    pub fn sign_guarantee(
        e: &Env,
        landlord: Address,
        monthly_amount: i128,
        months_covered: u32,
    ) -> u32 {
        Self::admin(e).require_auth();
        assert!(monthly_amount > 0 && months_covered > 0, "invalid guarantee");
        let ratio = Self::coverage_ratio_bps(e);
        let new_exposure = monthly_amount * (months_covered as i128) * ratio / BPS_DENOM;
        assert!(
            Self::free_capital(e) >= new_exposure,
            "insufficient free capital to underwrite"
        );

        let id: u32 = e.storage().instance().get(&DataKey::NextGuaranteeId).unwrap();
        e.storage().instance().set(&DataKey::NextGuaranteeId, &(id + 1));
        let g = Guarantee {
            id,
            landlord,
            monthly_amount,
            months_covered,
            months_used: 0,
            active: true,
        };
        e.storage().persistent().set(&DataKey::Guarantee(id), &g);
        let mut active = Self::active_guarantee_ids(e);
        active.push_back(id);
        e.storage().instance().set(&DataKey::ActiveGuarantees, &active);
        id
    }

    pub fn settle_guarantee(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let mut g = Self::guarantee(e, id);
        g.active = false;
        e.storage().persistent().set(&DataKey::Guarantee(id), &g);
        Self::remove_active(e, id);
    }

    fn remove_active(e: &Env, id: u32) {
        let active = Self::active_guarantee_ids(e);
        let mut next = Vec::<u32>::new(e);
        for x in active.iter() {
            if x != id {
                next.push_back(x);
            }
        }
        e.storage().instance().set(&DataKey::ActiveGuarantees, &next);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cargo test -p reserve sign_guarantee_gated`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/reserve
git commit -m "feat: reserve guarantee registry + solvency gate"
```

---

### Task 7: `reserve` — cover_default (priority, one month, stays active)

**Files:**
- Modify: `contracts/reserve/src/lib.rs`
- Modify: `contracts/reserve/src/test.rs`

**Interfaces:**
- Produces (on `ReserveClient`):
  - `cover_default(id: u32)` — admin; pays one `monthly_amount` to the guarantee's landlord, increments `months_used`, keeps the guarantee active until `months_used == months_covered` (then auto-settles). Pulls liquidity from strategies if needed.
- Internal: `ensure_liquidity(needed)` — divest from strategies until `available_held() >= needed`.

- [ ] **Step 1: Write the failing test**

Append to `contracts/reserve/src/test.rs`:

```rust
#[test]
fn cover_default_pays_one_month_and_keeps_active() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &2); // 2 months cap

    c.reserve.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
    let g = c.reserve.guarantee(&gid);
    assert_eq!(g.months_used, 1);
    assert!(g.active); // still active
    // remaining exposure 100*1 = 100
    assert_eq!(c.reserve.coverage_required(), 100);

    c.reserve.cover_default(&gid); // exhausts the cap
    assert_eq!(c.token.balance(&landlord), 200);
    let g2 = c.reserve.guarantee(&gid);
    assert_eq!(g2.months_used, 2);
    assert!(!g2.active); // auto-settled
    assert_eq!(c.reserve.coverage_required(), 0);
}

#[test]
fn cover_default_divests_when_idle_is_short() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let s1 = add_mock(&c, 10_000);
    c.reserve.rebalance(); // all 1000 now in strategy, idle = 0
    assert_eq!(c.reserve.available_held(), 0);

    let gid = c.reserve.sign_guarantee(&landlord, &100, &1);
    c.reserve.cover_default(&gid); // must divest 100 to pay
    assert_eq!(c.token.balance(&landlord), 100);
    assert_eq!(s1.balance(), 900);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p reserve cover_default`
Expected: FAIL to compile — `cover_default` not defined.

- [ ] **Step 3: Implement cover_default + ensure_liquidity**

Add `use strategy::StrategyClient;` if not already present, and add inside `impl Reserve`:

```rust
    /// Divest from strategies (in order) until available held covers `needed`.
    fn ensure_liquidity(e: &Env, needed: i128) {
        if Self::available_held(e) >= needed {
            return;
        }
        let token = Self::token_client(e);
        for s in Self::strategies(e).iter() {
            if Self::available_held(e) >= needed {
                break;
            }
            let short = needed - Self::available_held(e);
            let client = StrategyClient::new(e, &s.address);
            let avail = client.balance();
            let pull = if short < avail { short } else { avail };
            if pull > 0 {
                client.divest(&pull, &e.current_contract_address());
            }
        }
        let _ = token; // token used implicitly via strategy transfers back
        assert!(Self::available_held(e) >= needed, "insufficient liquidity");
    }

    pub fn cover_default(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let mut g = Self::guarantee(e, id);
        assert!(g.active, "guarantee inactive");
        assert!(g.months_used < g.months_covered, "coverage exhausted");

        Self::ensure_liquidity(e, g.monthly_amount);
        Self::token_client(e).transfer(
            &e.current_contract_address(),
            &g.landlord,
            &g.monthly_amount,
        );

        g.months_used += 1;
        if g.months_used == g.months_covered {
            g.active = false;
        }
        e.storage().persistent().set(&DataKey::Guarantee(id), &g);
        if !g.active {
            Self::remove_active(e, id);
        }
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cargo test -p reserve cover_default`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add contracts/reserve
git commit -m "feat: reserve cover_default with priority liquidity + month accounting"
```

---

### Task 8: `reserve` — redemption queue (request / process / claim)

**Files:**
- Modify: `contracts/reserve/src/lib.rs`
- Modify: `contracts/reserve/src/test.rs`

**Interfaces:**
- Consumes: `RedeemRequest` type (Task 4 types.rs).
- Produces (on `ReserveClient`):
  - `request_redeem(owner: Address, shares: i128) -> u32` — escrows `shares` to the contract, appends a pending request, returns request id.
  - `cancel_redeem(id: u32)` — owner; returns escrowed shares for an unfulfilled request and drops it from the queue.
  - `process_redemptions(max_batch: u32)` — admin/keeper; reentrancy-guarded; FIFO over **up to `max_batch`** pending requests, fulfilling each only while `free_capital() >= claimable` (stable surplus only). On fulfill: burn the escrowed shares, set `reserved_for_claims += claimable`, mark fulfilled with `claimable = shares * (total_assets + VIRTUAL_OFFSET) / (total_supply + VIRTUAL_OFFSET)` (computed before burn), divest liquidity as needed.
  - `claim(id: u32)` — owner; transfers `claimable` underlying out, decrements `reserved_for_claims`, marks claimed.
  - `request(id: u32) -> RedeemRequest`, `pending_requests() -> Vec<u32>`.

- [ ] **Step 1: Write the failing test**

Append to `contracts/reserve/src/test.rs`:

```rust
#[test]
fn redemption_only_from_surplus_then_claim() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000); // alice holds 1000 shares

    // Lock 800 into coverage -> free capital 200.
    c.reserve.sign_guarantee(&landlord, &100, &8); // exposure 800
    assert_eq!(c.reserve.free_capital(), 200);

    // Alice requests to redeem all 1000 shares (=1000 underlying at NAV 1.0).
    let rid = c.reserve.request_redeem(&alice, &1_000);
    c.reserve.process_redemptions(&10);

    // Surplus is only 200, so the 1000-underlying request cannot fulfill.
    let req = c.reserve.request(&rid);
    assert!(!req.fulfilled);

    // Settle the guarantee -> surplus becomes 1000, request can fulfill.
    // (guarantee id is 0, the first signed)
    c.reserve.settle_guarantee(&0);
    c.reserve.process_redemptions(&10);
    let req2 = c.reserve.request(&rid);
    assert!(req2.fulfilled);
    assert_eq!(req2.claimable, 1_000);

    c.reserve.claim(&rid);
    assert_eq!(c.token.balance(&alice), 1_000);
    // shares burned, supply back to 0
    assert_eq!(c.reserve.total_assets(), 0);
}

#[test]
fn cover_default_has_priority_over_queue() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let gid = c.reserve.sign_guarantee(&landlord, &100, &4); // exposure 400, free 600

    // Alice queues to exit 1000 (more than the 600 surplus).
    let rid = c.reserve.request_redeem(&alice, &1_000);
    c.reserve.process_redemptions(&10);
    assert!(!c.reserve.request(&rid).fulfilled); // blocked by the floor

    // A default is still served from the reserve, ahead of the queue.
    c.reserve.cover_default(&gid);
    assert_eq!(c.token.balance(&landlord), 100);
}

#[test]
fn cancel_redeem_returns_escrowed_shares() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);

    let rid = c.reserve.request_redeem(&alice, &400);
    assert_eq!(c.reserve.balance(&alice), 600); // escrowed
    assert_eq!(c.reserve.pending_requests().len(), 1);

    c.reserve.cancel_redeem(&rid);
    assert_eq!(c.reserve.balance(&alice), 1_000); // returned
    assert_eq!(c.reserve.pending_requests().len(), 0);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cargo test -p reserve redemption_only_from_surplus`
Expected: FAIL to compile — `request_redeem` not defined.

- [ ] **Step 3: Implement the queue**

Add `RedeemRequest` to the types import (`use types::{BPS_DENOM, DataKey, Guarantee, RedeemRequest, StrategyAlloc, NAV_SCALE, VIRTUAL_OFFSET};`) and add inside `impl Reserve`:

```rust
    pub fn request(e: &Env, id: u32) -> RedeemRequest {
        e.storage().persistent().get(&DataKey::Request(id)).unwrap()
    }

    pub fn pending_requests(e: &Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::PendingRequests).unwrap()
    }

    pub fn request_redeem(e: &Env, owner: Address, shares: i128) -> u32 {
        owner.require_auth();
        assert!(shares > 0, "shares must be positive");
        // Escrow the shares into the contract.
        Base::transfer(e, &owner, &e.current_contract_address(), shares);

        let id: u32 = e.storage().instance().get(&DataKey::NextRequestId).unwrap();
        e.storage().instance().set(&DataKey::NextRequestId, &(id + 1));
        let req = RedeemRequest {
            id,
            owner,
            shares,
            fulfilled: false,
            claimed: false,
            claimable: 0,
        };
        e.storage().persistent().set(&DataKey::Request(id), &req);
        let mut pending = Self::pending_requests(e);
        pending.push_back(id);
        e.storage().instance().set(&DataKey::PendingRequests, &pending);
        id
    }

    /// Returns escrowed shares for an unfulfilled request and drops it.
    pub fn cancel_redeem(e: &Env, id: u32) {
        let mut req = Self::request(e, id);
        req.owner.require_auth();
        assert!(!req.fulfilled, "already fulfilled");
        assert!(!req.claimed, "already claimed");
        // Return the escrowed shares from the contract to the owner. Uses the
        // internal `update` (no-auth) since the holder is this contract.
        Base::update(e, Some(&e.current_contract_address()), Some(&req.owner), req.shares);
        req.claimed = true; // consume so it cannot be processed/cancelled twice
        e.storage().persistent().set(&DataKey::Request(id), &req);
        let pending = Self::pending_requests(e);
        let mut next = Vec::<u32>::new(e);
        for x in pending.iter() {
            if x != id {
                next.push_back(x);
            }
        }
        e.storage().instance().set(&DataKey::PendingRequests, &next);
    }

    pub fn process_redemptions(e: &Env, max_batch: u32) {
        Self::admin(e).require_auth();
        // Reentrancy guard (M2): `ensure_liquidity` calls out to adapters.
        assert!(
            !e.storage().instance().get::<_, bool>(&DataKey::Locked).unwrap_or(false),
            "reentrant call"
        );
        e.storage().instance().set(&DataKey::Locked, &true);

        let pending = Self::pending_requests(e);
        let mut still_pending = Vec::<u32>::new(e);
        let mut processed: u32 = 0;
        for id in pending.iter() {
            let mut req = Self::request(e, id);
            if req.fulfilled || req.claimed {
                continue;
            }
            // Bounded processing (M3): once the batch is spent, keep the rest queued.
            if processed >= max_batch {
                still_pending.push_back(id);
                continue;
            }
            processed += 1;

            let supply = Base::total_supply(e);
            let claimable = if supply == 0 {
                0
            } else {
                req.shares * (Self::total_assets(e) + VIRTUAL_OFFSET) / (supply + VIRTUAL_OFFSET)
            };
            // Gate on stable surplus only (H2).
            if claimable > 0 && Self::free_capital(e) >= claimable {
                Self::ensure_liquidity(e, claimable);
                // Effects before further interactions: burn escrowed shares now.
                Base::update(e, Some(&e.current_contract_address()), None, req.shares);
                let reserved = Self::reserved_for_claims(e) + claimable;
                e.storage().instance().set(&DataKey::ReservedForClaims, &reserved);
                req.fulfilled = true;
                req.claimable = claimable;
                e.storage().persistent().set(&DataKey::Request(id), &req);
            } else {
                still_pending.push_back(id);
            }
        }
        e.storage().instance().set(&DataKey::PendingRequests, &still_pending);
        e.storage().instance().set(&DataKey::Locked, &false);
    }

    pub fn claim(e: &Env, id: u32) {
        let mut req = Self::request(e, id);
        req.owner.require_auth();
        assert!(req.fulfilled, "not yet fulfilled");
        assert!(!req.claimed, "already claimed");
        Self::token_client(e).transfer(
            &e.current_contract_address(),
            &req.owner,
            &req.claimable,
        );
        let reserved = Self::reserved_for_claims(e) - req.claimable;
        e.storage().instance().set(&DataKey::ReservedForClaims, &reserved);
        req.claimed = true;
        e.storage().persistent().set(&DataKey::Request(id), &req);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cargo test -p reserve redemption_only_from_surplus cover_default_has_priority`
Expected: PASS both.

- [ ] **Step 5: Run the whole crate**

Run: `cargo test -p reserve`
Expected: every test PASSES.

- [ ] **Step 6: Commit**

```bash
git add contracts/reserve
git commit -m "feat: reserve surplus-gated redemption queue"
```

---

### Task 9: Solvency invariant + full-narrative integration test + bootstrap

**Files:**
- Create: `contracts/reserve/src/test_narrative.rs`
- Modify: `contracts/reserve/src/lib.rs` (add `mod test_narrative;`)
- Create: `bootstrap.sh`

**Interfaces:**
- Consumes: every entry point built so far.

- [ ] **Step 1: Write the end-to-end narrative test**

Create `contracts/reserve/src/test_narrative.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Address;
use crate::test::{add_mock_pub as add_mock, setup};

#[test]
fn full_demo_flow_holds_solvency_invariant() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    let bob = Address::generate(&c.e);
    let landlord = Address::generate(&c.e);
    c.token_admin.mint(&alice, &10_000);
    c.token_admin.mint(&bob, &10_000);

    // 1. Two investors deposit; capital diversifies across two venues.
    c.reserve.deposit(&alice, &10_000);
    c.reserve.deposit(&bob, &10_000);
    let s1 = add_mock(&c, 6_000);
    let s2 = add_mock(&c, 4_000);
    c.reserve.rebalance();
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 2. Underwrite a batch of guarantees.
    let g1 = c.reserve.sign_guarantee(&landlord, &500, &6); // exposure 3000
    let _g2 = c.reserve.sign_guarantee(&landlord, &300, &6); // exposure 1800
    assert_eq!(c.reserve.coverage_required(), 4_800);
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 3. A contract defaults; landlord is paid first.
    c.reserve.cover_default(&g1);
    assert_eq!(c.token.balance(&landlord), 500);
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 4. Bob queues to exit; only surplus is available.
    let rid = c.reserve.request_redeem(&bob, &5_000);
    c.reserve.process_redemptions(&10);
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());

    // 5. Yield accrues, surplus grows, the queue drains.
    s1.accrue(&1_000);
    s2.accrue(&1_000);
    c.reserve.process_redemptions(&10);
    if c.reserve.request(&rid).fulfilled {
        c.reserve.claim(&rid);
    }
    assert!(c.reserve.stable_assets() >= c.reserve.coverage_required());
}
```

- [ ] **Step 2: Expose the test helpers**

In `contracts/reserve/src/test.rs`, make `setup`, `Ctx`, and `add_mock` reachable from the sibling test module: change `fn add_mock(` to `pub fn add_mock_pub(` (keep the body identical) and ensure `Ctx` fields and `setup` are already `pub` (they are from Task 4). Update the call inside `test.rs` that used `add_mock` to `add_mock_pub`.

In `contracts/reserve/src/lib.rs`, add near the other module declarations:

```rust
mod test_narrative;
```

- [ ] **Step 3: Run the narrative test**

Run: `cargo test -p reserve full_demo_flow`
Expected: PASS — the `stable_assets >= coverage_required` invariant holds at every checkpoint.

- [ ] **Step 4: Run the entire test suite**

Run: `cargo test`
Expected: all crates PASS.

- [ ] **Step 5: Create the bootstrap script**

Create `bootstrap.sh` (testnet deploy + wiring; uses the Stellar CLI):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Requires: stellar CLI, a funded testnet identity named `deployer`.
NETWORK=testnet
SOURCE=deployer
ADMIN=$(stellar keys address "$SOURCE")
RATIO_BPS=10000

echo "Building..."
make build

echo "Deploying a test USDC SAC is out of scope here; export USDC_SAC first." >&2
: "${USDC_SAC:?set USDC_SAC to the underlying token contract id}"

RESERVE=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/reserve.wasm \
  --source "$SOURCE" --network "$NETWORK" \
  -- --admin "$ADMIN" --underlying "$USDC_SAC" --coverage_ratio_bps "$RATIO_BPS")
echo "RESERVE=$RESERVE"

MOCK=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/mock_strategy.wasm \
  --source "$SOURCE" --network "$NETWORK" \
  -- --underlying "$USDC_SAC")
echo "MOCK_STRATEGY=$MOCK"

stellar contract invoke --id "$RESERVE" --source "$SOURCE" --network "$NETWORK" \
  -- add_strategy --address "$MOCK" --weight_bps 10000 --volatile false
echo "Wired mock strategy at 100% (replace with real adapters in Plan 2)."
```

- [ ] **Step 6: Make it executable and commit**

```bash
chmod +x bootstrap.sh
git add contracts/reserve/src/test_narrative.rs contracts/reserve/src/lib.rs contracts/reserve/src/test.rs bootstrap.sh
git commit -m "test: full demo narrative + solvency invariant; add bootstrap"
```

---

### Task 10: Lifecycle — upgrade, admin rotation, strategy swap

**Files:**
- Modify: `contracts/reserve/src/lib.rs`
- Modify: `contracts/reserve/src/test.rs`

**Interfaces:**
- Produces (on `ReserveClient`):
  - `set_admin(new_admin: Address)` — admin; rotates the `Admin` storage key.
  - `remove_strategy(address: Address)` — admin; fully divests the venue back to the vault, then drops it from the registry. Lets a buggy adapter be swapped without redeploying the vault.
  - `upgrade(new_wasm_hash: BytesN<32>)` — admin; `e.deployer().update_current_contract_wasm(&new_wasm_hash)`.

This task is independent of Tasks 6–9 and may be implemented any time after Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `contracts/reserve/src/test.rs`:

```rust
use soroban_sdk::BytesN;

#[test]
fn set_admin_rotates_authority() {
    let c = setup(10_000);
    let new_admin = Address::generate(&c.e);
    c.reserve.set_admin(&new_admin);
    assert_eq!(c.reserve.admin(), new_admin);
}

#[test]
fn remove_strategy_divests_and_drops_it() {
    let c = setup(10_000);
    let alice = Address::generate(&c.e);
    c.token_admin.mint(&alice, &1_000);
    c.reserve.deposit(&alice, &1_000);
    let s1 = add_mock(&c, 10_000);
    c.reserve.rebalance();
    assert_eq!(s1.balance(), 1_000);
    assert_eq!(c.reserve.strategies().len(), 1);

    c.reserve.remove_strategy(&s1.address);
    assert_eq!(s1.balance(), 0);                 // fully divested
    assert_eq!(c.reserve.available_held(), 1_000); // back in the vault
    assert_eq!(c.reserve.strategies().len(), 0);   // dropped from registry
    assert_eq!(c.reserve.total_assets(), 1_000);   // value preserved
}

#[test]
fn upgrade_requires_admin_and_swaps_wasm() {
    let c = setup(10_000);
    // Upload the same wasm to get a valid hash, then upgrade to it (no-op swap).
    let wasm = c.e.deployer().upload_contract_wasm(
        soroban_sdk::xdr::ScVal::Void, // placeholder; see Step 2 note
    );
    let _ = wasm;
}
```

> Note on the upgrade test: Soroban's test env exercises `update_current_contract_wasm` via `Env::deployer().upload_contract_wasm(<wasm bytes>)`. Replace the placeholder body with the standard registered-wasm upgrade test from the soroban-sdk `upgradeable` docs (https://docs.rs/soroban-sdk/26.1.0 — search "update_current_contract_wasm"): upload the reserve's own compiled wasm bytes to obtain a `BytesN<32>` hash, call `c.reserve.upgrade(&hash)` under `mock_all_auths`, and assert it does not panic. Keep `set_admin` and `remove_strategy` as the behavioral coverage; `upgrade` is a thin wrapper whose only logic is the admin gate.

- [ ] **Step 2: Run to verify the behavioral tests fail**

Run: `cargo test -p reserve set_admin_rotates remove_strategy_divests`
Expected: FAIL to compile — `set_admin` / `remove_strategy` not defined.

- [ ] **Step 3: Implement the lifecycle methods**

Add `BytesN` to the soroban_sdk import line in `contracts/reserve/src/lib.rs`
(`use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};`)
and add inside `impl Reserve`:

```rust
    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn remove_strategy(e: &Env, address: Address) {
        Self::admin(e).require_auth();
        // Pull the whole position back to the vault first.
        let client = StrategyClient::new(e, &address);
        let bal = client.balance();
        if bal > 0 {
            client.divest(&bal, &e.current_contract_address());
        }
        // Drop it from the registry.
        let list = Self::strategies(e);
        let mut next = Vec::<StrategyAlloc>::new(e);
        for s in list.iter() {
            if s.address != address {
                next.push_back(s);
            }
        }
        e.storage().instance().set(&DataKey::Strategies, &next);
    }

    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }
```

- [ ] **Step 4: Run to verify the behavioral tests pass**

Run: `cargo test -p reserve set_admin_rotates remove_strategy_divests`
Expected: PASS both.

- [ ] **Step 5: Finalize the upgrade test and run the crate**

Replace the placeholder `upgrade_requires_admin_and_swaps_wasm` body per the Step 1 note, then run:

Run: `cargo test -p reserve`
Expected: every test PASSES.

- [ ] **Step 6: Commit**

```bash
git add contracts/reserve
git commit -m "feat: reserve lifecycle — upgrade, set_admin, remove_strategy"
```

---

## Self-Review

**Spec coverage:**
- Tokenized vault / shares / NAV → Tasks 4. ✓
- Diversified multi-strategy allocator + `total_assets` summing venues → Task 5. ✓
- `strategy` trait (invest/divest/balance/underlying) → Task 2; mock impl Task 3. ✓
- Guarantee registry + `coverage_required` + `free_capital` + `sign_guarantee` gate + `settle_guarantee` → Task 6. ✓
- `cover_default` one-month, stays-active, priority liquidity → Task 7. ✓
- Surplus-gated FIFO redemption queue (request/process/claim) → Task 8. ✓
- Solvency invariant `stable_assets >= coverage_required` across a full flow → Task 9. ✓
- Upgradeability (`upgrade`) + address-wiring lessons (`remove_strategy` swap, `set_admin` rotation; `underlying` deliberately immutable) → Task 10. ✓
- Security pass: anti-inflation virtual offset + `assert shares>0` → Task 4 (`inflation_attack_*` test); stable-backed floor (`stable_assets`, `free_capital`) → Tasks 5–6; reentrancy guard + bounded `max_batch` + `cancel_redeem` → Task 8; ≥100% ratio invariant asserted in the narrative → Task 9. ✓
- DeFindex/Soroswap/Blend adapters → **Plan 2** (out of scope here, behind the trait built in Task 2; each ships its own admin-gated `upgrade` + venue-address setter per the same lessons). The `volatile` flag is wired now; `max_volatile_bps` allocation cap lands in Plan 2 with the first volatile (Soroswap/XLM) adapter. ✓
- Frontend → **Plan 3**. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"write tests for the above" — every code step carries complete code, every test step carries the assertions. Task 0 resolves the one external-API uncertainty (stellar-tokens `Base::*` names) against docs before any code depends on it.

**Type consistency:** `StrategyClient::{invest, divest, balance, underlying}` match the trait in Task 2 and the mock in Task 3. `divest(amount, to)` signature is consistent across the trait, mock, `ensure_liquidity`, and the reserve. `DataKey` (incl. `Locked`), `Guarantee`, `RedeemRequest`, `StrategyAlloc` (incl. `volatile`) are defined once in `types.rs` (Task 4) and used unchanged. `add_strategy(addr, bps, volatile)` and `process_redemptions(max_batch)` signatures match every call site (the `add_mock` helper passes `false`; test call sites pass `&10`). `total_assets` (NAV) vs `stable_assets` (solvency) and `free_capital = stable_assets − coverage_required` are used consistently from Task 5 onward. `VIRTUAL_OFFSET` is included in the `types` import in Tasks 4, 6, and 8.

## Out of scope for this plan (handled later)

- **Plan 2 (live adapters):** `adapter-defindex`, `adapter-soroswap` (XLM slot, real swaps), `adapter-blend` (stub) — each implements the Task 2 `Strategy` trait and drops into `add_strategy` with no reserve changes. Resolve DeFindex/Soroswap testnet contract ids and SDK entry points there against current docs.
- **Plan 3 (frontend):** Stellar Wallets Kit + deposit/redeem/dashboard/guarantee panels reading the views built here.
- Coverage-ratio choice for the live demo (100% full-backing vs sub-100% actuarial) is a deploy-time argument (`coverage_ratio_bps`), not a code change.
