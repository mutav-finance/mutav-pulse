#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, Vec};
use interfaces::{Guarantee, Registry as RegistryTrait, RegistryError};

/// Schema version of this contract's storage layout. Bumped only by a migrating
/// binary that changes the on-chain layout; an in-place `upgrade()` is refused
/// (VersionMismatch) when the stored version differs from this, so a stale-layout
/// instance is routed through redeploy + `bootstrap.sh` re-wire instead.
pub const CURRENT_SCHEMA_VERSION: u32 = 2;

// ───────────────────── #39/#40: O(1) RawCoverage aggregate ─────────────────────
//
// `put` is the SOLE mutator of `DataKey::RawCoverage` — the running raw-coverage
// scalar (Σ contribution over active guarantees) is maintained incrementally by a
// per-write delta, so it is EXACT at every write (Yearn-v3 anchors its stored total
// at the single write chokepoint, not by re-summing on read). Reads are therefore
// O(1): `policy.coverage_required` no longer loops `ActiveIds`. The flat
// `MAX_ACTIVE_GUARANTEES` cap is gone — capacity is now enforced by the policy's
// solvency gate (`coverage_required <= stable_assets`), i.e. capital sized to the
// obligation (Nexus Mutual), not an arbitrary count ceiling. `ActiveIds` is retained
// only for enumeration and the admin `reconcile()` drift true-up; it is off every
// hot path.

// ───────────────────────────── H6: storage TTL hygiene ─────────────────────────────
//
// Persistent Guarantee entries are long-lived (a guarantee's coverage span runs
// for period_secs * months_covered). Without an explicit extend_ttl they decay to
// the default min_persistent_entry_ttl and archive — which traps the lifecycle
// reads behind policy.coverage_required / cover_default / pay_fee (an archived
// entry needs a paid RestoreFootprint before it is readable). Archival protection
// is provided by the WRITE paths ONLY: put() sizes the entry's TTL to its own full
// coverage span on every write, and every policy lifecycle mutation re-put()s the
// full struct (sign_guarantee / pay_fee / cover_default / cover_exit / settle_guarantee),
// re-extending the TTL. The fee cadence (~period_secs) is far inside the span TTL,
// so write-path re-extension covers the whole window. A guarantee that misses its
// fee is in DEFAULT (the fee stream is the default oracle), so the admin re-put()s it
// via cover_default/cover_exit (or settle_guarantee) — write paths that re-extend the
// TTL; coverage stays reserved throughout (no time-gate excludes a lapsed guarantee).
// get() does NOT extend (re-audit H2: it is a pure read — a read-path bump cost
// O(active) writes per solvency view).

/// Stellar ledgers close on roughly a 5–6s cadence. Dividing the wall-clock span
/// (seconds) by 5 yields MORE ledgers than a 6s assumption would — i.e. we
/// slightly OVER-cover the intended span in ledgers, which is the safe direction
/// for a TTL (under-covering is the bug). Documented assumption: ~5s/ledger.
const LEDGERS_PER_SECOND_DIV: u64 = 5;

/// Network max TTL (max_entry_ttl). Pinned to the documented testnet/mainnet cap,
/// which is also the soroban-sdk default test-ledger value (asserted by the
/// guarantee_ttl_clamped_to_max test, which proves extend_ttl to this value does
/// not trap). extend_ttl traps if extend_to exceeds the host's max_entry_ttl, so
/// every computed TTL is clamped to this.
pub const MAX_ENTRY_TTL: u32 = 6_312_000;

/// Coverage span (period_secs * months_covered) converted to ledgers and clamped
/// to the network max. Computed in u64 then narrowed once at the end: avoids both
/// the secs-vs-ledgers 5x over-extension and the u32 overflow that a
/// period_secs(u64) * months_covered(u32) product would hit if narrowed early.
pub fn guarantee_ttl_ledgers(period_secs: u64, months_covered: u32) -> u32 {
    let span_secs = period_secs.saturating_mul(months_covered as u64);
    let ledgers = span_secs / LEDGERS_PER_SECOND_DIV;
    ledgers.min(MAX_ENTRY_TTL as u64) as u32
}

#[contracttype]
pub enum DataKey {
    Admin,
    Writer,
    NextId,
    ActiveIds,    // Vec<u32>
    Guarantee(u32),
    // ADDITIVE + LAYOUT-PRESERVING: appended LAST. The contracttype enum encoding
    // is positional, so appending preserves the encoding of every existing key
    // (Admin/Writer/NextId/ActiveIds/Guarantee). Never reorder or remove a variant.
    SchemaVersion,
    // O(1) coverage aggregate (#39). INSTANCE entry, co-located with NextId/ActiveIds
    // so the existing `bump_instance` TTL-extend covers it. Appended AFTER
    // SchemaVersion (positional contracttype encoding is append-only). `put` is its
    // SOLE mutator; `reconcile` overwrites it wholesale on an admin drift true-up.
    RawCoverage, // i128
}

/// Emitted by `upgrade` after the wasm swap is committed. Mirrors the vault's bare
/// `#[contractevent]` idiom (auto snake_case name topic `upgraded`).
#[contractevent]
pub struct Upgraded {
    #[topic]
    pub admin: Address,
    pub version: u32,
    pub wasm_hash: BytesN<32>,
}

#[contract]
pub struct Registry;

#[contractimpl]
impl Registry {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::NextId, &0u32);
        e.storage().instance().set(&DataKey::ActiveIds, &Vec::<u32>::new(e));
        // Default Writer=admin (OZ-Ownable convention): closes the unset-writer
        // trap window between deploy and set_writer. admin is borrowed (&admin),
        // not consumed, so it stays in scope for the SchemaVersion write below.
        e.storage().instance().set(&DataKey::Writer, &admin);
        e.storage().instance().set(&DataKey::SchemaVersion, &CURRENT_SCHEMA_VERSION);
        // Initialize the O(1) coverage aggregate so reads never trap on a fresh
        // deploy (raw_coverage also unwraps_or(0) as belt-and-suspenders).
        e.storage().instance().set(&DataKey::RawCoverage, &0i128);
    }

    pub fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// On-chain storage schema version. `0` for a pre-versioning instance upgraded
    /// in before this binary (the upgrade guard treats that as a mismatch).
    pub fn schema_version(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::SchemaVersion).unwrap_or(0)
    }

    pub fn set_writer(e: Env, writer: Address) {
        Self::admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Writer, &writer);
        Self::bump_instance(&e);
    }

    pub fn writer(e: Env) -> Address {
        // Typed fallback instead of a bare unwrap host trap. Unreachable for a
        // freshly-deployed instance (constructor defaults Writer=admin); converts
        // an old pre-default upgraded-in instance's trap into a stable error.
        e.storage()
            .instance()
            .get(&DataKey::Writer)
            .unwrap_or_else(|| panic_with_error!(&e, RegistryError::WriterNotSet))
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        Self::admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
        Self::bump_instance(&e);
    }

    pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>) {
        Self::admin(&e).require_auth();
        // Refuse an in-place upgrade when the on-chain layout version does not
        // match what this binary expects (stale / layout-incompatible storage).
        // A stale instance (v1, pre-RawCoverage, or pre-versioning v0) reads != 2
        // and is refused — routed through redeploy + bootstrap.sh re-wire instead.
        // This binary IS the migrating binary that bumped the layout 1 -> 2 (the
        // appended RawCoverage instance entry); layout-CHANGING edits never ride
        // upgrade().
        let stored: u32 = e.storage().instance().get(&DataKey::SchemaVersion).unwrap_or(0);
        if stored != CURRENT_SCHEMA_VERSION {
            panic_with_error!(&e, RegistryError::VersionMismatch);
        }
        let admin = Self::admin(&e);
        e.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        Upgraded { admin, version: CURRENT_SCHEMA_VERSION, wasm_hash: new_wasm_hash }.publish(&e);
    }

    fn require_writer(e: &Env) {
        let writer: Address = e
            .storage()
            .instance()
            .get(&DataKey::Writer)
            .unwrap_or_else(|| panic_with_error!(e, RegistryError::WriterNotSet));
        writer.require_auth();
    }

    /// H6: keep the instance entry (Admin/Writer/NextId/ActiveIds — the latter is
    /// iterated by policy.coverage_required) alive. Bumped on every mutating
    /// entrypoint so it never archives.
    fn bump_instance(e: &Env) {
        e.storage()
            .instance()
            .extend_ttl(MAX_ENTRY_TTL / 2, MAX_ENTRY_TTL);
    }

    /// Remaining coverage a guarantee reserves, summed by `raw_coverage`. Two legs:
    /// DEFAULT (rent-arrears) `monthly * (months_covered - months_used)` and EXIT
    /// (property-recovery) `monthly * exit_months - exit_used`. Zero unless the
    /// guarantee is active AND in the issued range (`id < next`) — a settled or
    /// not-yet-issued guarantee reserves nothing. `checked_*` with `.expect()`
    /// converts a wrap into a trap now that the active set is unbounded (no
    /// MAX_ACTIVE_GUARANTEES ceiling caps the running sum); `saturating_sub` on the
    /// month counters mirrors the policy idiom (used never exceeds covered by
    /// invariant, but never underflow the multiplier).
    fn contribution(g: &Guarantee, next: u32) -> i128 {
        if !(g.active && g.id < next) {
            return 0;
        }
        let default_term = g
            .monthly_amount
            .checked_mul(g.months_covered.saturating_sub(g.months_used) as i128)
            .expect("coverage default term overflow");
        let exit_term = g
            .monthly_amount
            .checked_mul(g.exit_months as i128)
            .expect("coverage exit term overflow")
            .checked_sub(g.exit_used)
            .expect("coverage exit term underflow");
        default_term
            .checked_add(exit_term)
            .expect("coverage contribution overflow")
    }

    /// Admin drift true-up: recompute `RawCoverage` once from the active set and
    /// overwrite the stored scalar. The `put` delta keeps the aggregate exact at
    /// every write, but this is the safety valve (and `ActiveIds`' remaining
    /// consumer) should any drift ever creep in.
    pub fn reconcile(e: Env) {
        Self::admin(&e).require_auth();
        Self::bump_instance(&e);
        let next: u32 = e.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        let active: Vec<u32> = e
            .storage()
            .instance()
            .get(&DataKey::ActiveIds)
            .unwrap_or_else(|| Vec::new(&e));
        let mut sum: i128 = 0;
        for id in active.iter() {
            if let Some(g) = e
                .storage()
                .persistent()
                .get::<_, Guarantee>(&DataKey::Guarantee(id))
            {
                sum = sum
                    .checked_add(Self::contribution(&g, next))
                    .expect("reconcile overflow");
            }
        }
        e.storage().instance().set(&DataKey::RawCoverage, &sum);
    }
}

#[contractimpl]
impl RegistryTrait for Registry {
    fn next_id(e: Env, ) -> u32 {
        Registry::require_writer(&e);
        Registry::bump_instance(&e);
        let id: u32 = e.storage().instance().get(&DataKey::NextId).unwrap();
        // checked_add: in wasm release `id + 1` wraps silently at u32::MAX -> 0,
        // colliding the live Guarantee(0) entry. Panic instead (signature stays
        // plain u32, so the RegistryClient trait is unchanged).
        e.storage()
            .instance()
            .set(&DataKey::NextId, &id.checked_add(1).expect("registry id space exhausted"));
        id
    }

    fn put(e: Env, g: Guarantee) {
        Registry::require_writer(&e);
        Registry::bump_instance(&e);
        // Id-trust hardening (CWE-840): the registry derives ids from its own
        // monotonic NextId counter. A writer must never fabricate the primary key,
        // so reject any id at-or-beyond the next-to-issue. `>=` (not `>`) also
        // closes the empty-registry id=0 footgun (NextId==0) while still allowing
        // re-puts of any previously-issued id (pay_fee / cover_default / cover_exit /
        // settle_guarantee all re-put existing ids, all of which are id < NextId).
        let next: u32 = e.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        if g.id >= next {
            panic_with_error!(&e, RegistryError::InvalidId);
        }
        // Read the PRIOR struct BEFORE any overwrite, reusing the already-read
        // `next`. Load-bearing for the RawCoverage delta below: a first put /
        // activation has old=None (contributes 0), and a re-put nets exactly
        // because `old` is captured pre-overwrite.
        let old: Option<Guarantee> = e.storage().persistent().get(&DataKey::Guarantee(g.id));
        let mut active: Vec<u32> = e.storage().instance().get(&DataKey::ActiveIds).unwrap();
        let present = active.iter().any(|x| x == g.id);
        if g.active && !present {
            // Capacity is no longer a count — the policy's solvency gate bounds the
            // book (#40). Only a brand-new id's first activation grows the Vec;
            // re-puts of present active ids and deactivations take the other branches.
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
        // H6: size the entry's TTL to its own coverage span so it survives the
        // full period_secs * months_covered window without a paid restore.
        let ttl = guarantee_ttl_ledgers(g.period_secs, g.months_covered);
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Guarantee(g.id), ttl, ttl);
        // #39: maintain the O(1) RawCoverage aggregate. `put` is its SOLE mutator —
        // every coverage delta (activation, cover_default, cover_exit, settle,
        // exhaust) flows through a re-put, so applying (new − old) contribution here
        // keeps the scalar EXACT at every write. `old` was read pre-overwrite, so a
        // first put nets +new (old_c = 0) and a re-put nets the difference.
        let new_c = Registry::contribution(&g, next);
        let old_c = old.map(|o| Registry::contribution(&o, next)).unwrap_or(0);
        let raw: i128 = e
            .storage()
            .instance()
            .get(&DataKey::RawCoverage)
            .unwrap_or(0);
        let raw = raw
            .checked_add(new_c)
            .expect("raw coverage overflow")
            .checked_sub(old_c)
            .expect("raw coverage underflow");
        e.storage().instance().set(&DataKey::RawCoverage, &raw);
    }

    fn get(e: Env, id: u32) -> Result<Guarantee, RegistryError> {
        // H2 (re-audit): get() is a PURE read — NO extend_ttl. policy.coverage_required
        // loops get over active_ids, so a read-path bump cost O(active) storage WRITES
        // per solvency "view" and turned get / coverage_required / is_current /
        // guarantee into read-WRITEs under SDK/frontend simulate. Archival protection
        // is provided by the WRITE paths only: put() re-extends to the full coverage
        // span on every write, and every policy lifecycle mutation re-put()s the full
        // struct (see the H6 banner above).
        match e.storage().persistent().get::<_, Guarantee>(&DataKey::Guarantee(id)) {
            Some(g) => Ok(g),
            None => Err(RegistryError::GuaranteeNotFound),
        }
    }

    fn active_ids(e: Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveIds).unwrap()
    }

    /// O(1) coverage aggregate (Σ contribution over active guarantees), maintained
    /// incrementally by the `put` delta. PURE read — NO require_auth, NO extend_ttl
    /// (mirrors the H2 re-audit decision that `get` is side-effect-free, so a
    /// solvency "view" never does storage writes). `unwrap_or(0)` is belt-and-
    /// suspenders alongside the constructor init.
    fn raw_coverage(e: Env) -> i128 {
        e.storage().instance().get(&DataKey::RawCoverage).unwrap_or(0)
    }
}

mod test;
