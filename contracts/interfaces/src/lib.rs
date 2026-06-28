#![no_std]
use soroban_sdk::{contractclient, contracterror, contracttype, Address, Env, Val, Vec};

/// Errors surfaced across the registry boundary. Defined here (not in the
/// `registry` crate) because the `Registry` trait's return type references it,
/// so every consumer of the generated `RegistryClient` sees the same stable
/// `#[contracterror]` codes. Numbered in the `2xx` band to stay clear of the
/// `4xx` strategy codes in `defindex-hodl`.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    /// No guarantee is stored under the requested id (previously a host trap
    /// from `Option::unwrap` on missing storage).
    GuaranteeNotFound = 200,
    /// Caller supplied a guarantee id outside the issued range (>= NextId). The
    /// registry derives ids from its own monotonic counter; a writer must never
    /// fabricate the primary key, nor overwrite a not-yet-issued slot (CWE-840).
    /// ADDITIVE: new discriminant; `GuaranteeNotFound = 200` is unchanged so the
    /// `#[contracterror]` ABI stays stable for in-place `upgrade()`.
    InvalidId = 201,
    /// The Writer role was read before it was set. The constructor now defaults
    /// Writer=admin, so this is defense-in-depth: it converts the host trap that
    /// an older (pre-default) upgraded-in instance would hit into a stable typed
    /// error. ADDITIVE.
    WriterNotSet = 202,
    /// `upgrade` was called against an on-chain schema version this binary does
    /// not expect (stale / layout-incompatible storage). Distinct from `InvalidId`
    /// so a refused stale-layout upgrade is distinguishable from a put id error in
    /// logs. Layout-changing edits must redeploy + re-wire via `bootstrap.sh`, not
    /// `upgrade()`. ADDITIVE.
    VersionMismatch = 203,
}

/// Basis-points denominator (100% = 10_000). Single-sourced here (the
/// cross-contract boundary crate) so vault/policy/adapter-defindex import it
/// instead of each redeclaring it. Compile-time const, not a DataKey — zero
/// storage / upgrade-layout impact.
pub const BPS_DENOM: i128 = 10_000;

/// Stable core of a guarantee. Model-specific extras live in the policy's own
/// storage, keyed by id — never here.
///
/// TWO-LEG COVERAGE MODEL (fiança, not insurance). The obligation a fiador backs
/// has two legs, each reserved at signing and drawn independently:
///
///  - DEFAULT (rent-arrears) leg — `months_covered` / `months_used`. The short
///    rent-arrears window; pilot `months_covered = 3`. Drawn one month per call via
///    `Policy::cover_default` (`months_used += 1`, capped at `months_covered`). Its
///    remaining contribution is `monthly_amount * (months_covered - months_used)`.
///  - EXIT (property-recovery/restoration) leg — `exit_months` / `exit_used`. The
///    cost of recovering and restoring the property (eviction, damages, restoration);
///    pilot `exit_months = 6`. Drawn in arbitrary partial amounts via `Policy::cover_exit`
///    up to the cap `monthly_amount * exit_months`. Its remaining contribution is
///    `monthly_amount * exit_months - exit_used`.
///
/// Max executable obligation per guarantee = `monthly_amount * (months_covered +
/// exit_months)` = 9× monthly rent at the pilot params, at coverage ratio `c = 1.0`.
///
/// NON-NEGATIVITY INVARIANT (load-bearing for the registry conservative-drift
/// property): `0 <= exit_used <= monthly_amount * exit_months` and
/// `0 <= months_used <= months_covered`, so BOTH leg contributions stay `>= 0` at
/// every write. The registry's running `raw_coverage` aggregate is the sum of these
/// non-negative contributions; if a leg could go negative the conservative-drift
/// guarantee (any lag errs by reserving too much, never too little) would break.
///
/// OUT OF SCOPE here: per-agency / per-tenant identifiers and per-leg draw
/// timestamps stay in the policy's own keyed storage — never in this struct.
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
    /// EXIT leg term as a multiple of monthly rent (pilot = 6). Reserves
    /// `monthly_amount * exit_months` of coverage for property recovery/restoration.
    pub exit_months: u32,
    /// Cumulative underlying drawn via `cover_exit`. Starts 0, only grows (capped at
    /// `monthly_amount * exit_months`). `i128` to match `monthly_amount` so the cap
    /// and exit-term arithmetic stay pure `i128` with no lossy casts.
    pub exit_used: i128,
}

#[contractclient(name = "VaultClient")]
pub trait Vault {
    /// Money-OUT path the solvency model turns on. This doc is a DRIFT-GUARD that
    /// pins an invariant the runtime ALREADY enforces (the `require_auth` and the
    /// witness assertion live in `Vault::disburse` / `Policy::cover_default` /
    /// `Policy::cover_exit`); the comment exists so the trait boundary cannot
    /// silently diverge from those impls. Keep it consistent with the impl comment
    /// in `Vault::disburse` (vault crate) — if that comment changes, this one must
    /// move with it.
    ///
    /// AUTHORIZATION (policy-only, unchanged): implementations MUST `require_auth()`
    /// the registered policy address read from instance storage (the impl loads
    /// `DataKey::Policy` then calls `policy.require_auth()`). It MUST NOT be
    /// authorized by admin or by any arbitrary caller — disburse is purely the
    /// policy's money-path, never a direct admin lever.
    ///
    /// WITNESS CONTRACT (`coverage_after`): the policy passes `coverage_after =
    /// coverage_required()` recomputed AFTER it has decremented and persisted the
    /// guarantee. The vault asserts, holding the existing overdraft guard:
    ///
    /// ```text
    /// let stable_pre = stable_assets_inner(&e);
    /// assert!(stable_pre >= amount, "disburse overdraft");
    /// assert!(stable_pre - amount >= coverage_after, "disburse breaches solvency");
    /// ```
    ///
    /// `stable_pre` is a value the vault ALREADY holds (its own stable balance), so
    /// the post-payout solvency floor `stable_post = stable_pre - amount >=
    /// coverage_after` (Nexus-style coverage-anchored solvency) is checked WITHOUT
    /// the vault re-entering the policy. The overdraft guard
    /// (`stable_pre >= amount`) is retained as a separate vault-overdraft proof.
    /// CALLER OBLIGATION: the calling `Policy::cover_default` / `Policy::cover_exit`
    /// MUST decrement-and-persist the guarantee via `registry.put(g)` FIRST, THEN
    /// compute the witness `coverage_after = coverage_required()`, THEN call
    /// `vault.disburse(to, amount, coverage_after)`.
    ///
    /// RE-ENTRANCY: the vault still MUST NOT read `policy.coverage_required()` during
    /// disburse. Soroban forbids re-entering the in-progress policy contract frame,
    /// so the vault structurally cannot call back into the mid-disburse policy; the
    /// witness exists precisely so the floor can be enforced from a value the vault
    /// already holds rather than by an in-method callback.
    ///
    /// TRUST BASIS: the witness is trustworthy because it rides on the
    /// `policy.require_auth()` that disburse already demands — only the registered
    /// policy can produce a `coverage_after`. The residual, stated explicitly: the
    /// vault CANNOT independently recompute `coverage_required` and trusts
    /// `coverage_after` BLINDLY — a buggy-but-honest policy could pass a too-low
    /// value and the assert would still pass. This is the spec's approved tradeoff
    /// (decision-table line 54). Note disburse realizes liquidity via
    /// `ensure_liquidity` (which can typed-revert `VaultError::InsufficientLiquidity`
    /// = 600 under a lossy adapter) and does NOT route through the
    /// `mul_div_with_rounding` / `VIRTUAL_OFFSET` share math — that lives only in
    /// `to_shares` / `to_assets`.
    fn disburse(env: Env, to: Address, amount: i128, coverage_after: i128);
    fn collect_fee(env: Env, from: Address, amount: i128);
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
    fn get(env: Env, id: u32) -> Result<Guarantee, RegistryError>;
    fn active_ids(env: Env) -> Vec<u32>;
    /// O(1) running aggregate of remaining raw coverage across all active
    /// guarantees: `Σ contribution(g)` where `contribution(g) = active ?
    /// monthly_amount*(months_covered - months_used) + (monthly_amount*exit_months -
    /// exit_used) : 0`. Maintained incrementally inside `put` by a delta (the single
    /// mutator chokepoint) so `policy::coverage_required` is one read, not an O(n)
    /// loop. Pure read — no auth in the trait.
    fn raw_coverage(env: Env) -> i128;
}

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

#[cfg(test)]
mod test {
    use super::Guarantee;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    /// Pin the single-sourced BPS denominator against accidental drift — it must
    /// stay value-identical to the three redeclarations it replaced (all 10_000).
    #[test]
    fn bps_denom_is_10000() {
        assert_eq!(super::BPS_DENOM, 10_000);
    }

    /// The `Guarantee` struct carries both coverage legs: DEFAULT (rent-arrears,
    /// `months_covered`/`months_used`) and EXIT (property-recovery,
    /// `exit_months`/`exit_used`). Constructs a literal with the pilot params and
    /// asserts all four leg fields are present and addressable.
    #[test]
    fn guarantee_carries_two_coverage_legs() {
        let env = Env::default();
        let landlord = Address::generate(&env);
        let g = Guarantee {
            id: 1,
            landlord,
            monthly_amount: 1_000,
            months_covered: 3,
            months_used: 0,
            fee_bps: 100,
            period_secs: 2_592_000,
            paid_until: 0,
            active: true,
            exit_months: 6,
            exit_used: 0,
        };
        assert_eq!(g.months_covered, 3);
        assert_eq!(g.months_used, 0);
        assert_eq!(g.exit_months, 6);
        assert_eq!(g.exit_used, 0);
    }

    /// Max executable obligation = default_term + exit_term = 9× monthly rent at the
    /// pilot params (`months_covered = 3`, `exit_months = 6`), at `c = 1.0`. Both
    /// leg terms must be `>= 0` (the non-negativity invariant the registry's
    /// conservative-drift property leans on).
    #[test]
    fn two_leg_obligation_is_nine_x() {
        let env = Env::default();
        let landlord = Address::generate(&env);
        let g = Guarantee {
            id: 1,
            landlord,
            monthly_amount: 1_000,
            months_covered: 3,
            months_used: 0,
            fee_bps: 100,
            period_secs: 2_592_000,
            paid_until: 0,
            active: true,
            exit_months: 6,
            exit_used: 0,
        };
        let default_term =
            g.monthly_amount * (g.months_covered as i128 - g.months_used as i128);
        let exit_term = g.monthly_amount * g.exit_months as i128 - g.exit_used;
        assert_eq!(default_term, 3_000);
        assert_eq!(exit_term, 6_000);
        assert_eq!(default_term + exit_term, 9_000);
        assert!(default_term >= 0);
        assert!(exit_term >= 0);
    }
}
