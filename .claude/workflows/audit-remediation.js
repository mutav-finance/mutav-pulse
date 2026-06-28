export const meta = {
  name: 'audit-remediation',
  description: 'Professional Soroban remediation of the protocol-audit findings, grouped. Per group: deep research → plan → adversarial evaluate (implement-now vs defer) → sequential TDD implementation with cargo test + stellar build gates, committing per group. Defers trait/API-changing and layout-breaking fixes for human sign-off. Ends with a full verification + report.',
  phases: [
    { title: 'Research' },
    { title: 'Plan' },
    { title: 'Evaluate' },
    { title: 'Implement' },
    { title: 'Verify' },
  ],
}

const REPO = '/Users/jubs/Projects/tga-protocol/mutav-pulse'
// Base ref the verify phase diffs against. Pass a ref via `args` (commit/branch);
// defaults to `main`. (The original run used the buffer-fix merge commit.)
const BASE = (typeof args === 'string' && args.trim()) ? args.trim() : 'main'

const STD = `References to conform to (cite per fix): ERC-4626 (rounding favors vault; virtual-offset; preview parity; total_assets), ERC-7540 (async request->claim), Yearn-v3 (total-anchored idle, target-to-balance bidirectional rebalance, max_debt), Centrifuge (reserve band/epoch), Nexus (coverage-anchored solvency), DeFindex (idle-first). Soroban best practice: require_auth on every state-mutating method; re-entrancy (the invariant: policy reduces coverage BEFORE vault.disburse, vault never calls policy.coverage_required during disburse); i128 overflow via the audited mul_div_with_rounding widening (stellar_contract_utils) / checked_mul; storage TTL via extend_ttl for long-lived persistent entries; additive DataKey changes to preserve upgrade() layout.`

const RULES = `HARD RULES for any fix: (1) Prefer ADDITIVE, layout-preserving changes (new DataKey variants, new setters) so the contract can ship as in-place upgrade(). (2) Do NOT change a trait signature in contracts/interfaces unless the group is explicitly the solvency-disburse group. (3) Behavior-preserving except for the specific defect being fixed. (4) Every contract change needs a test; verify with cargo test (workspace) AND stellar contract build before committing. NOTE: this branch (fix/audit-remediation off main) does NOT contain mock-tesouro (it lives on the reserve branch) — do not reference it.`

const RESEARCH_SCHEMA = { type: 'object', additionalProperties: false, required: ['group', 'approach', 'reference', 'soroban_notes', 'risks'], properties: {
  group: { type: 'string' }, approach: { type: 'string' }, reference: { type: 'string' }, soroban_notes: { type: 'string' }, risks: { type: 'string' } } }

const PLAN_SCHEMA = { type: 'object', additionalProperties: false, required: ['group', 'changes', 'tests', 'storage_layout_impact', 'deploy_impact', 'trait_change', 'risk'], properties: {
  group: { type: 'string' },
  changes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'method', 'change'], properties: { file: { type: 'string' }, method: { type: 'string' }, change: { type: 'string' } } } },
  tests: { type: 'array', items: { type: 'string' } },
  storage_layout_impact: { type: 'string' },
  deploy_impact: { type: 'string' },
  trait_change: { type: 'boolean' },
  risk: { type: 'string', enum: ['low', 'medium', 'high'] } } }

const EVAL_SCHEMA = { type: 'object', additionalProperties: false, required: ['group', 'decision', 'confidence', 'blocking_issues', 'refinements', 'reason'], properties: {
  group: { type: 'string' },
  decision: { type: 'string', enum: ['implement', 'defer'] },
  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  blocking_issues: { type: 'string' },
  refinements: { type: 'string' },
  reason: { type: 'string' } } }

// Groups reflect the SECOND audit (post-remediation, 2026-06-27). The first
// audit's groups (adapter-auth, arithmetic, ttl-archival, deposit-slippage,
// ensure-liquidity, policy-events, registry-hardening, quality-reuse) are MERGED
// to main and intentionally removed. Re-run `protocol-audit` and refresh these
// before re-running this workflow against a different state.
const GROUPS = [
  { id: 'disburse-reentrancy', title: 'disburse re-entrancy guard (re-audit H1)', files: 'contracts/vault/src/lib.rs', detail: 'H1: rebalance + process_redemptions set/assert DataKey::Locked before adapter callouts, but disburse (→ ensure_liquidity → strategy.divest → token.transfer) is UNguarded — the money-out path. A malicious/buggy adapter reached via ensure_liquidity sees Locked==false and can re-enter. Fix: wrap disburse in the same Locked set/assert/clear; ideally fold all three adapter-callout paths under one mutual-exclusion guard. Also assess collect_premium. Additive, low-risk. Add a test that a re-entrant call traps.' },
  { id: 'registry-get-pure', title: 'registry::get() must be pure — TTL on write paths only (re-audit H2)', files: 'contracts/registry/src/lib.rs', detail: 'REGRESSION introduced by the prior TTL fix: get() calls extend_ttl on every read, so policy::coverage_required (loops get over active_ids) does O(active) STORAGE WRITES per solvency "view" — and any SDK/frontend treating get/coverage_required as side-effect-free mutates storage on simulate/submit. Fix: make get() pure (no extend_ttl); move guarantee TTL extension to the write paths (put / pay_premium / cover_default already re-put), or a writer-gated touch(id). Keep get()-archival protection via the write-path bumps. Update the tests added by the original ttl group accordingly.' },
  { id: 'coverage-aggregate', title: 'O(1) coverage_required — running aggregate / bound active set (re-audit H3)', files: 'contracts/registry/src/lib.rs, contracts/policy/src/lib.rs', detail: 'H3: ActiveIds is an unbounded Vec<u32> in one instance entry; coverage_required iterates it with a per-id cross-contract get(), so cost grows linearly and can exceed the tx budget → bricks pay_premium. Fix (preferred): maintain a running coverage aggregate in instance storage, updated incrementally on put/cover_default/settle, making coverage_required O(1); OR cap/shard the active set. Behavior-sensitive (solvency figure) — be conservative, test the aggregate matches the summed value. Medium risk.' },
  { id: 'disburse-trait-docs', title: 'Document the disburse auth/ordering invariant at the trait boundary (re-audit H4)', files: 'contracts/interfaces/src/lib.rs', detail: 'H4: Vault::disburse is the method the solvency model turns on, but the trait declares a bare fn with no doc of (a) policy-only require_auth, (b) caller-must-reduce-coverage-first ordering, (c) no reading coverage_required during disburse. Fix: add a thorough doc-comment encoding the contract. Doc-only, zero runtime risk. Relates to issue #38.' },
  { id: 'solvency-disburse', title: 'Structural solvency on disburse (issue #38) — expected DEFER (trait change)', files: 'contracts/interfaces/src/lib.rs, contracts/vault/src/lib.rs, contracts/policy/src/lib.rs', detail: 'The structural version of H4/H3-old: pass the post-payout coverage figure from policy into disburse and assert stable_pre-amount>=figure (avoids re-entrant coverage_required). CHANGES the Vault::disburse trait signature in interfaces across 3 contracts → coordinated redeploy. Expect DEFER for human sign-off; ship as a plan. Tracked in #38.' },
]

function researchPrompt(g) {
  return `Read-only deep research for a Soroban audit fix. Repo: ${REPO}. ${STD}

GROUP: ${g.title}. Findings/target: ${g.detail}. Files in scope: ${g.files}. Read those files in full plus any sibling they depend on (interfaces, types, the strategy trait, stellar_contract_utils math usage already in vault).

Research the BEST-PRACTICE Soroban fix for this defect class: how audited Soroban/Stellar contracts and the relevant reference standard handle it, the exact mechanism (auth pattern, the mul_div_with_rounding widening API as already used in vault to_shares/to_assets, extend_ttl sizing, contractevent, etc.), and the pitfalls. Return {group, approach (the recommended mechanism), reference (which standard/best-practice and why), soroban_notes (API specifics: exact functions/macros, storage semantics), risks}.`
}
function planPrompt(g, research) {
  return `Read-only planning for a Soroban audit fix. Repo: ${REPO}. ${STD}\n${RULES}\n\nGROUP: ${g.title}. Target: ${g.detail}. Files: ${g.files}.\nResearch from the prior step: ${JSON.stringify(research)}\n\nProduce a CONCRETE implementation plan: the exact per-file/per-method changes, the TDD tests to add (name + what they assert, red-first where possible), the storage-layout impact (additive? layout-preserving?), the deploy impact (in-place upgrade vs redeploy/re-wire), whether it requires a trait-signature change in interfaces (trait_change true/false), and an overall risk rating. Be specific enough to implement directly. Return the PLAN object.`
}
function evalPrompt(g, plan) {
  return `Adversarial evaluation of a Soroban audit-fix plan (read-only). Repo: ${REPO}. ${STD}\n${RULES}\n\nGROUP: ${g.title}.\nPLAN: ${JSON.stringify(plan)}\n\nCritique it hard: does it FULLY fix the finding? side effects / regressions? re-entrancy + the coverage-before-disburse ordering preserved? storage-layout/upgrade safety? conformance to the cited standard? test adequacy?\n\nDECISION RULE: decision='implement' ONLY if the fix is additive/layout-preserving, needs NO interfaces trait-signature change, and is behavior-preserving except for the defect (low/medium risk with a clear test). decision='defer' if it changes a trait signature, breaks storage layout (needs redeploy), or carries high regression risk needing human sign-off — these ship as a plan, not auto-code. Return the EVAL object with decision, confidence, blocking_issues, refinements (concrete tweaks for the implementer), and reason.`
}
function implementPrompt(g, plan, evalr) {
  return `Implement ONE Soroban audit fix, TDD. Repo: ${REPO}, branch fix/audit-remediation (you share the working tree with prior groups — only touch THIS group's files). ${STD}\n${RULES}\n\nGROUP: ${g.title}. Target: ${g.detail}.\nAPPROVED PLAN: ${JSON.stringify(plan)}\nEVALUATOR REFINEMENTS (apply these): ${evalr.refinements}\n\nSteps: (1) write the test(s) first (red where feasible); (2) implement the fix per plan+refinements; (3) run \`cargo test\` (workspace) and \`stellar contract build\` — BOTH must pass; (4) if green, \`git add\` only this group's files and commit with a clear conventional-commit message + the Co-Authored-By line for Claude; do NOT push. CRITICAL: if cargo test or the build fails and you cannot fix it cleanly within scope, \`git checkout -- <your files>\` to REVERT (leave the tree green for the next group) and report status:FAILED with the error — never commit a broken tree. Return a short report: files changed, tests added, cargo/build result, commit hash (or FAILED + reason).`
}

phase('Research')
const evaluated = (await pipeline(
  GROUPS,
  (g) => agent(researchPrompt(g), { schema: RESEARCH_SCHEMA, phase: 'Research', label: `research:${g.id}` }),
  (research, g) => agent(planPrompt(g, research), { schema: PLAN_SCHEMA, phase: 'Plan', label: `plan:${g.id}` }),
  (plan, g) => agent(evalPrompt(g, plan), { schema: EVAL_SCHEMA, phase: 'Evaluate', label: `eval:${g.id}` })
    .then((ev) => ({ group: g, plan, ev })),
)).filter(Boolean)

const ORDER = ['disburse-reentrancy', 'registry-get-pure', 'coverage-aggregate', 'disburse-trait-docs', 'solvency-disburse']
const toImpl = evaluated.filter((x) => x.ev.decision === 'implement')
  .sort((a, b) => ORDER.indexOf(a.group.id) - ORDER.indexOf(b.group.id))
const deferred = evaluated.filter((x) => x.ev.decision !== 'implement')
log(`Evaluated ${evaluated.length} groups → implementing ${toImpl.length}, deferring ${deferred.length}`)

phase('Implement')
const implResults = []
for (const x of toImpl) {
  const r = await agent(implementPrompt(x.group, x.plan, x.ev), { label: `impl:${x.group.id}`, phase: 'Implement' })
  implResults.push({ group: x.group.id, report: r })
}

phase('Verify')
const verify = await agent(`Read-only final verification. Repo: ${REPO}, branch fix/audit-remediation. Run the full gate and report: (a) cargo test (workspace) — pass/fail + counts; (b) stellar contract build — pass/fail. Then list the commits on this branch since ${BASE} (git log --oneline ${BASE}..HEAD) and the files changed. If any gate FAILS, identify the offending commit/group (do NOT fix — just report). Return the report.`, { label: 'final-verify', phase: 'Verify' })

return {
  implemented: implResults,
  deferred: deferred.map((x) => ({ group: x.group.id, reason: x.ev.reason, blocking: x.ev.blocking_issues, plan: x.plan })),
  evaluations: evaluated.map((x) => ({ group: x.group.id, decision: x.ev.decision, risk: x.plan.risk, trait_change: x.plan.trait_change, confidence: x.ev.confidence })),
  verify,
}