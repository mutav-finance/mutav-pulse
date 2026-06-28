> **⚠️ Historical — superseded.** This document predates the **2026-06-27 fiança redesign** and describes an earlier design (single-leg coverage, `premium`/`collect_premium` naming, and/or pre-modular `reserve` monolith / "TGA" branding). Kept as a build-evolution record — it does **not** reflect the shipped contracts. For the current design see [`docs/specs/`](../../specs/), [`docs/whitepaper.md`](../../whitepaper.md), and the contracts.

# mutav-pulse DeFindex Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `adapter-defindex` — a `Strategy`-trait adapter that deposits the reserve's idle USDC into a DeFindex vault for real yield — so the mutav vault earns yield with no vault/policy changes.

**Architecture:** A minimal `DefindexVaultClient` (in `interfaces`) lets the adapter call a DeFindex vault cross-contract. `adapter-defindex` implements `strategy::Strategy` (`invest`/`divest`/`balance`/`underlying`), holding the DeFindex vault address (setter-wired). A `mock-defindex` test double (a tiny tokenized vault with an `accrue` yield knob) makes the adapter unit-testable in the Soroban test env.

**Tech Stack:** Rust, soroban-sdk 26.1.0, stellar-tokens 0.7.2, Cargo workspace, `stellar contract build`.

## Global Constraints

- soroban-sdk = `26.1.0`; stellar-tokens = `0.7.2`; edition `2021`; toolchain `stable`.
- Wasm builds with `stellar contract build` (NOT raw `cargo build --release`).
- Tests use `e.mock_all_auths_allowing_non_root_auth()`.
- `FungibleToken` impls require `MuxedAddress` imported; mint/burn via `Base::mint` / `Base::update`.
- All amounts `i128` (single-USDC vault → 1-element `Vec<i128>`, asset index 0).
- DeFindex `deposit` return is ignored (declared raw `Val`); adapter reads its df-share balance from the DeFindex vault's token instead.
- `divest` converts USDC→shares with **ceil** rounding (deliver ≥ requested; excess returns to the vault as liquidity).
- Adapter admin surface is only `set_vault` (admin) + `set_admin` + `upgrade`, matching the other contracts.
- Work directly on `main` (first-draft mode).

---

### Task 1: `DefindexVaultClient` in `interfaces`

**Files:**
- Modify: `contracts/interfaces/src/lib.rs`

**Interfaces:**
- Produces: `interfaces::DefindexVaultClient` with `deposit(amounts_desired, amounts_min, from, invest) -> Val`, `withdraw(df_amount, min_amounts_out, from) -> Vec<i128>`, `get_asset_amounts_per_shares(vault_shares) -> Vec<i128>`.

- [ ] **Step 1: Add the client trait**

In `contracts/interfaces/src/lib.rs`, add `Val` to the `soroban_sdk` import (`use soroban_sdk::{contractclient, contracttype, Address, Env, Val, Vec};`) and append:

```rust
/// Minimal client for a DeFindex vault (single-asset use). The rich `deposit`
/// return is ignored (captured as raw `Val`); the adapter reads its df-share
/// balance from the DeFindex vault's own token instead.
#[contractclient(name = "DefindexVaultClient")]
pub trait DefindexVault {
    fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> Val;
    fn withdraw(env: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128>;
    fn get_asset_amounts_per_shares(env: Env, vault_shares: i128) -> Vec<i128>;
}
```

- [ ] **Step 2: Verify build**

Run: `cargo build -p interfaces`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add contracts/interfaces
git commit -m "feat: add DefindexVaultClient to interfaces"
```

---

### Task 2: `mock-defindex` test double

**Files:**
- Create: `contracts/mock-defindex/Cargo.toml`, `contracts/mock-defindex/src/lib.rs`, `contracts/mock-defindex/src/test.rs`

**Interfaces:**
- Consumes: `interfaces::DefindexVault` trait.
- Produces: `mock-defindex` — a tokenized vault (df-shares = OZ fungible) implementing `deposit`/`withdraw`/`get_asset_amounts_per_shares` (1-asset), plus `accrue(amount)` (mint underlying to itself → yield) and `__constructor(underlying)`.

- [ ] **Step 1: Create the manifest**

Create `contracts/mock-defindex/Cargo.toml`:

```toml
[package]
name = "mock-defindex"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
stellar-tokens = { workspace = true }
interfaces = { path = "../interfaces" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 2: Write the failing test**

Create `contracts/mock-defindex/src/test.rs`:

```rust
#![cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, vec, Address, Env};
use crate::{MockDefindex, MockDefindexClient};

#[test]
fn deposit_accrue_withdraw_share_math() {
    let e = Env::default();
    e.mock_all_auths_allowing_non_root_auth();
    let issuer = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(issuer);
    let underlying = sac.address();
    let token = token::TokenClient::new(&e, &underlying);
    let token_admin = token::StellarAssetClient::new(&e, &underlying);

    let user = Address::generate(&e);
    token_admin.mint(&user, &1_000);

    let id = e.register(MockDefindex, (underlying.clone(),));
    let dfx = MockDefindexClient::new(&e, &id);

    // First deposit: 1000 in -> 1000 shares minted to user.
    dfx.deposit(&vec![&e, 1_000], &vec![&e, 0], &user, &true);
    assert_eq!(dfx.balance(&user), 1_000); // df-shares (FungibleToken balance)
    assert_eq!(dfx.get_asset_amounts_per_shares(&1_000).get(0).unwrap(), 1_000);

    // Yield: +100 underlying -> 1000 shares now worth 1100.
    dfx.accrue(&100);
    assert_eq!(dfx.get_asset_amounts_per_shares(&1_000).get(0).unwrap(), 1_100);

    // Withdraw 500 shares -> 550 underlying back to user.
    let out = dfx.withdraw(&500, &vec![&e, 0], &user);
    assert_eq!(out.get(0).unwrap(), 550);
    assert_eq!(token.balance(&user), 550); // got 550 underlying
    assert_eq!(dfx.balance(&user), 500); // 500 shares left
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test -p mock-defindex`
Expected: FAIL to compile — `MockDefindex` not defined.

- [ ] **Step 4: Implement the mock**

Create `contracts/mock-defindex/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, vec, Address, Env, IntoVal, MuxedAddress, String, Val, Vec};
use stellar_tokens::fungible::{Base, FungibleToken};
use interfaces::DefindexVault as DefindexVaultTrait;

#[contracttype]
enum DataKey {
    Underlying,
}

#[contract]
pub struct MockDefindex;

#[contractimpl]
impl MockDefindex {
    pub fn __constructor(e: &Env, underlying: Address) {
        Base::set_metadata(e, 7, String::from_str(e, "Mock DeFindex Share"), String::from_str(e, "mDFX"));
        e.storage().instance().set(&DataKey::Underlying, &underlying);
    }

    fn underlying_addr(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Underlying).unwrap()
    }
    fn held(e: &Env) -> i128 {
        token::TokenClient::new(e, &Self::underlying_addr(e)).balance(&e.current_contract_address())
    }

    /// Simulate yield: mint extra underlying to this vault.
    pub fn accrue(e: &Env, amount: i128) {
        token::StellarAssetClient::new(e, &Self::underlying_addr(e))
            .mint(&e.current_contract_address(), &amount);
    }
}

#[contractimpl]
impl DefindexVaultTrait for MockDefindex {
    fn deposit(e: Env, amounts_desired: Vec<i128>, _amounts_min: Vec<i128>, from: Address, _invest: bool) -> Val {
        let amount = amounts_desired.get(0).unwrap();
        let supply = Base::total_supply(&e);
        let held_before = Self::held(&e);
        let shares = if supply == 0 || held_before == 0 { amount } else { amount * supply / held_before };
        token::TokenClient::new(&e, &Self::underlying_addr(&e))
            .transfer(&from, &e.current_contract_address(), &amount);
        Base::mint(&e, &from, shares);
        shares.into_val(&e)
    }

    fn withdraw(e: Env, df_amount: i128, _min_amounts_out: Vec<i128>, from: Address) -> Vec<i128> {
        let supply = Base::total_supply(&e);
        let usdc_out = df_amount * Self::held(&e) / supply;
        Base::update(&e, Some(&from), None, df_amount); // burn shares
        token::TokenClient::new(&e, &Self::underlying_addr(&e))
            .transfer(&e.current_contract_address(), &from, &usdc_out);
        vec![&e, usdc_out]
    }

    fn get_asset_amounts_per_shares(e: Env, vault_shares: i128) -> Vec<i128> {
        let supply = Base::total_supply(&e);
        let value = if supply == 0 { 0 } else { vault_shares * Self::held(&e) / supply };
        vec![&e, value]
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for MockDefindex {
    type ContractType = Base;
}

mod test;
```

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test -p mock-defindex`
Expected: PASS — `deposit_accrue_withdraw_share_math ... ok`.

- [ ] **Step 6: Commit**

```bash
git add contracts/mock-defindex
git commit -m "feat: mock-defindex tokenized-vault test double with accrue"
```

---

### Task 3: `adapter-defindex` contract + unit tests

**Files:**
- Create: `contracts/adapter-defindex/Cargo.toml`, `contracts/adapter-defindex/src/lib.rs`, `contracts/adapter-defindex/src/test.rs`

**Interfaces:**
- Consumes: `strategy::Strategy`, `interfaces::DefindexVaultClient`, `mock-defindex`.
- Produces: `adapter-defindex` — `__constructor(admin, underlying)`, `set_vault(addr)`/`vault()`, `set_admin`, `upgrade`, and the `Strategy` impl (`invest`/`divest`/`balance`/`underlying`).

- [ ] **Step 1: Create the manifest**

Create `contracts/adapter-defindex/Cargo.toml`:

```toml
[package]
name = "adapter-defindex"
edition.workspace = true
license.workspace = true
version.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }
strategy = { path = "../strategy" }
interfaces = { path = "../interfaces" }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
mock-defindex = { path = "../mock-defindex" }
```

- [ ] **Step 2: Write the failing test**

Create `contracts/adapter-defindex/src/test.rs`:

```rust
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test -p adapter-defindex`
Expected: FAIL to compile — `AdapterDefindex` not defined.

- [ ] **Step 4: Implement the adapter**

Create `contracts/adapter-defindex/src/lib.rs`:

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, vec, Address, BytesN, Env};
use strategy::Strategy;
use interfaces::DefindexVaultClient;

#[contracttype]
enum DataKey {
    Admin,
    Underlying,
    Vault, // the DeFindex vault address
}

#[contract]
pub struct AdapterDefindex;

#[contractimpl]
impl AdapterDefindex {
    pub fn __constructor(e: &Env, admin: Address, underlying: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Underlying, &underlying);
    }

    pub fn admin(e: &Env) -> Address { e.storage().instance().get(&DataKey::Admin).unwrap() }
    pub fn vault(e: &Env) -> Address { e.storage().instance().get(&DataKey::Vault).expect("vault not set") }

    pub fn set_vault(e: &Env, addr: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Vault, &addr);
    }
    pub fn set_admin(e: &Env, new_admin: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn underlying_addr(e: &Env) -> Address { e.storage().instance().get(&DataKey::Underlying).unwrap() }
    fn dfx<'a>(e: &Env) -> DefindexVaultClient<'a> { DefindexVaultClient::new(e, &Self::vault(e)) }
    fn df_shares(e: &Env) -> i128 {
        token::TokenClient::new(e, &Self::vault(e)).balance(&e.current_contract_address())
    }
}

#[contractimpl]
impl Strategy for AdapterDefindex {
    fn invest(e: Env, amount: i128) {
        let me = e.current_contract_address();
        AdapterDefindex::dfx(&e).deposit(&vec![&e, amount], &vec![&e, 0], &me, &true);
    }

    fn divest(e: Env, amount: i128, to: Address) -> i128 {
        let shares = AdapterDefindex::df_shares(&e);
        let value = Self::balance(e.clone());
        if value <= 0 || shares <= 0 {
            return 0;
        }
        let burn = if amount >= value { shares } else { (amount * shares + value - 1) / value };
        let out = AdapterDefindex::dfx(&e).withdraw(&burn, &vec![&e, 0], &e.current_contract_address());
        let received = out.get(0).unwrap();
        token::TokenClient::new(&e, &AdapterDefindex::underlying_addr(&e))
            .transfer(&e.current_contract_address(), &to, &received);
        received
    }

    fn balance(e: Env) -> i128 {
        let shares = AdapterDefindex::df_shares(&e);
        if shares <= 0 {
            return 0;
        }
        AdapterDefindex::dfx(&e).get_asset_amounts_per_shares(&shares).get(0).unwrap()
    }

    fn underlying(e: Env) -> Address {
        AdapterDefindex::underlying_addr(&e)
    }
}

mod test;
```

- [ ] **Step 5: Run to verify it passes**

Run: `cargo test -p adapter-defindex`
Expected: PASS — both tests.

- [ ] **Step 6: Commit**

```bash
git add contracts/adapter-defindex
git commit -m "feat: adapter-defindex implementing Strategy over a DeFindex vault"
```

---

### Task 4: Vault integration test (adapter in the allocator)

**Files:**
- Modify: `contracts/adapter-defindex/Cargo.toml` (add dev-deps), `contracts/adapter-defindex/src/test.rs`

**Interfaces:**
- Consumes: `vault`, `mock-policy`, `mock-defindex`, `adapter-defindex`.

- [ ] **Step 1: Add dev-dependencies**

In `contracts/adapter-defindex/Cargo.toml`, extend `[dev-dependencies]`:

```toml
[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
mock-defindex = { path = "../mock-defindex" }
vault = { path = "../vault" }
mock-policy = { path = "../mock-policy" }
```

- [ ] **Step 2: Write the failing integration test**

Append to `contracts/adapter-defindex/src/test.rs`:

```rust
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
    vault.deposit(&alice, &10_000);
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `cargo test -p adapter-defindex adapter_drops_into_vault`
Expected: FAIL to compile — missing dev-deps / imports until added.

- [ ] **Step 4: Make it pass**

The test exercises only already-implemented code (vault, mock-policy, adapter, mock-defindex). After adding the dev-deps (Step 1) and the imports at the top of the appended block, run:

Run: `cargo test -p adapter-defindex adapter_drops_into_vault`
Expected: PASS — yield flows through the adapter into the vault's NAV and back out on redemption.

- [ ] **Step 5: Run the whole crate + workspace**

Run: `cargo test`
Expected: all crates PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/adapter-defindex
git commit -m "test: adapter-defindex drops into the vault allocator and earns yield"
```

---

### Task 5: Bootstrap wiring + testnet DeFindex vault sourcing

**Files:**
- Modify: `bootstrap.sh`
- Create: `docs/defindex-testnet.md`

**Interfaces:**
- Consumes: the deployed `adapter-defindex` wasm + a DeFindex testnet vault address.

- [ ] **Step 1: Document testnet vault sourcing**

Create `docs/defindex-testnet.md`:

```markdown
# DeFindex testnet vault

`adapter-defindex` needs a DeFindex vault address (single USDC asset). Two ways:

1. **Create one via the DeFindex factory** (preferred, self-contained). Resolve the
   current testnet factory id from https://docs.defindex.io and call
   `create_defindex_vault` with: assets = [USDC], an underlying DeFindex strategy
   for USDC, manager = our admin, emergency_manager/fee_receiver = our admin. Record
   the returned vault id and export it as `DEFINDEX_VAULT`.
2. **Use an existing public testnet USDC vault** if DeFindex publishes one — export
   its id as `DEFINDEX_VAULT`.

If neither is available at demo time, set `DEFINDEX_VAULT` empty and the bootstrap
wires `mock-strategy` instead (the adapter + its tests still ship). The adapter is
vault-agnostic — only `set_vault` changes.
```

- [ ] **Step 2: Extend bootstrap.sh**

Add to `bootstrap.sh`, after the existing strategy wiring, a DeFindex branch:

```bash
# --- DeFindex yield adapter (optional) ---
# export DEFINDEX_VAULT=<a DeFindex testnet vault id> to use real yield.
if [ -n "${DEFINDEX_VAULT:-}" ]; then
  ADAPTER=$(dep adapter_defindex.wasm --admin "$ADMIN" --underlying "$USDC_SAC")
  inv "$ADAPTER" set_vault --addr "$DEFINDEX_VAULT"
  inv "$VAULT" add_strategy --address "$ADAPTER" --weight_bps 10000 --volatile false
  echo "ADAPTER_DEFINDEX=$ADAPTER (DeFindex vault $DEFINDEX_VAULT)"
else
  echo "DEFINDEX_VAULT unset -> using mock-strategy slot only"
fi
```

(Assumes the existing `dep`/`inv` helpers and `$VAULT`/`$USDC_SAC`/`$ADMIN` vars from the modular bootstrap. If the existing bootstrap added `mock-strategy` at 100% weight, lower or remove that `add_strategy` when `DEFINDEX_VAULT` is set so the reserve actually flows to DeFindex.)

- [ ] **Step 3: Build to confirm the adapter wasm is produced**

Run: `stellar contract build`
Expected: `adapter_defindex.wasm` appears in `target/wasm32v1-none/release/` alongside the others.

- [ ] **Step 4: Commit**

```bash
chmod +x bootstrap.sh
git add bootstrap.sh docs/defindex-testnet.md
git commit -m "chore: bootstrap wires adapter-defindex when DEFINDEX_VAULT is set"
```

---

## Self-Review

**Spec coverage:**
- `DefindexVaultClient` (deposit→Val, withdraw, get_asset_amounts_per_shares) → Task 1. ✓
- `adapter-defindex` Strategy impl (invest/divest ceil/balance/underlying) + setter-wired vault + upgrade → Task 3. ✓
- `mock-defindex` test double with `accrue` → Task 2. ✓
- Adapter unit tests (invest/balance/accrue/divest partial + full) → Task 3. ✓
- Vault integration (adapter in allocator, yield lifts NAV, divest on redemption) → Task 4. ✓
- Testnet vault sourcing (factory/existing/fallback) + bootstrap → Task 5. ✓

**Placeholder scan:** No TBD/vague items. The testnet vault id is resolved in `docs/defindex-testnet.md` (a real procedure with a fallback), not a code placeholder. All code steps carry complete code.

**Type consistency:** `DefindexVaultClient::{deposit(Vec,Vec,Address,bool)->Val, withdraw(i128,Vec,Address)->Vec<i128>, get_asset_amounts_per_shares(i128)->Vec<i128>}` match the trait (Task 1), the mock impl (Task 2), and the adapter's calls (Task 3). `Strategy::{invest, divest(amount,to)->i128, balance->i128, underlying->Address}` match `strategy` and the adapter impl. `AdapterDefindexClient::{set_vault, vault, invest, divest, balance, underlying}` consistent across Tasks 3–4. `MockDefindexClient::{deposit, withdraw, get_asset_amounts_per_shares, accrue, balance}` consistent across Tasks 2–4.

## Out of scope (later)
- Soroswap (XLM swap) + Blend adapters — separate plans.
- Real `amounts_min` slippage floors; multi-asset DeFindex vaults.
- Auto-invest-on-deposit in the vault (allocation stays `rebalance()`-triggered).
