export const meta = {
  name: 'protocol-audit',
  description: 'Deep per-method audit of the mutav-pulse Soroban protocol against the references it was built on (ERC-4626, ERC-7540, Yearn v3, Centrifuge, Nexus Mutual, DeFindex) + Soroban security + the /simplify quality dimensions. Per-contract audit (parallel) → adversarial verify of high-severity → synthesized cited report with a conformance scorecard. Read-only; no code changes.',
  phases: [
    { title: 'Audit' },
    { title: 'Verify' },
    { title: 'Synthesize' },
  ],
}

const REPO = '/Users/jubs/Projects/tga-protocol/mutav-pulse'

const STANDARDS = `Judge each method against these references (the ones the protocol was built on); CITE the specific standard per finding:
- ERC-4626 (tokenized vault): rounding ALWAYS favors the vault (deposit/convert_to_shares/preview_redeem = floor; mint/preview_withdraw = ceil); inflation/donation-attack defense (virtual offset / decimals offset); total_assets accounting integrity; preview_* must equal the real op; share<->asset monotonicity; correct Deposit/Withdraw events.
- ERC-7540 (async deposit/redeem): three-state lifecycle Pending->Claimable->Claimed; shares removed from owner on request_redeem and burned by claim; claim transfers no shares; max_withdraw/max_redeem return 0 when sync withdrawals are disabled; Claim never short-circuited.
- Yearn v3 (allocator): minimum_total_idle anchored to TOTAL assets; debt update is target-to-balance (bidirectional, idempotent); per-strategy max_debt concentration cap; debt denominated in the underlying.
- Centrifuge (RWA reserve): cash 'reserve' as a min/max band; epoch-batched async; unfilled orders roll forward.
- Nexus Mutual (cover): required capital sized as a function of OUTSTANDING/active cover (coverage-anchored solvency), not a flat % of assets.
- DeFindex (Soroban adapter): idle buffer + on-demand idle-first withdrawal/liquidation.

SECURITY rubric (Soroban-specific):
- Auth: every state-mutating method must require the correct require_auth (admin / policy / owner). Flag missing or over-broad auth.
- Re-entrancy: cross-contract callouts (token SAC, strategy adapters, policy). KEY invariant: the policy must REDUCE coverage_required BEFORE calling vault.disburse, and the vault must NEVER call policy.coverage_required during a disburse/default. Flag any callout that violates ordering or lacks a Locked guard.
- Arithmetic: i128 overflow/underflow, division rounding direction, precision/scale (NAV_SCALE=1e7, BPS_DENOM=10_000), multiply-before-divide.
- Storage: instance vs persistent vs temporary; TTL/archival risk for long-lived data (redeem requests, guarantees); storage-layout compatibility for upgrade().
- Access control on upgrade()/admin setters; writer-gating on the registry.

QUALITY rubric (the /simplify dimensions): reuse (duplicated logic a shared helper covers), simplification (redundant/derivable state, dead code), efficiency (redundant storage get/set — each is a metered fee; sequential ops; re-reads), altitude (special-cases vs a generalized mechanism; right depth).`

const AUDIT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['contract', 'findings'],
  properties: {
    contract: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['method', 'dimension', 'standard', 'severity', 'title', 'detail', 'recommendation'],
      properties: {
        method: { type: 'string' },
        dimension: { type: 'string', enum: ['correctness', 'security', 'conformance', 'reuse', 'simplification', 'efficiency', 'altitude'] },
        standard: { type: 'string', enum: ['ERC-4626', 'ERC-7540', 'Yearn-v3', 'Centrifuge', 'Nexus', 'DeFindex', 'Soroban-security', 'general'] },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
        title: { type: 'string' },
        detail: { type: 'string' },
        recommendation: { type: 'string' },
      },
    } },
  },
}

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdict', 'justification'],
  properties: {
    verdict: { type: 'string', enum: ['CONFIRMED', 'PLAUSIBLE', 'REFUTED'] },
    justification: { type: 'string' },
  },
}

const CONTRACTS = [
  { name: 'vault', files: 'contracts/vault/src/lib.rs + contracts/vault/src/types.rs', focus: 'Core custody/share contract. Audit EACH method: __constructor, deposit, mint, withdraw/redeem (disabled), request_redeem, cancel_redeem, process_redemptions, claim, rebalance, ensure_liquidity, add_strategy, remove_strategy, nav_per_share, to_shares/to_assets, convert_*/preview_*, max_*, disburse, collect_premium, stable_assets, free_capital, target_idle, min_liquid_buffer_bps + setter, strategy_max_debt_bps + setter, set_token_metadata, set_admin, upgrade. Heavy on ERC-4626 (rounding, virtual offset, preview parity), ERC-7540 (async lifecycle), Yearn (buffer/rebalance/max_debt), Soroban security (re-entrancy on disburse/rebalance/ensure_liquidity, auth, i128).' },
  { name: 'policy', files: 'contracts/policy/src/lib.rs', focus: 'Underwriting brain. Audit each method: sign_guarantee, pay_premium, cover_default, settle_guarantee, coverage_required, monthly_premium, is_current, the set_* setters, upgrade. Nexus angle: is coverage_required correctly coverage-anchored? Verify the disburse-ordering invariant (reduce coverage BEFORE vault.disburse). Premium math, fee_bps bounds, paid_until gating, auth on each method.' },
  { name: 'registry', files: 'contracts/registry/src/lib.rs', focus: 'Writer-gated typed guarantee store. Audit each method: put (writer-gating/auth), get (error handling), active_ids management, next_id, set_writer, upgrade. Storage: persistent vs instance, TTL/archival risk for guarantees, layout for upgrade.' },
  { name: 'interfaces', files: 'contracts/interfaces/src/lib.rs', focus: 'The trait boundary (Vault/Policy/Registry/DefindexVault traits + Guarantee/RegistryError types). Audit for a clean, minimal, type-safe boundary; error-code stability; whether the trait surface leaks internals or under-specifies (e.g. divest return semantics, fee-on-transfer assumptions).' },
  { name: 'strategy+adapter', files: 'contracts/strategy/src/lib.rs + contracts/adapter-defindex/src/lib.rs', focus: 'Strategy trait ABI + the REAL DeFindex adapter. Audit each adapter method (invest, divest, balance, underlying; the DeFindex deposit/withdraw calls; df-share valuation). Check: conformance to the trait contract, divest return/lossy semantics, slippage/min-amounts handling, re-entrancy on adapter callouts, auth, i128, and ERC-4626-style valuation of the df position via get_asset_amounts_per_shares.' },
]

function auditPrompt(c) {
  return `Read-only protocol audit. Repo: ${REPO}. Read these files IN FULL (plus any sibling they reference — types, the strategy trait, interfaces): ${c.files}.

${STANDARDS}

TARGET: the ${c.name} contract. ${c.focus}

Do an IN-DEPTH, PER-METHOD analysis: for EVERY public method (and any significant internal one), state briefly what it does, then check it against the standards + security + quality rubrics. Surface concrete findings — be specific and cite the actual code behavior (method + what the lines do), never vague advice. ALSO record conformance PASSES as severity 'info' (e.g. "deposit rounds shares down — ERC-4626 conformant") so the report can build a scorecard. Set 'standard' to the most relevant reference. Return the structured object {contract, findings:[...]}.`
}

const crossCutPrompt = `Read-only protocol audit — CROSS-CUTTING invariants. Repo: ${REPO}. Read contracts/vault/src/lib.rs, contracts/policy/src/lib.rs, contracts/registry/src/lib.rs, contracts/interfaces/src/lib.rs IN FULL.

${STANDARDS}

Audit the WHOLE-PROTOCOL invariants that span contracts. Use contract='cross-cutting' and method = the invariant name. Cover:
- Money-flow: money moves ONLY via the vault; guarantee data written ONLY by policy. Trace and verify.
- Solvency + re-entrancy: the stable_assets >= coverage_required invariant and the disburse ordering — trace cover_default -> vault.disburse end-to-end; confirm policy reduces coverage BEFORE disburse and the vault never calls policy.coverage_required during a default.
- ERC-4626 / ERC-7540 HOLISTIC conformance: does the vault as a whole conform? Emit one 'info'-or-higher finding PER standard with an explicit PASS / PARTIAL / FAIL verdict in the title (e.g. "ERC-7540 async lifecycle — PASS").
- NAV integrity: premiums accrue to NAV with no shares minted; redemption pricing parity with NAV.
- Upgrade/lifecycle: setter-wired connections and storage-layout compatibility for upgrade().
Return {contract:'cross-cutting', findings:[...]}.`

function verifyPrompt(f) {
  return `Read-only verification. Repo: ${REPO}. A protocol audit flagged this on contract='${f.contract}', method='${f.method}', standard='${f.standard}', severity='${f.severity}':
TITLE: ${f.title}
DETAIL: ${f.detail}

Read the ACTUAL code and judge whether it is real and correctly characterized. Return CONFIRMED (real, as described), PLAUSIBLE (real under a realistic condition), or REFUTED (factually wrong / already handled / pure style with no effect). Cite actual lines. Recall-biased: only REFUTE if constructible from the code.`
}

phase('Audit')
const audits = (await parallel([
  ...CONTRACTS.map((c) => () => agent(auditPrompt(c), { schema: AUDIT_SCHEMA, phase: 'Audit', label: `audit:${c.name}` })),
  () => agent(crossCutPrompt, { schema: AUDIT_SCHEMA, phase: 'Audit', label: 'audit:cross-cutting' }),
])).filter(Boolean)

const all = audits.flatMap((a) => (a.findings || []).map((f) => ({ contract: a.contract, ...f })))
const high = all.filter((f) => f.severity === 'critical' || f.severity === 'high')
log(`Audit produced ${all.length} findings; verifying ${high.length} high/critical`)

phase('Verify')
const verified = (await parallel(high.map((f) => () =>
  agent(verifyPrompt(f), { schema: VERDICT_SCHEMA, phase: 'Verify', label: `verify:${f.contract}:${f.method}` })
    .then((v) => ({ ...f, verdict: v ? v.verdict : 'UNVERIFIED', verify_just: v ? v.justification : '' }))
))).filter(Boolean)

const confirmedHigh = verified.filter((f) => f.verdict !== 'REFUTED')
const refutedHigh = verified.filter((f) => f.verdict === 'REFUTED')
const lower = all.filter((f) => f.severity !== 'critical' && f.severity !== 'high')

phase('Synthesize')
const report = await agent(`Read-only. Repo: ${REPO}. You are writing the FINAL protocol-audit report (markdown) for the mutav-pulse Soroban protocol, audited against ERC-4626, ERC-7540, Yearn v3, Centrifuge, Nexus Mutual, DeFindex, plus Soroban security and the /simplify quality dimensions.

Produce a clear, decision-useful markdown report with:
1. **Executive summary** (3-6 sentences): overall health, the few things that matter most.
2. **Conformance scorecard**: a table — ERC-4626, ERC-7540, Yearn-v3 (allocator), Centrifuge (reserve band), Nexus (coverage-anchored solvency) — each rated PASS / PARTIAL / FAIL with a one-line note. Derive these from the 'conformance' findings (the cross-cutting agent emitted explicit PASS/PARTIAL/FAIL verdicts; reconcile with per-contract conformance findings).
3. **Confirmed high/critical findings** (ranked) — for each: contract·method, standard, severity, what's wrong, recommendation, and the verify verdict.
4. **Medium/low findings** grouped by contract.
5. **Quality (/simplify) findings** grouped by dimension (reuse/simplification/efficiency/altitude).
6. **Appendix: refuted** high-severity claims (so the reader knows what was checked and dismissed).
Keep it tight; merge near-duplicates; do not invent findings beyond the data. 

DATA — confirmed/plausible HIGH+CRITICAL (with verify verdicts):
${JSON.stringify(confirmedHigh, null, 1)}

DATA — MEDIUM/LOW + INFO/CONFORMANCE findings:
${JSON.stringify(lower, null, 1)}

DATA — REFUTED high-severity (verification rejected):
${JSON.stringify(refutedHigh, null, 1)}

Return the full markdown report as your message.`, { label: 'synthesize', phase: 'Synthesize' })

return { report, counts: { findings: all.length, high: high.length, confirmedHigh: confirmedHigh.length, refuted: refutedHigh.length } }