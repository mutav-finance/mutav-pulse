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
    /// let a guarantee charge a fee above its own monthly amount.
    FeeTooHigh = 300,
}

/// Default grace window (seconds) before a missed fee tips a guarantee into
/// default. Fiança semantics: the fee stream IS the default oracle — fee paid on
/// time = solvent, fee missed past this window = default = the guarantee pays in.
/// 5 days (432_000s). FLAGGED for pilot confirmation; admin-settable via
/// `set_grace_secs`.
const DEFAULT_GRACE_SECS: u64 = 432_000;

// ─────────────────── Policy lifecycle events (SEP-0056 parity) ───────────────────
// Observability for the underwriting state machine, mirroring the vault's bare
// `#[contractevent]` Deposit convention. With no explicit `topics` attribute the
// derive auto-derives a snake_case name topic from the struct ident, so these
// publish stable name topics `guarantee_signed` / `fee_paid` / `default_covered` /
// `exit_covered` / `guarantee_settled` for off-chain indexers. All Address fields
// are owned (cloned at emit time). Topic counts stay under the 4 cap.
//
// LAPSE SEMANTICS (fiança, not insurance): `fee_paid` records the tenant keeping
// the guarantee current — paid_until is pushed forward. A MISSED fee past the
// grace window is what AUTHORIZES the payout (`default_covered`), it does not
// release coverage. The default oracle is the fee stream itself.

/// Emitted by `sign_guarantee` after the guarantee is committed to the registry.
/// Topics: [name, landlord] (2).
#[contractevent]
pub struct GuaranteeSigned {
    #[topic]
    pub landlord: Address,
    pub id: u32,
    pub monthly_amount: i128,
    pub months_covered: u32,
    pub exit_months: u32,
    pub fee_bps: u32,
    pub period_secs: u64,
}

/// Emitted by `pay_fee` after the fee is pulled into the vault and `paid_until`
/// is extended. Topics: [name, payer, id] (3).
#[contractevent]
pub struct FeePaid {
    #[topic]
    pub payer: Address,
    #[topic]
    pub id: u32,
    pub fee: i128,
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

/// Emitted by `cover_exit` only after a successful `vault.disburse`.
/// Topics: [name, id, landlord] (3).
#[contractevent]
pub struct ExitCovered {
    #[topic]
    pub id: u32,
    #[topic]
    pub landlord: Address,
    pub amount: i128,
    pub exit_used: i128,
    pub exit_remaining: i128,
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
    // ADDITIVE + LAYOUT-PRESERVING: appended LAST. The contracttype enum encoding
    // is positional, so appending preserves the encoding of every existing key.
    // Admin-settable grace window (seconds) before a missed fee = default.
    GraceSecs, // u64
}

#[contract]
pub struct Policy;

fn fee_of(g: &Guarantee) -> i128 {
    // Floor is favorable-to-vault for a fee charged to a payer. fee_bps is
    // bounded <= 10_000 at sign_guarantee, so checked_mul alone closes the trap
    // without pulling the I256 machinery for this site. Value-identical to prior.
    g.monthly_amount
        .checked_mul(g.fee_bps as i128)
        .expect("fee mul overflow")
        / BPS_DENOM
}

#[contractimpl]
impl Policy {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::CoverageRatioBps, &10_000u32);
        e.storage().instance().set(&DataKey::GraceSecs, &DEFAULT_GRACE_SECS);
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

    /// Grace window (seconds) before a missed fee tips a guarantee into default.
    /// Falls back to `DEFAULT_GRACE_SECS` for a pre-default upgraded-in instance.
    pub fn grace_secs(e: &Env) -> u64 {
        e.storage().instance().get(&DataKey::GraceSecs).unwrap_or(DEFAULT_GRACE_SECS)
    }
    pub fn set_grace_secs(e: &Env, secs: u64) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::GraceSecs, &secs);
    }

    pub fn guarantee(e: &Env, id: u32) -> Guarantee { Self::registry(e).get(&id) }
    /// `true` while the fee has NOT yet lapsed (`paid_until > now`). Fiança
    /// semantics: a current guarantee is one the tenant is keeping paid; once
    /// `paid_until <= now` the fee has lapsed and (past the grace window) the
    /// guarantee is in default — `cover_default` is what then pays in.
    pub fn is_current(e: &Env, id: u32) -> bool { Self::registry(e).get(&id).paid_until > e.ledger().timestamp() }
    pub fn monthly_fee(e: &Env, id: u32) -> i128 {
        let g = Self::registry(e).get(&id);
        fee_of(&g)
    }

    pub fn sign_guarantee(e: &Env, landlord: Address, monthly_amount: i128, months_covered: u32, exit_months: u32, fee_bps: u32, period_secs: u64) -> Result<u32, PolicyError> {
        Self::admin(e).require_auth();
        assert!(monthly_amount > 0 && months_covered > 0, "invalid guarantee");
        assert!(fee_bps > 0 && period_secs > 0, "invalid fee terms");
        // Bound the fee at 100% (10_000 bps). Above this a single period's fee
        // would exceed the monthly amount it backs.
        if fee_bps > BPS_DENOM as u32 {
            return Err(PolicyError::FeeTooHigh);
        }
        let reg = Self::registry(e);
        let id = reg.next_id();
        let landlord_topic = landlord.clone();
        // paid_until = now (NOT 0): the obligation exists immediately and the first
        // fee is due within the grace window. paid_until=0 would make a fresh
        // guarantee instantly in default under `paid_until + grace < now`.
        reg.put(&Guarantee {
            id, landlord, monthly_amount, months_covered, months_used: 0,
            fee_bps, period_secs, paid_until: e.ledger().timestamp(), active: true,
            exit_months, exit_used: 0,
        });
        // #40 capacity gate: the registry aggregate now already includes BOTH this
        // guarantee's legs (default + exit), so assert the book stays solvent. The
        // book grows exactly as far as capital backs it — no count ceiling. Assert
        // BEFORE the event publish (emit-after-assert).
        assert!(Self::vault(e).stable_assets() >= Self::coverage_required(e.clone()), "insufficient capital to cover guarantee");
        GuaranteeSigned {
            landlord: landlord_topic, id, monthly_amount, months_covered, exit_months, fee_bps, period_secs,
        }
        .publish(e);
        Ok(id)
    }

    pub fn pay_fee(e: &Env, payer: Address, id: u32) {
        payer.require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        let fee = fee_of(&g);
        assert!(fee > 0, "zero fee");
        Self::vault(e).collect_fee(&payer, &fee);
        let now = e.ledger().timestamp();
        let base = if g.paid_until > now { g.paid_until } else { now };
        g.paid_until = base + g.period_secs;
        reg.put(&g);
        // NO post-put solvency reassert: pay_fee leaves active/months_used/exit_used
        // unchanged, so the registry put-delta is provably 0 (coverage was reserved
        // at signing). Re-checking solvency on the tenant hot path is wrong-shaped;
        // the only solvency gate is at sign_guarantee.
        FeePaid { payer: payer.clone(), id, fee, paid_until: g.paid_until }.publish(e);
    }

    pub fn cover_default(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        assert!(g.months_used < g.months_covered, "coverage exhausted");
        // Lapse-flip: default is a MISSED fee past the grace window. The fee stream
        // is the default oracle — `paid_until + grace < now` is precisely what
        // authorizes the payout (the inverse of the old "premiums not up to date").
        assert!(g.paid_until.saturating_add(Self::grace_secs(e)) < e.ledger().timestamp(), "not in default");
        // NO auto-deactivate at default exhaustion: the exit leg must stay
        // reservable until settle. Deactivating here would release the whole unused
        // exit term (a delta-exactness trap). The default cap is held purely by the
        // months_used < months_covered assert above (default_term naturally -> 0).
        g.months_used += 1;
        // HARD ORDER: decrement-and-persist FIRST, THEN compute the witness, THEN
        // disburse (re-entrancy invariant — the vault asserts the floor against a
        // value it already holds, never re-entering this policy frame).
        reg.put(&g);
        let coverage_after = Self::coverage_required(e.clone());
        Self::vault(e).disburse(&g.landlord, &g.monthly_amount, &coverage_after);
        DefaultCovered {
            id,
            landlord: g.landlord.clone(),
            amount: g.monthly_amount,
            months_used: g.months_used,
            months_remaining: g.months_covered.saturating_sub(g.months_used),
        }
        .publish(e);
    }

    /// EXIT leg (property-recovery/restoration) — pay an exit cost up to the cap
    /// `monthly_amount * exit_months` (6× rent at the pilot params), in arbitrary
    /// partial/multiple draws (eviction, damages, restoration). Admin-gated, same
    /// witness pattern as `cover_default`.
    pub fn cover_exit(e: &Env, id: u32, amount: i128) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        assert!(g.active, "guarantee inactive");
        assert!(amount > 0, "zero exit amount");
        let cap = g.monthly_amount.checked_mul(g.exit_months as i128).expect("exit cap overflow");
        assert!(g.exit_used.checked_add(amount).expect("exit_used overflow") <= cap, "exit cap exceeded");
        // HARD ORDER: decrement-and-persist FIRST, THEN witness, THEN disburse.
        g.exit_used += amount;
        reg.put(&g);
        let coverage_after = Self::coverage_required(e.clone());
        Self::vault(e).disburse(&g.landlord, &amount, &coverage_after);
        ExitCovered {
            id,
            landlord: g.landlord.clone(),
            amount,
            exit_used: g.exit_used,
            exit_remaining: cap - g.exit_used,
        }
        .publish(e);
    }

    pub fn settle_guarantee(e: &Env, id: u32) {
        Self::admin(e).require_auth();
        let reg = Self::registry(e);
        let mut g = reg.get(&id);
        g.active = false;
        // The registry put-delta releases BOTH remaining legs (default + exit)
        // automatically — contribution(g) drops to 0 once active = false.
        reg.put(&g);
        GuaranteeSettled { id }.publish(e);
    }
}

#[contractimpl]
impl PolicyTrait for Policy {
    // #39: O(1). coverage_required is a single read of the registry's running
    // raw-coverage aggregate (Σ contribution over active guarantees, maintained
    // incrementally inside registry::put), scaled by the ratio knob with CEIL
    // rounding. No O(n) loop, no time-gate. It STAYS a pure function of registry
    // state (the aggregate lives in the registry, not policy instance storage) so
    // policy_swap_preserves_coverage holds — a freshly-wired policy-v2 reads the
    // SAME registry aggregate with no migration.
    //
    // Ceil keeps the capital floor never-understated (Nexus coverage-anchored
    // solvency); at ratio == 10_000 (c = 1.0, default) ceil(raw*10_000/10_000) ==
    // raw exactly, so default-config figures do not shift. The ratio knob keeps
    // `c < 1` actuarial mode and `c > 1` over-collateralization available.
    fn coverage_required(e: Env) -> i128 {
        let ratio = Self::ratio(&e);
        mul_div_with_rounding(&e, Self::registry(&e).raw_coverage(), ratio, BPS_DENOM, Rounding::Ceil)
    }
}

mod test;
mod test_system;
