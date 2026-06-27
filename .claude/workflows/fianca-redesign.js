export const meta = {
  name: 'fianca-redesign',
  description: 'Implement the approved fiança solvency & coverage redesign (issues #38/#39/#40) at audit depth. Per work-group: deep research → concrete plan → adversarial evaluate (sound-vs-unsound against the approved spec). Then synthesize one compile-safe ordered implementation, 3-lens adversarial review of it, sequential TDD implementation with cargo test + stellar contract build gates committing per checkpoint (revert-on-failure), and a final full verification + spec-conformance audit + simulation self-test.',
  phases: [
    { title: 'Research' },
    { title: 'Plan' },
    { title: 'Evaluate' },
    { title: 'Synthesize' },
    { title: 'Implement' },
    { title: 'Verify' },
  ],
}

const REPO = '/Users/jubs/Projects/tga-protocol/mutav-pulse'
const SPEC = 'docs/superpowers/specs/2026-06-27-fianca-solvency-coverage-redesign-design.md'
// Ref the verify phase diffs against. Pass via `args` (commit/branch); default main.
const BASE = (typeof args === 'string' && args.trim()) ? args.trim() : 'main'

const STD = `THE APPROVED SPEC is the source of truth: read ${REPO}/${SPEC} IN FULL first and conform to it exactly. Reference standards to cite where relevant: ERC-4626 (rounding favors vault; virtual-offset; total_assets), ERC-7540 (async request→claim redemption), Yearn-v3 (total-anchored idle, max_debt), Nexus Mutual (coverage-anchored solvency / capital sized to obligation), DeFindex (idle-first). Soroban best practice: require_auth on every state-mutating method; the re-entrancy invariant (vault must NEVER call policy.coverage_required during disburse — the redesign satisfies this by having policy pass a coverage_after WITNESS into disburse, which the vault asserts against a value it already holds); i128 overflow via the audited mul_div_with_rounding widening (stellar_contract_utils) / checked_mul; storage TTL via extend_ttl for long-lived persistent entries.`

const MODEL = `THE REDESIGN (per the approved spec): (1) The fee stream IS the default oracle — tenant pays the monthly FEE; fee-missed-past-grace = default = the guarantee pays in. This REMOVES the paid_until>now time-gate from the solvency floor (lapse triggers the claim, it does not release coverage). (2) coverage_required becomes O(1): the registry maintains a running raw-coverage aggregate, updated incrementally inside put() by a delta — contribution(g) = active ? monthly*(months_covered-months_used) + (monthly*exit_months - exit_used) : 0. Two coverage legs: DEFAULT (months_covered=3, drawn via cover_default, 1 month/call) and EXIT (exit_months=6, drawn via the NEW cover_exit up to the monthly*exit_months cap). c=1.0, max obligation 9x rent. (3) Structural solvency: interfaces Vault::disburse gains coverage_after:i128; vault asserts stable_pre-amount >= coverage_after (plus the existing overdraft guard); policy passes coverage_after = coverage_required() recomputed AFTER decrementing. (4) Capacity = solvency only: gate issuance in sign_guarantee on coverage_required <= stable_assets; DELETE MAX_ACTIVE_GUARANTEES / ActiveSetFull. (5) Grace period: policy grace_secs (admin-settable); default condition = paid_until+grace<now. (6) Naming: insurance->fiança (pay_premium->pay_fee, collect_premium->collect_fee, premium_of->fee_of, monthly_premium->monthly_fee, PremiumIncome->FeeIncome, event PremiumPaid->FeePaid; fee_bps, cover_default, disburse, coverage_required stay).`

const RULES = `HARD RULES: (1) Conform to the approved spec EXACTLY — do not re-litigate decisions already made (floor stays default-3 + exit-6, c=1.0; cover_default/cover_exit stay admin-gated; 30x LMI and per-agency billing are explicitly OUT OF SCOPE / deferred). (2) Trait-signature changes in contracts/interfaces and storage-layout changes ARE EXPECTED AND APPROVED here (this is NOT an in-place upgrade — it is a redeploy + re-wire via bootstrap.sh); the evaluate gate is about CORRECTNESS, not about avoiding trait/layout changes. (3) Every contract change needs a test; the aggregate needs a property test (raw_coverage == Σ contribution across randomized issue/pay/default/exit/settle sequences); verify with cargo test (workspace) AND stellar contract build before any commit. (4) Tests use e.mock_all_auths_allowing_non_root_auth(). (5) Keep the redemption-queue surplus gate (free_capital) and NAV/virtual-offset math behavior-identical — they only benefit from the now-O(1) coverage_required. (6) Branch: feat/fianca-solvency-redesign (already holds the spec commits); commit per checkpoint with conventional-commit + the Co-Authored-By line for Claude; do NOT push.`

const RESEARCH_SCHEMA = { type: 'object', additionalProperties: false, required: ['group', 'approach', 'reference', 'soroban_notes', 'risks'], properties: {
  group: { type: 'string' }, approach: { type: 'string' }, reference: { type: 'string' }, soroban_notes: { type: 'string' }, risks: { type: 'string' } } }

const PLAN_SCHEMA = { type: 'object', additionalProperties: false, required: ['group', 'changes', 'tests', 'layout_impact', 'depends_on', 'risk'], properties: {
  group: { type: 'string' },
  changes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'method', 'change'], properties: { file: { type: 'string' }, method: { type: 'string' }, change: { type: 'string' } } } },
  tests: { type: 'array', items: { type: 'string' } },
  layout_impact: { type: 'string' },
  depends_on: { type: 'array', items: { type: 'string' } },
  risk: { type: 'string', enum: ['low', 'medium', 'high'] } } }

const EVAL_SCHEMA = { type: 'object', additionalProperties: false, required: ['group', 'decision', 'confidence', 'blocking_issues', 'refinements', 'reason'], properties: {
  group: { type: 'string' },
  decision: { type: 'string', enum: ['implement', 'defer'] },
  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  blocking_issues: { type: 'string' },
  refinements: { type: 'string' },
  reason: { type: 'string' } } }

const SYNTH_SCHEMA = { type: 'object', additionalProperties: false, required: ['steps', 'rationale'], properties: {
  rationale: { type: 'string' },
  steps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'title', 'files', 'instructions', 'tests', 'gate', 'compiles_after'], properties: {
    id: { type: 'string' }, title: { type: 'string' }, files: { type: 'string' }, instructions: { type: 'string' },
    tests: { type: 'array', items: { type: 'string' } },
    gate: { type: 'boolean' },        // run cargo test + stellar build + commit after this step
    compiles_after: { type: 'boolean' } } } } } }

const LENS_SCHEMA = { type: 'object', additionalProperties: false, required: ['lens', 'verdict', 'findings'], properties: {
  lens: { type: 'string' }, verdict: { type: 'string', enum: ['sound', 'blocking'] }, findings: { type: 'string' } } }

// Work-groups for research/plan/evaluate. They are interdependent (a coordinated
// ABI+layout change) — the Synthesize phase serializes the approved plans into a
// compile-safe ordering before any code is written.
const GROUPS = [
  { id: 'registry-aggregate', files: 'contracts/registry/src/lib.rs, contracts/interfaces/src/lib.rs', detail: 'Maintain DataKey::RawCoverage(i128) updated incrementally inside put() by the delta raw += contribution(new) - contribution(old), where contribution sums the default leg monthly*(months_covered-months_used) and the exit leg monthly*exit_months-exit_used for active guarantees (0 otherwise; old contribution 0 on first put). DELETE MAX_ACTIVE_GUARANTEES, the activation-branch cap check, and RegistryError::ActiveSetFull. Add raw_coverage() getter and an admin reconcile() that recomputes the sum once and corrects drift. Add Registry::raw_coverage() to the interfaces trait. The aggregate lives in the registry (data layer) so it survives policy swaps. PROPERTY TEST is the core deliverable.' },
  { id: 'guarantee-struct', files: 'contracts/interfaces/src/lib.rs', detail: 'Guarantee gains exit_months:u32 (exit coverage as a multiple of monthly rent, pilot=6) and exit_used:i128 (exit drawn so far, starts 0). months_covered is now the DEFAULT (rent-arrears) leg (pilot=3). Keep the struct minimal. This is a storage-layout change across registry/policy → redeploy (approved).' },
  { id: 'interfaces-disburse', files: 'contracts/interfaces/src/lib.rs', detail: 'Vault::disburse gains coverage_after:i128. Rewrite the 40-line drift-guard doc to describe the WITNESS invariant (policy passes the post-decrement coverage figure; vault asserts stable_pre-amount>=coverage_after without re-entering policy) instead of the old call-ordering convention. Rename Vault::collect_premium -> collect_fee.' },
  { id: 'policy-coverage-capacity', files: 'contracts/policy/src/lib.rs, contracts/interfaces/src/lib.rs', detail: 'coverage_required reads registry.raw_coverage() and applies the ratio via mul_div_with_rounding Ceil (DROP the O(active) loop and the paid_until>now time-gate entirely). Move/extend the solvency assert into sign_guarantee (after the registry write: assert vault.stable_assets() >= coverage_required(); this is the #40 capacity gate). sign_guarantee takes exit_months alongside months_covered.' },
  { id: 'policy-lifecycle', files: 'contracts/policy/src/lib.rs', detail: 'pay_fee (was pay_premium): rename + extend paid_until, calls vault.collect_fee; does NOT touch the aggregate. cover_default: assert default condition paid_until+grace_secs<now (the lapse-flip), months_used++, then vault.disburse(landlord, monthly, coverage_after) with coverage_after recomputed after decrement; caps at months_covered. cover_exit (NEW, admin): assert exit_used+amount <= monthly*exit_months, exit_used+=amount, then vault.disburse(landlord, amount, coverage_after). settle_guarantee: active=false (registry put recomputes the delta, releasing both legs). Add grace_secs (DataKey::GraceSecs, admin setter, sensible default). Fee/event renames (monthly_premium->monthly_fee, premium_of->fee_of, PremiumPaid->FeePaid).' },
  { id: 'vault-solvency', files: 'contracts/vault/src/lib.rs', detail: 'disburse(to, amount, coverage_after): keep the overdraft guard assert(stable_pre>=amount) AND add assert(stable_pre-amount>=coverage_after) — delete the TODO(solvency-oracle). Rename collect_premium->collect_fee and PremiumIncome (+getter) -> FeeIncome. stable_assets, NAV/virtual-offset, ensure_liquidity, and the redemption-queue surplus gate stay behavior-identical (free_capital now reads an O(1) coverage_required).' },
  { id: 'mocks', files: 'contracts/mocks/**', detail: 'Update mock-policy and mock-defindex (and any mock used by vault/policy tests) for the new disburse arity (coverage_after) and the collect_premium->collect_fee rename, so the workspace compiles and existing tests link.' },
  { id: 'simulations', files: 'model/mutav_model.py, model/README.md, docs/whitepaper.md', detail: 'Default coverage N=3 (was 6), exit coverage E=6 (new); capital_locked = c*R*(N+E) = 9R at c=1.0. Add an exit-cost draw to the model: frequency p_exit and mean severity s_exit*(E*R), with the full E*R reserved regardless (hard solvency). Proposed defaults p_exit=1.0, s_exit≈0.15 (confirm in the report). Update the deterministic APY/loss-ratio tables, the Monte Carlo payout stream, and the --selftest assertions; regenerate the numbers in README.md and docs/whitepaper.md. Gate: python3 model/mutav_model.py --selftest passes.' },
]

function researchPrompt(g) {
  return `Read-only deep research for a Soroban contract redesign. Repo: ${REPO}. ${STD}\n\n${MODEL}\n\nGROUP: ${g.id}. Target: ${g.detail}. Files in scope: ${g.files}. Read those files in full plus the siblings they depend on (interfaces, types, the strategy trait, the existing mul_div_with_rounding usage in vault), and the relevant part of the spec.\n\nResearch the BEST-PRACTICE Soroban mechanism for this group: how audited Soroban/Stellar contracts and the cited reference standard handle it, the exact APIs (storage get/set/update for the aggregate, mul_div_with_rounding widening, contractevent, require_auth, the witness pattern for avoiding re-entrancy), and the pitfalls (i128 overflow, the delta staying exact across all mutation paths, the conservative-drift property, redeploy/re-wire). Return {group, approach (recommended mechanism), reference (standard + why), soroban_notes (API specifics), risks}.`
}
function planPrompt(g, research) {
  return `Read-only planning for a Soroban redesign group. Repo: ${REPO}. ${STD}\n${RULES}\n\n${MODEL}\n\nGROUP: ${g.id}. Target: ${g.detail}. Files: ${g.files}.\nResearch: ${JSON.stringify(research)}\n\nProduce a CONCRETE plan: exact per-file/per-method changes, the TDD tests to add (name + what each asserts, red-first where feasible — for registry-aggregate include the property test), the storage-layout impact, which other groups this depends on (depends_on: list of group ids that must land in the same or an earlier checkpoint for the tree to compile/pass — e.g. policy-lifecycle depends_on interfaces-disburse + vault-solvency), and a risk rating. Be specific enough to implement directly. Return the PLAN object.`
}
function evalPrompt(g, plan) {
  return `Adversarial evaluation of a redesign-group plan (read-only). Repo: ${REPO}. ${STD}\n${RULES}\n\n${MODEL}\n\nGROUP: ${g.id}.\nPLAN: ${JSON.stringify(plan)}\n\nCritique it HARD against the approved spec: does it fully and correctly implement this group? Aggregate delta exact across EVERY mutation path (issue/pay/default/exit/settle/exhaust) and conservative on any drift? Re-entrancy invariant preserved (vault never calls coverage_required during disburse; witness assertion correct)? Solvency floor exactly stable_assets>=coverage_required after every money-out path? Lapse-flip correct (fee-miss-past-grace authorizes, current fee blocks)? Naming complete? Tests adequate (esp. the property test)? Conformance to ERC-4626 rounding / Nexus coverage-anchoring where relevant?\n\nDECISION RULE: decision='implement' if the plan is SOUND and spec-conformant (trait/layout changes are fine — they are approved). decision='defer' ONLY if the plan is unsound, contradicts the spec, or carries unacceptable correctness risk that needs human sign-off. Return the EVAL object with decision, confidence, blocking_issues, refinements (concrete tweaks for the implementer), reason.`
}

phase('Research')
const evaluated = (await pipeline(
  GROUPS,
  (g) => agent(researchPrompt(g), { schema: RESEARCH_SCHEMA, phase: 'Research', label: `research:${g.id}` }),
  (research, g) => agent(planPrompt(g, research), { schema: PLAN_SCHEMA, phase: 'Plan', label: `plan:${g.id}` }),
  (plan, g) => agent(evalPrompt(g, plan), { schema: EVAL_SCHEMA, phase: 'Evaluate', label: `eval:${g.id}` })
    .then((ev) => ({ group: g, plan, ev })),
)).filter(Boolean)

const toImpl = evaluated.filter((x) => x.ev.decision === 'implement')
const deferred = evaluated.filter((x) => x.ev.decision !== 'implement')
log(`Evaluated ${evaluated.length} groups → sound ${toImpl.length}, deferred ${deferred.length}`)

// ---- Synthesize one compile-safe ordered implementation from the sound plans ----
phase('Synthesize')
const synthInput = toImpl.map((x) => ({ group: x.group.id, plan: x.plan, refinements: x.ev.refinements }))
let synth = await agent(`Read-only synthesis. Repo: ${REPO}. ${STD}\n${RULES}\n\n${MODEL}\n\nYou have per-group plans + evaluator refinements for an interdependent, coordinated contract change (the ABI + storage layout change is one coherent thing — the workspace will NOT compile until interfaces + registry + policy + vault + mocks are all updated together).\n\nGROUP PLANS: ${JSON.stringify(synthInput)}\n\nProduce an ORDERED list of implementation STEPS that an implementer will execute in sequence sharing one working tree. Each step: {id, title, files, instructions (merge the group plans + refinements relevant to this step), tests, compiles_after (does the workspace compile after this step alone?), gate (run cargo test + stellar contract build + commit after this step — set true ONLY on steps after which the tree compiles)}. Practical shape: bundle the coordinated contract change (interfaces struct+disburse+collect_fee+raw_coverage, registry aggregate+cap-deletion, policy coverage+capacity+lifecycle+cover_exit+grace, vault disburse+renames, mocks) so that the FIRST gated step leaves the whole workspace green (cargo test + stellar build), then the simulations as a SECOND gated step. Keep it minimal — prefer 2-3 gated checkpoints over many non-compiling micro-steps. Return {rationale, steps}.`, { schema: SYNTH_SCHEMA, phase: 'Synthesize', label: 'synthesize-plan' })

// 3-lens adversarial review of the synthesized ordering (confident before we write code)
const lenses = ['correctness + aggregate-exactness', 're-entrancy + solvency-witness invariant', 'storage-layout + redeploy/compile-order safety']
const review = (await parallel(lenses.map((lens) => () =>
  agent(`Adversarially review this synthesized implementation plan through the lens of: ${lens}. Repo: ${REPO}. ${STD}\n${RULES}\n\n${MODEL}\n\nSYNTHESIZED PLAN: ${JSON.stringify(synth)}\n\nIs the ORDERING and step content sound through your lens? Flag anything that would compile-break a gated step, miss a mutation path in the aggregate, violate the re-entrancy/witness invariant, or diverge from the spec. verdict='blocking' only for a real defect. Return {lens, verdict, findings}.`,
    { schema: LENS_SCHEMA, phase: 'Synthesize', label: `review:${lens.split(' ')[0]}` })))).filter(Boolean)
const blockers = review.filter((r) => r.verdict === 'blocking')
if (blockers.length) {
  log(`Synthesis review raised ${blockers.length} blocking finding(s) → one revision pass`)
  synth = await agent(`Revise the synthesized plan to resolve these blocking review findings, keeping it spec-conformant and minimal. PLAN: ${JSON.stringify(synth)}\nBLOCKING FINDINGS: ${JSON.stringify(blockers)}\nReturn the corrected {rationale, steps}.`, { schema: SYNTH_SCHEMA, phase: 'Synthesize', label: 'synthesize-revise' })
}
log(`Synthesized ${synth.steps.length} ordered step(s); ${synth.steps.filter((s) => s.gate).length} gated checkpoint(s)`)

// ---- Implement sequentially; gate (cargo test + stellar build) + commit per gated step ----
phase('Implement')
const implResults = []
let aborted = false
for (const s of synth.steps) {
  if (aborted) { implResults.push({ step: s.id, report: 'SKIPPED (prior step failed its gate)' }); continue }
  const gateInstr = s.gate
    ? `This is a GATED checkpoint. After editing: run \`cargo test\` (workspace) AND \`stellar contract build\` — BOTH must pass. If green, \`git add\` the files changed since the last checkpoint and commit (conventional-commit + the Co-Authored-By line for Claude); do NOT push. If EITHER fails and you cannot fix it cleanly within this step's scope, REVERT every change since the last commit (\`git checkout -- .\` / \`git restore\`) to leave the tree green, and report status:FAILED with the error — never commit or leave a broken tree.`
    : `This is a NON-gated step (the workspace is not expected to compile yet — a later gated step will build/test/commit). Make the edits per the instructions; do NOT run the build or commit. Report the files you changed.`
  const r = await agent(`Implement ONE step of the approved fiança redesign, TDD. Repo: ${REPO}, branch feat/fianca-solvency-redesign (you share the working tree with earlier steps). ${STD}\n${RULES}\n\n${MODEL}\n\nSTEP ${s.id}: ${s.title}\nFILES: ${s.files}\nINSTRUCTIONS: ${s.instructions}\nTESTS TO ADD: ${JSON.stringify(s.tests)}\n\nWrite tests first where feasible (the registry property test is required). ${gateInstr}\n\nReturn a short report: files changed, tests added, cargo/build result (if gated), commit hash or FAILED+reason.`, { label: `impl:${s.id}`, phase: 'Implement' })
  implResults.push({ step: s.id, report: r })
  if (s.gate && typeof r === 'string' && /FAILED/i.test(r)) aborted = true
}

// ---- Verify: full gate + diff + spec-conformance audit + sim self-test ----
phase('Verify')
const gate = await agent(`Read-only final verification. Repo: ${REPO}, branch feat/fianca-solvency-redesign. Run and report: (a) cargo test (workspace) — pass/fail + counts; (b) stellar contract build — pass/fail; (c) python3 model/mutav_model.py --selftest — pass/fail; (d) git log --oneline ${BASE}..HEAD and the files changed. If any gate FAILS, identify the offending step/commit (do NOT fix — report). Return the report.`, { label: 'final-gate', phase: 'Verify' })

const conformance = (await parallel([
  'The solvency invariant stable_assets>=coverage_required holds after BOTH cover_default and cover_exit; disburse reverts when stable_pre-amount<coverage_after; a multi-default+exit sequence cannot drain below the floor.',
  'coverage_required is O(1) (no loop, no time-gate) and the registry raw-coverage aggregate exactly equals the naive Σ contribution across randomized lifecycles (the property test exists and passes); MAX_ACTIVE_GUARANTEES/ActiveSetFull are gone and capacity is solvency-gated at sign_guarantee.',
  'The lapse-flip is correct (fee current ⇒ cover_default reverts; fee missed past grace ⇒ cover_default pays); the exit leg caps at monthly*exit_months; the insurance→fiança rename is complete with no leftover premium-named public surface; the simulations use N=3/E=6 with the exit-claim assumption stated.',
  ].map((claim) => () =>
    agent(`Read-only spec-conformance audit. Repo: ${REPO}, branch feat/fianca-solvency-redesign. Spec: ${SPEC}. Adversarially VERIFY this claim against the actual committed code + tests (read the files, do not trust the diff summary): "${claim}". Report holds/violated with file:line evidence and any gap.`, { label: 'verify-conformance', phase: 'Verify' })))).filter(Boolean)

return {
  implemented: implResults,
  deferred: deferred.map((x) => ({ group: x.group.id, reason: x.ev.reason, blocking: x.ev.blocking_issues })),
  evaluations: evaluated.map((x) => ({ group: x.group.id, decision: x.ev.decision, risk: x.plan.risk, confidence: x.ev.confidence })),
  synthesis: { rationale: synth.rationale, steps: synth.steps.map((s) => ({ id: s.id, gate: s.gate })), review },
  verify: { gate, conformance },
}
