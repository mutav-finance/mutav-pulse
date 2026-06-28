export const meta = {
  name: 'frontend-call-audit',
  description: 'Deploy the new-ABI reserve to testnet, then review and TEST every Soroban contract call the frontend makes against the live deploy. Per call site: static review (does the method/args match the deployed ABI?) + live test (invoke the contract method against testnet) → a migration/verification punch-list with evidence.',
  phases: [
    { title: 'Deploy' },
    { title: 'Enumerate' },
    { title: 'Audit' },
    { title: 'Report' },
  ],
}

const REPO = '/Users/jubs/Projects/tga-protocol/mutav-pulse'
const FE = '/Users/jubs/Projects/tga-protocol/mutav-pulse/.claude/worktrees/frontend-adjustments/frontend'
const NET = 'testnet'

// New-ABI surface (from contracts, post-#44) the frontend must match:
const ABI = `NEW contract ABI (post-redesign, what the deployed contracts expose):
- policy: sign_guarantee(landlord, monthly_amount, months_covered, EXIT_MONTHS, fee_bps, period_secs)->u32; pay_fee(payer, id); cover_default(id); cover_exit(id, amount); settle_guarantee(id); coverage_required()->i128; monthly_fee(id); set_grace_secs(secs)/grace_secs(); set_coverage_ratio_bps(bps).
- vault: deposit(assets,receiver,from,operator); request_redeem/cancel_redeem/claim/process_redemptions; disburse(to, amount, COVERAGE_AFTER) [policy-only]; collect_fee(from, amount) [policy-only]; stable_assets(); total_assets(); nav_per_share(); free_capital(); fee_income(); add_strategy/remove_strategy/rebalance.
- registry: get(id)->Guarantee{ id, landlord, monthly_amount, months_covered, months_used, fee_bps, period_secs, paid_until, active, EXIT_MONTHS, EXIT_USED }; active_ids()->Vec<u32>; raw_coverage()->i128.
STALE (old ABI — must be flagged if the frontend still uses them): pay_premium, collect_premium, monthly_premium, 3-arg disburse(to,amount), Guarantee WITHOUT exit_months/exit_used, MAX_ACTIVE_GUARANTEES/ActiveSetFull, missing cover_exit.`

const IDS_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'ids', 'state', 'notes'], properties: {
  ok: { type: 'boolean' },
  ids: { type: 'object', additionalProperties: true, properties: { BRL_SAC: {type:'string'}, FAUCET:{type:'string'}, REGISTRY:{type:'string'}, VAULT:{type:'string'}, POLICY:{type:'string'}, MOCK_TESOURO:{type:'string'} } },
  state: { type: 'string' }, notes: { type: 'string' } } }

const CALLS_SCHEMA = { type: 'object', additionalProperties: false, required: ['calls'], properties: {
  calls: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'line', 'contract', 'method', 'kind', 'args'], properties: {
    file: { type: 'string' }, line: { type: 'number' }, contract: { type: 'string', enum: ['vault','policy','registry','faucet','sac','other'] },
    method: { type: 'string' }, kind: { type: 'string', enum: ['read','write'] }, args: { type: 'string' } } } } } }

const AUDIT_SCHEMA = { type: 'object', additionalProperties: false, required: ['file', 'method', 'abi_match', 'test_result', 'verdict', 'detail', 'fix'], properties: {
  file: { type: 'string' }, method: { type: 'string' },
  abi_match: { type: 'string', enum: ['match', 'stale', 'missing-arg', 'renamed', 'shape-drift'] },
  test_result: { type: 'string', enum: ['pass', 'fail', 'not-run'] },
  verdict: { type: 'string', enum: ['ok', 'needs-migration', 'broken'] },
  detail: { type: 'string' }, fix: { type: 'string' } } }

// ── Deploy: robust testnet deploy + seed (handle the flakiness) ──────────────
phase('Deploy')
const deploy = await agent(`Deploy the BRL-native new-ABI reserve to Stellar ${NET} and seed the demo book, ROBUSTLY. Repo: ${REPO}. Source/admin key: \`deployer\` (funded, ~9996 XLM; it is the cBRL issuer).

Run \`BRL_NATIVE=1 bash bootstrap.sh\` then \`VAULT=… POLICY=… BRL_SAC=… REGISTRY=… bash seed.sh\`. KNOWN FLAKINESS to handle (do not just give up):
- TxBadSeq: transient testnet sequence races — simply retry the failing step.
- "contract already exists" on the cBRL SAC: a prior run already deployed the SAC for cBRL:deployer (CCRSLV5CL7T5ZW7OUIAM2CTP365S7PUWIKGTHUHFSNIC6IO75XFIZ23V). Either pass BRL_SAC=<that id> to reuse it, OR use a fresh BRL_CODE (e.g. cBRLD) for a clean asset.
- Faucet "zero balance is not sufficient" on drip: the mint-to-faucet didn't land. After \`mint --to <FAUCET>\`, VERIFY the faucet's cBRL balance on-chain (invoke the SAC \`balance --id <FAUCET>\` or read it) BEFORE drip; re-mint/retry until the balance is non-zero. Diagnose the real cause (sequencing, wrong arg, admin auth) and fix it; if bootstrap.sh has a bug in the faucet-funding step, note it precisely.

After a successful deploy + seed, capture the contract IDs and the final state (nav_per_share, total_assets, stable_assets, coverage_required, registry raw_coverage, active_ids). The seed should produce 4 two-leg guarantees (3 fee-current, 1 pending) with coverage_required = 72,000 cBRL (@1e7 = 720000000000). Return {ok, ids:{BRL_SAC,FAUCET,REGISTRY,VAULT,POLICY,MOCK_TESOURO}, state (the queried values), notes (what you fixed / any bootstrap bug found)}.`, { schema: IDS_SCHEMA, label: 'deploy+seed', phase: 'Deploy' })

if (!deploy.ok) {
  log(`Deploy failed: ${deploy.notes}`)
  return { deploy, aborted: 'deploy did not succeed — no live target to audit against' }
}
const ids = deploy.ids
log(`Deployed: VAULT=${ids.VAULT} POLICY=${ids.POLICY} REGISTRY=${ids.REGISTRY}`)

// ── Enumerate: every contract call site in the frontend ─────────────────────
phase('Enumerate')
const enumr = await agent(`Enumerate EVERY Soroban contract call the frontend makes. Frontend root: ${FE}. Scan lib/*.ts (contracts.ts, tx.ts, admin-tx.ts, reserves.ts, economics.ts, onramp.ts), components/*.tsx, app/**/*.tsx — every place that invokes a contract method via a binding client (vault/policy/registry/faucet) or @stellar/stellar-sdk (the SAC). For each, record {file, line, contract, method, kind (read|write), args (the argument names/shape passed)}. Include reads (coverage_required, active_ids, get, nav_per_share, total_assets, stable_assets, free_capital, balance) and writes (deposit, request_redeem, claim, sign_guarantee, pay_fee/pay_premium, cover_default, etc.). Be exhaustive — one entry per distinct call site. Return {calls}.`, { schema: CALLS_SCHEMA, label: 'enumerate-calls', phase: 'Enumerate' })
const calls = enumr.calls || []
log(`Found ${calls.length} frontend contract call sites`)

// ── Audit: per call site, static review vs ABI + live test on testnet ────────
phase('Audit')
const idline = `Deployed IDs (network ${NET}): VAULT=${ids.VAULT} POLICY=${ids.POLICY} REGISTRY=${ids.REGISTRY} BRL_SAC=${ids.BRL_SAC} FAUCET=${ids.FAUCET}. Admin/source key: deployer.`
const audits = (await parallel(calls.map((c) => () =>
  agent(`Review AND test ONE frontend contract call against the live new-ABI deploy. Repo: ${REPO}. Frontend: ${FE}. ${ABI}\n${idline}\n\nCALL SITE: ${c.file}:${c.line} — ${c.contract}.${c.method}(${c.args}) [${c.kind}].\n\n(1) STATIC REVIEW: read the call site + the binding it uses; does the method name, arity, and arg/return shape match the deployed ABI above? Classify abi_match (match/stale/missing-arg/renamed/shape-drift).\n(2) LIVE TEST: invoke the corresponding method on the deployed contract via \`stellar contract invoke --id <id> --source deployer --network ${NET}\` — for a read, call it and check it returns sane data (and that the binding could decode it — esp. registry.get must now carry exit_months/exit_used); for a write, simulate (\`--send=no\`) with representative args (use the seeded guarantee ids 0..3). test_result = pass/fail/not-run.\nReturn {file, method, abi_match, test_result, verdict (ok|needs-migration|broken), detail (evidence: error text / decoded value), fix (the concrete frontend change needed, if any)}.`,
    { schema: AUDIT_SCHEMA, label: `audit:${c.contract}.${c.method}`, phase: 'Audit' })))).filter(Boolean)

// ── Report ──────────────────────────────────────────────────────────────────
phase('Report')
const broken = audits.filter((a) => a.verdict !== 'ok')
const report = await agent(`Synthesize a frontend contract-call audit report. ${audits.length} call sites tested against the live new-ABI deploy; ${broken.length} are not ok. Group by file, then by verdict (broken / needs-migration / ok). For each non-ok call give the method, why (abi_match + test_result + detail), and the concrete fix. End with an ordered migration checklist (regenerate bindings first, then per-file edits, then env repoint). Be concise and actionable.\n\nAUDIT RESULTS: ${JSON.stringify(audits)}`, { label: 'synthesize-report', phase: 'Report' })

return { deploy: { ids, state: deploy.state, notes: deploy.notes }, total: calls.length, broken: broken.length, audits, report }
