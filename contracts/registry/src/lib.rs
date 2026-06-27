#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};
use interfaces::{Guarantee, Registry as RegistryTrait, RegistryError};

// ───────────────────────────── H6: storage TTL hygiene ─────────────────────────────
//
// Persistent Guarantee entries are long-lived (a guarantee's coverage span runs
// for period_secs * months_covered). Without an explicit extend_ttl they decay to
// the default min_persistent_entry_ttl and archive — which traps the lifecycle
// reads behind policy.coverage_required / cover_default / pay_premium (an archived
// entry needs a paid RestoreFootprint before it is readable). We size the entry's
// TTL to its own coverage span on every write AND on the lifecycle read so a
// guarantee touched by the premium/default cadence never archives mid-coverage.

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

    pub fn set_writer(e: Env, writer: Address) {
        Self::admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Writer, &writer);
        Self::bump_instance(&e);
    }

    pub fn writer(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Writer).unwrap()
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        Self::admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
        Self::bump_instance(&e);
    }

    pub fn upgrade(e: Env, new_wasm_hash: BytesN<32>) {
        Self::admin(&e).require_auth();
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    fn require_writer(e: &Env) {
        let writer: Address = e.storage().instance().get(&DataKey::Writer).unwrap();
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
        // H6: size the entry's TTL to its own coverage span so it survives the
        // full period_secs * months_covered window without a paid restore.
        let ttl = guarantee_ttl_ledgers(g.period_secs, g.months_covered);
        e.storage()
            .persistent()
            .extend_ttl(&DataKey::Guarantee(g.id), ttl, ttl);
    }

    fn get(e: Env, id: u32) -> Result<Guarantee, RegistryError> {
        // H6: the lifecycle read path (behind policy.coverage_required /
        // cover_default / pay_premium / is_current). Re-extend on the Some branch,
        // sized off the loaded guarantee's own span, so a guarantee whose coverage
        // outruns one window stays live each time a premium/default touches it.
        // Extend ONLY on Some: a missing id stays a cheap typed error and is never
        // materialized into a write. (Side effect: this turns get — and the
        // policy view methods behind it — into a read-WRITE in simulation; flagged
        // to the SDK/frontend team.)
        match e.storage().persistent().get::<_, Guarantee>(&DataKey::Guarantee(id)) {
            Some(g) => {
                let ttl = guarantee_ttl_ledgers(g.period_secs, g.months_covered);
                e.storage()
                    .persistent()
                    .extend_ttl(&DataKey::Guarantee(id), ttl, ttl);
                Ok(g)
            }
            None => Err(RegistryError::GuaranteeNotFound),
        }
    }

    fn active_ids(e: Env) -> Vec<u32> {
        e.storage().instance().get(&DataKey::ActiveIds).unwrap()
    }
}

mod test;
