#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env};
use stellar_contract_utils::math::{i128_fixed_point::mul_div_with_rounding, Rounding};
use interfaces::{BPS_DENOM, Guarantee, Policy as PolicyTrait, RegistryClient, VaultClient};

/// Underwriting errors surfaced as stable `#[contracterror]` codes. Numbered in
/// the `3xx` band to stay clear of the registry `2xx` and strategy `4xx` codes.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PolicyError {
    /// `fee_bps` exceeds 100% (10_000 bps). Previously accepted silently, which
    /// let a guarantee charge a premium above its own monthly amount.
    FeeTooHigh = 300,
}

// ─────────────────── Policy lifecycle events (SEP-0056 parity) ───────────────────
// Observability for the underwriting state machine, mirroring the vault's bare
// `#[contractevent]` Deposit convention. With no explicit `topics` attribute the
// derive auto-derives a snake_case name topic from the struct ident, so these
// publish stable name topics `guarantee_signed` / `premium_paid` /
// `default_covered` / `guarantee_settled` for off-chain indexers. All Address
// fields are owned (cloned at emit time). Topic counts stay under the 4 cap.

/// Emitted by `sign_guarantee` after the guarantee is committed to the registry.
/// Topics: [name, landlord] (2).
#[contractevent]
pub struct GuaranteeSigned {
    #[topic]
    pub landlord: Address,
    pub id: u32,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub fee_bps: u32,
    pub period_secs: u64,
}

/// Emitted by `pay_premium` only after the post-activation solvency assert passes.
/// Topics: [name, payer, id] (3).
#[contractevent]
pub struct PremiumPaid {
    #[topic]
    pub payer: Address,
    #[topic]
    pub id: u32,
    pub premium: i128,
    pub paid_until: u64,
}

/// Emitted by `cover_default` only after a successful `vault.disburse`.
/// Topics: [name, id, landlord] (3).
#[contractevent]
pub struct DefaultCovered {
    #[topic]
    pub id: u32,
    #[topic]
    pub landlord: Address,
    pub amount: i128,
    pub months_used: u32,
    pub months_remaining: u32,
}

/// Emitted by `settle_guarantee` after the deactivation is committed.
/// Topics: [name, id] (2).
#[contractevent]
pub struct GuaranteeSettled {
    #[topic]
    pub id: u32,
}

#[contracttype]
enum DataKey {
    Admin,
    Vault,
    Registry,
    CoverageRatioBps,
}

#[contract]
pub struct Policy;

fn premium_of(g: &Guarantee) -> i128 {
    // Floor is favorable-to-vault for a premium charged to a payer. fee_bps is
    // bounded <= 10_000 at sign_guarantee, so checked_mul alone closes the trap
    // without pulling the I256 machinery for this site. Value-identical to prior.
    g.monthly_amount
        .checked_mul(g.fee_bps as i128)
        .expect("premium mul overflow")
        / BPS_DENOM
}

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
    pub fn set_coverage_ratio_bps(e: &Env, bps: u32) {
        Self::admin(e).require_auth();
        // Bound at 1000% (10x BPS_DENOM) so an absurd ratio can never overflow
        // `raw * ratio` in coverage_required. Over-collateralization (>100%) is a
        // legitimate knob, so this is NOT clamped to 10_000 — only overflow-class
        // values are rejected.
        assert!(bps <= 10 * BPS_DENOM as u32, "coverage_ratio_bps exceeds 1000%");
        e.storage().instance().set(&DataKey::CoverageRatioBps, &bps);
    }
    pub fn set_admin(e: &Env, new_admin: Address) { Self::admin(e).require_auth(); e.storage().instance().set(&DataKey::Admin, &new_admin); }
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) { Self::admin(e).require_auth(); e.deployer().update_current_contract_wasm(new_wasm_hash); }

    pub fn guarantee(e: &Env, id: u32) -> Guarantee { Self::registry(e).get(&id) }
    pub fn is_current(e: &Env, id: u32) -> bool { Self::registry(e).get(&id).paid_until > e.ledger().timestamp() }
    pub fn monthly_premium(e: &Env, id: u32) -> i128 {
        let g = Self::registry(e).get(&id);
        premium_of(&g)
    }

    pub fn sign_guarantee(e: &Env, landlord: Address, monthly_amount: i128, months_covered: u32, fee_bps: u32, period_secs: u64) -> Result<u32, PolicyError> {
        Self::admin(e).require_auth();
        assert!(monthly_amount > 0 && months_covered > 0, "invalid guarantee");
        assert!(fee_bps > 0 && period_secs > 0, "invalid premium terms");
        // Bound the fee at 100% (10_000 bps). Above this a single period's premium
        // would exceed the monthly amount it insures.
        if fee_bps > BPS_DENOM as u32 {
            return Err(PolicyError::FeeTooHigh);
        }
        let reg = Self::registry(e);
        let id = reg.next_id();
        let landlord_topic = landlord.clone();
        reg.put(&Guarantee {
            id, landlord, monthly_amount, months_covered, months_used: 0,
            fee_bps, period_secs, paid_until: 0, active: true,
        });
        GuaranteeSigned {
            landlord: landlord_topic, id, monthly_amount, months_covered, fee_bps, period_secs,
        }
        .publish(e);
        Ok(id)
    }

    pub fn pay_premium(e: &Env, payer: Address, id: u32) {
        payer.require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        let premium = premium_of(&g);
        assert!(premium > 0, "zero premium");
        Self::vault(e).collect_premium(&payer, &premium);
        let now = e.ledger().timestamp();
        let base = if g.paid_until > now { g.paid_until } else { now };
        g.paid_until = base + g.period_secs;
        reg.put(&g);
        assert!(Self::vault(e).stable_assets() >= Self::coverage_required(e.clone()), "insufficient capital to activate coverage");
        PremiumPaid { payer: payer.clone(), id, premium, paid_until: g.paid_until }.publish(e);
    }

    pub fn cover_default(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        assert!(g.months_used < g.months_covered, "coverage exhausted");
        assert!(g.paid_until > e.ledger().timestamp(), "premiums not up to date");
        g.months_used += 1;
        if g.months_used == g.months_covered { g.active = false; }
        reg.put(&g);
        Self::vault(e).disburse(&g.landlord, &g.monthly_amount);
        DefaultCovered {
            id,
            landlord: g.landlord.clone(),
            amount: g.monthly_amount,
            months_used: g.months_used,
            months_remaining: g.months_covered.saturating_sub(g.months_used),
        }
        .publish(e);
    }

    pub fn settle_guarantee(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        g.active = false;
        reg.put(&g);
        GuaranteeSettled { id }.publish(e);
    }
}

#[contractimpl]
impl PolicyTrait for Policy {
    // H3 (re-audit): this STILL iterates the registry's active set — and that is
    // deliberate, not an un-fixed defect. An exact-equivalent O(1) scalar aggregate
    // is provably impossible here for two code-grounded reasons:
    //   (1) The `paid_until > now` time-gate below flips with the passage of time
    //       ALONE — a guarantee silently drops out of coverage when its premium
    //       lapses, with no state-mutating call to hook an increment/decrement onto.
    //       A running scalar cannot track that without a Centrifuge-style epoch/timer
    //       (out of scope for this prototype). The lapse->0 / per-month step-down /
    //       unpaid->0 semantics that policy/src/test.rs encodes depend on this gate.
    //   (2) A policy-INSTANCE aggregate would violate the stateless-policy-swap
    //       invariant: test_system.rs::policy_swap_preserves_data_and_funds deploys a
    //       fresh policy-v2 wired to the EXISTING registry and asserts
    //       `policy2.coverage_required() == coverage_before` with NO migration call —
    //       a per-instance scalar would read 0 on the swapped-in instance and fail.
    //       coverage_required must remain a PURE FUNCTION of registry state.
    // The cost is bounded instead at the registry via `MAX_ACTIVE_GUARANTEES`
    // (Yearn-v3 — avoid unbounded per-call iteration over a growth-unbounded set),
    // making this loop's worst-case a known constant while keeping behavior 100%
    // preserved. The checked_mul/checked_add below stay overflow-safe at the cap
    // (cap * monthly_amount * 10x ratio is well inside i128 for realistic amounts).
    fn coverage_required(e: Env) -> i128 {
        let ratio = Self::ratio(&e);
        let now = e.ledger().timestamp();
        let reg = Self::registry(&e);
        let mut raw = 0i128;
        for id in reg.active_ids().iter() {
            let g = reg.get(&id);
            if g.paid_until > now {
                // Overflow-safe accumulation (keeps the saturating_sub month delta).
                raw = raw
                    .checked_add(
                        g.monthly_amount
                            .checked_mul(g.months_covered.saturating_sub(g.months_used) as i128)
                            .expect("coverage mul overflow"),
                    )
                    .expect("coverage sum overflow");
            }
        }
        // Apply the ratio with CEIL so the capital floor is never understated
        // (Nexus coverage-anchored solvency). Ceil only tightens the pre-disburse
        // gate and composes safely with the re-entrancy invariant (policy reduces
        // coverage BEFORE vault.disburse; vault never calls coverage_required
        // mid-disburse). At ratio == 10_000 (default), ceil(raw*10_000/10_000)
        // == raw exactly — default-config figures do not shift.
        mul_div_with_rounding(&e, raw, ratio, BPS_DENOM, Rounding::Ceil)
    }
}

mod test;
mod test_system;
