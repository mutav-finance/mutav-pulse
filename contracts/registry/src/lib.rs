#![no_std]
use soroban_sdk::crypto::bn254::Bn254Fr;
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, panic_with_error, vec, Address, Bytes, BytesN, Env, Vec, U256};
use interfaces::{Guarantee, Registry as RegistryTrait, RegistryError};
use soroban_poseidon::poseidon_hash;

/// Fixed depth of the guarantees Merkle tree (the "list seal", piece B of the ZK
/// solvency proof). 2^7 = 128 leaves — sized to hold the full active set
/// (`MAX_ACTIVE_GUARANTEES`, see below) with headroom. The circuit MUST use the
/// SAME depth; growing it requires a coordinated upgrade (registry + circuit/zkey/VK
/// + attestor redeploy), never a silent edit.
/// INCREMENTAL: the tree is persisted node-by-node (heap-indexed) and every write
/// updates only the path from the changed leaf to the root — O(TREE_DEPTH) Poseidon
/// hashes per `put`, independent of the active-set size. (A full O(n) recompute blew
/// the per-tx budget at ~28 active guarantees; this keeps a single `put` bounded so
/// the full `MAX_ACTIVE_GUARANTEES` set is reachable.) The active set is kept
/// LEFT-PACKED (positions 0..n) with swap-remove on deactivation, so the root stays
/// byte-identical to the circuit's perfect-tree fold over [leaves.., zero-padding].
const TREE_DEPTH: u32 = 7;

/// Number of leaves = 2^TREE_DEPTH. The fixed capacity of the guarantees tree.
const N_LEAVES: u32 = 1u32 << TREE_DEPTH;

/// Schema version of this contract's storage layout. Bumped only by a migrating
/// binary that changes the on-chain layout; an in-place `upgrade()` is refused
/// (VersionMismatch) when the stored version differs from this, so a stale-layout
/// instance is routed through redeploy + `bootstrap.sh` re-wire instead.
pub const CURRENT_SCHEMA_VERSION: u32 = 1;

// ───────────────────── H3: bound the active set (coverage_required cost) ─────────────────────
//
// `ActiveIds` is a `Vec<u32>` in the single instance entry, and
// `policy.coverage_required` iterates it with one cross-contract `get()` per id, so
// the loop's cost grows linearly with the number of ACTIVE guarantees. Left
// unbounded it can exceed the tx resource budget and brick `pay_premium` (which
// re-checks solvency via coverage_required). This is a MITIGATION, not a true O(1)
// fix: an exact-equivalent O(1) scalar is provably impossible because
// coverage_required's `paid_until > now` predicate flips with the passage of time
// alone (no state-mutating call to hook an increment onto), and a policy-instance
// aggregate would violate the stateless-policy-swap invariant the system test
// encodes. Instead we bound N at its source — the active set — so the loop's
// worst-case cost is a known constant. Centrifuge's epoch/timer is the only
// mechanism that could make exact-parity coverage genuinely O(1); out of scope for
// this prototype.
//
/// Hard cap on the number of CURRENTLY-ACTIVE guarantees. Sized so
/// `coverage_required`'s loop of N cross-contract `get()`s stays inside ONE
/// transaction's resource limits. The binding constraint is the per-tx LEDGER
/// FOOTPRINT (entries touched), not CPU/mem: each iteration reads one persistent
/// `Guarantee(id)` entry, plus the loop reads the registry instance entry
/// (active_ids) and the policy instance entry. The testnet/mainnet per-tx footprint
/// cap is ~100 read entries; 90 active guarantees + the handful of framing entries
/// leaves headroom under that ceiling, which the
/// `coverage_required_at_active_cap_stays_within_budget` system test exercises at
/// EXACTLY this cap (a measured bound, not an asserted one — an earlier 200 was
/// rejected by the host's invocation metering at `total footprint entries > 100`).
/// Enforced only on the put branch that PUSHES a brand-new active id
/// (sign_guarantee's first activating put); re-puts of existing active ids and
/// deactivations never grow the set, so pay_premium / cover_default /
/// settle_guarantee are never blocked. Counts only active entries — settle/cover
/// free capacity. RESIDUAL: the cap is enforced only on post-upgrade writes; an
/// instance already holding more than this at upgrade time is not retroactively
/// trimmed, and once full a brand-new guarantee's first activating put hard-stops
/// with `ActiveSetFull` (issuance pauses until slots free) — admin-gated
/// sign_guarantee is the compensating control against an issuance-flood DoS.
pub const MAX_ACTIVE_GUARANTEES: u32 = 90;

// The active-set cap MUST stay within the Merkle tree's fixed capacity (N_LEAVES).
// If it did not, a put past N_LEAVES would silently drop guarantees from both the
// root AND the obligations sum → false solvency by omission. With the cap (90) <=
// capacity (128) the `ActiveSetFull` guard in `put` trips first, so the tree can
// never overflow. This compile-time assert keeps the two numbers in lockstep.
const _: () = assert!(MAX_ACTIVE_GUARANTEES <= N_LEAVES);

// ───────────────────────────── H6: storage TTL hygiene ─────────────────────────────
//
// Persistent Guarantee entries are long-lived (a guarantee's coverage span runs
// for period_secs * months_covered). Without an explicit extend_ttl they decay to
// the default min_persistent_entry_ttl and archive — which traps the lifecycle
// reads behind policy.coverage_required / cover_default / pay_premium (an archived
// entry needs a paid RestoreFootprint before it is readable). Archival protection
// is provided by the WRITE paths ONLY: put() sizes the entry's TTL to its own full
// coverage span on every write, and every policy lifecycle mutation re-put()s the
// full struct (sign_guarantee / pay_premium / cover_default / settle_guarantee),
// re-extending the TTL. The premium cadence (~period_secs) is far inside the span
// TTL, so write-path re-extension covers the whole window; a guarantee that goes a
// whole span with zero premiums has already lapsed (paid_until <= now → excluded by
// coverage_required) so its archival is harmless. get() does NOT extend (re-audit
// H2: it is a pure read — a read-path bump cost O(active) writes per solvency view).

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
    // ZK piece B — the incremental Poseidon-Merkle tree of active guarantees.
    Node(u32), // heap-indexed tree node (1..2*N_LEAVES); leaves at N_LEAVES..2*N_LEAVES, root at 1
    Zero(u32), // ZERO[height] — empty-subtree hash at each height (0..=TREE_DEPTH)
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
        // Precompute the empty-subtree hashes ZERO[0..=TREE_DEPTH] so path updates can
        // resolve an unwritten (all-empty) sibling in O(1) without re-hashing zeros.
        Self::init_zeros(e);
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
        // A pre-versioning instance reads 0 (!= 1) and is refused — routed through
        // redeploy + bootstrap.sh re-wire instead. The version stays 1 until a
        // migrating binary bumps it; layout-CHANGING edits never ride upgrade().
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

    // --- Piece B: incremental Poseidon-Merkle accumulator (the "list seal") ---
    //
    // A perfect binary tree of N_LEAVES leaves, heap-indexed: node 1 is the root,
    // node k has children 2k and 2k+1, and leaf slot i lives at node N_LEAVES + i.
    // Active guarantees occupy leaf slots [0, n) LEFT-PACKED (slot = position in
    // `active_ids`); empty slots read as ZERO. Each mutation rewrites the single
    // changed leaf and re-hashes only its O(TREE_DEPTH) ancestors. Nodes live in
    // PERSISTENT storage one entry each, so a path update touches ~2*TREE_DEPTH
    // entries (well under the per-tx footprint cap) instead of serializing the tree.

    /// 2-input Poseidon (t=3) — matches the circomlib hash used in the circuit.
    fn hash2(e: &Env, a: U256, b: U256) -> U256 {
        poseidon_hash::<3, Bn254Fr>(e, &vec![e, a, b])
    }

    /// Leaf of an active guarantee = Poseidon(id, obligation).
    /// `obligation = monthly_amount * (months_covered - months_used)` — same computation as
    /// `coverage_required`. (Conscious simplification: does not filter `paid_until > now`;
    /// counts all active ones, making the proven obligation an upper bound = safe side.)
    ///
    /// The writer (`policy`) guarantees `months_used <= months_covered` and `monthly_amount > 0`
    /// for active guarantees. We still use saturating arithmetic: if malformed data slips through,
    /// the leaf contributes obligation 0 instead of panicking and locking up `put()` (the root is
    /// wrong, but the write does not break). For valid data the value is identical.
    fn leaf(e: &Env, g: &Guarantee) -> U256 {
        let remaining = g.months_covered.saturating_sub(g.months_used) as i128;
        let obligation = g.monthly_amount.saturating_mul(remaining).max(0);
        Self::hash2(e, U256::from_u32(e, g.id), U256::from_u128(e, obligation as u128))
    }

    fn u256_to_bytesn(e: &Env, v: &U256) -> BytesN<32> {
        let b: Bytes = v.to_be_bytes();
        let mut arr = [0u8; 32];
        let mut i = 0u32;
        while i < 32 {
            arr[i as usize] = b.get(i).unwrap();
            i += 1;
        }
        BytesN::from_array(e, &arr)
    }

    /// Precompute ZERO[0..=TREE_DEPTH]: the hash of a fully-empty subtree at each
    /// height. ZERO[0] = 0 (empty leaf); ZERO[h] = Poseidon(ZERO[h-1], ZERO[h-1]).
    fn init_zeros(e: &Env) {
        let mut z = U256::from_u32(e, 0);
        e.storage().persistent().set(&DataKey::Zero(0), &z);
        let mut h = 1u32;
        while h <= TREE_DEPTH {
            z = Self::hash2(e, z.clone(), z.clone());
            e.storage().persistent().set(&DataKey::Zero(h), &z);
            h += 1;
        }
    }

    fn zero_at(e: &Env, height: u32) -> U256 {
        e.storage().persistent().get(&DataKey::Zero(height)).unwrap()
    }

    /// Height of a heap node above the leaves: leaves (k in [N, 2N)) have height 0,
    /// the root (k == 1) has height TREE_DEPTH. height = TREE_DEPTH - floor(log2(k)).
    fn height(k: u32) -> u32 {
        TREE_DEPTH - (31 - k.leading_zeros())
    }

    /// Read a node value, falling back to the empty-subtree hash for nodes that have
    /// never been written (the all-empty right region of a left-packed tree).
    fn read_node(e: &Env, k: u32) -> U256 {
        match e.storage().persistent().get::<_, U256>(&DataKey::Node(k)) {
            Some(v) => v,
            None => Self::zero_at(e, Self::height(k)),
        }
    }

    fn write_node(e: &Env, k: u32, v: &U256) {
        e.storage().persistent().set(&DataKey::Node(k), v);
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Node(k), MAX_ENTRY_TTL / 2, MAX_ENTRY_TTL);
    }

    /// Set leaf slot `i` to `val` and re-hash its ancestors up to the root.
    /// O(TREE_DEPTH) hashes + storage touches — independent of the active-set size.
    fn set_leaf(e: &Env, i: u32, val: U256) {
        let mut k = N_LEAVES + i;
        Self::write_node(e, k, &val);
        k >>= 1;
        while k >= 1 {
            let parent = Self::hash2(e, Self::read_node(e, 2 * k), Self::read_node(e, 2 * k + 1));
            Self::write_node(e, k, &parent);
            k >>= 1;
        }
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
        // re-puts of any previously-issued id (pay_premium / cover_default /
        // settle_guarantee all re-put existing ids, all of which are id < NextId).
        let next: u32 = e.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        if g.id >= next {
            panic_with_error!(&e, RegistryError::InvalidId);
        }
        let mut active: Vec<u32> = e.storage().instance().get(&DataKey::ActiveIds).unwrap();
        // Position of g.id in the left-packed active set (= its leaf slot), if present.
        let mut pos: Option<u32> = None;
        {
            let mut idx = 0u32;
            for x in active.iter() {
                if x == g.id {
                    pos = Some(idx);
                    break;
                }
                idx += 1;
            }
        }

        // H6: persist the guarantee FIRST (sized TTL to its coverage span), so the
        // incremental re-seal below — which may read a swapped neighbour's data —
        // sees committed state.
        e.storage().persistent().set(&DataKey::Guarantee(g.id), &g);
        let ttl = guarantee_ttl_ledgers(g.period_secs, g.months_covered);
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Guarantee(g.id), ttl, ttl);

        // Re-seal the Poseidon-Merkle tree incrementally (O(TREE_DEPTH) per write).
        // The attestor reads the resulting root live to bind the ZK proof to the
        // on-chain active set. The active set stays LEFT-PACKED so the root matches
        // the circuit's perfect-tree fold.
        match (g.active, pos) {
            // Activate a brand-new id: append at the next free leaf slot.
            (true, None) => {
                // H3: bound the active set at its source — also the tree's fixed
                // capacity (MAX_ACTIVE_GUARANTEES <= N_LEAVES, asserted at compile time).
                // Only a first activation grows the set, so the cap is enforced HERE.
                if active.len() >= MAX_ACTIVE_GUARANTEES {
                    panic_with_error!(&e, RegistryError::ActiveSetFull);
                }
                let slot = active.len();
                Registry::set_leaf(&e, slot, Registry::leaf(&e, &g));
                active.push_back(g.id);
            }
            // Re-put an already-active id (premium / partial cover changed its
            // obligation): same slot, refresh the leaf only.
            (true, Some(p)) => {
                Registry::set_leaf(&e, p, Registry::leaf(&e, &g));
            }
            // Deactivate: swap-remove to keep the set left-packed (move the tail id
            // into the vacated slot), then clear the now-unused tail slot. At most two
            // leaf paths updated, each O(TREE_DEPTH).
            (false, Some(p)) => {
                let last = active.len() - 1;
                if p != last {
                    let moved_id = active.get(last).unwrap();
                    let moved: Guarantee =
                        e.storage().persistent().get(&DataKey::Guarantee(moved_id)).unwrap();
                    active.set(p, moved_id);
                    Registry::set_leaf(&e, p, Registry::leaf(&e, &moved));
                }
                active.pop_back();
                Registry::set_leaf(&e, last, U256::from_u32(&e, 0));
            }
            // Inactive and not present: no active-set / tree change.
            (false, None) => {}
        }
        e.storage().instance().set(&DataKey::ActiveIds, &active);
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

    fn guarantees_root(e: Env) -> BytesN<32> {
        // Root = heap node 1, maintained incrementally by `put`. An empty tree has
        // never written node 1, so `read_node` falls back to ZERO[TREE_DEPTH].
        Registry::u256_to_bytesn(&e, &Registry::read_node(&e, 1))
    }
}

mod test;
