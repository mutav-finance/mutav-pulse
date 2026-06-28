export const meta = {
  name: 'whitepaper-regen',
  description: 'Regenerate docs/whitepaper.md + model/README.md for the two-leg fiança economics (issue #43): capture ground-truth numbers from model/mutav_model.py, surgically rewrite each whitepaper section in parallel (preserving voice + citations), assemble + write both files, then adversarially verify every number matches the model and no stale single-leg/insurance terms remain.',
  phases: [
    { title: 'Capture' },
    { title: 'Draft' },
    { title: 'Assemble' },
    { title: 'Verify' },
  ],
}

const REPO = '/Users/jubs/Projects/tga-protocol/mutav-pulse'
const WP = 'docs/whitepaper.md'
const RM = 'model/README.md'
const SPEC = 'docs/superpowers/specs/2026-06-27-fianca-solvency-coverage-redesign-design.md'

const FRAMING = `THE REDESIGN the docs must now reflect (source of truth = model/mutav_model.py, which has --selftest green): TWO coverage legs — DEFAULT (rent-arrears) months_covered=3 drawn via cover_default, + EXIT (property-recovery) exit_months=6 drawn via cover_exit; capital_locked = c·R·(N+E) = 9R per guarantee at c=1.0; max obligation 9× monthly rent. We are a FIANÇA (fiador institucional, Código Civil art. 818+), NOT insurance/seguradora — use fiança vocabulary (fee / pay_fee / collect_fee, "taxa de garantia"), NEVER prêmio/apólice/sinistro/seguradora. The fee stream IS the default oracle: a fee-miss past a grace window IS a default that triggers the claim — there is NO time-gate and lapse does NOT release coverage. The EXIT-cost claim assumption is a stated, tunable modelling input (p_exit=1.0, exit_severity=0.15, lease_months=30) — surface it as pending confirmation with Draau. The 30× LMI is the DEFERRED seguro-fiança variant (out of scope, a Draau decision). NEW headline numbers (BRL/Sul/c=1.0): capital R$9,000/guarantee; nominal APY ~23% (was ~33%); underwriting spread ~9% (was ~19%); loss ratio (Sul) ~45%; cushion 3.7×; c=1.0 Monte-Carlo breach 0%.`

const RULES = `RULES: (1) Numbers are NOT invented — every figure must come from the captured model output below; if a table cell isn't in the capture, say so, do not guess. (2) PRESERVE the document's structure, prose voice, section order, and ALL citations/source links/footnotes from the original — this is a surgical update of numbers + framing, NOT a from-scratch rewrite. (3) Replace every stale single-leg artefact (N=6, R$6,000, ~33%, ~19% spread, "premium"/"prêmio", "pay_premium") with the two-leg/fiança equivalent. (4) Markdown only; keep tables as GitHub-flavored markdown.`

const DRAFT_SCHEMA = { type: 'object', additionalProperties: false, required: ['id', 'markdown', 'notes'], properties: {
  id: { type: 'string' }, markdown: { type: 'string' }, notes: { type: 'string' } } }

const VERIFY_SCHEMA = { type: 'object', additionalProperties: false, required: ['check', 'verdict', 'evidence'], properties: {
  check: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fail'] }, evidence: { type: 'string' } } }

// Whitepaper sections (the markdown headings to surgically rewrite, in order).
const SECTIONS = [
  { id: '1-summary',     note: 'The one-sentence thesis + the APY decomposition. Update the headline APY/spread to the two-leg numbers; keep the "spread is the product, base rate is currency passthrough" framing.' },
  { id: '2-product',     note: 'The standard product table. Now TWO legs: DEFAULT N=3 + EXIT E=6 (capital 9R). Update the contract-exact mechanics to fee/pay_fee/cover_default/cover_exit, the grace-window default trigger, and the fee-stream-as-oracle. Drop the old frontend "annual premium" label note unless still accurate.' },
  { id: '3-risk-data',   note: 'Brazilian delinquency data (rho, Superlógica). Mostly unchanged — PRESERVE all citations/links. Only adjust any sentence that assumed the single-leg payout shape.' },
  { id: '4-unit',        note: 'Unit economics for one guarantee. Rebuild the closed-form block and the by-scenario table from the capture: capital 9R, fee ~1,461, default payout + EXIT payout (~360), net u/w, +DeFi, APY ~23%, loss ratio ~45%, cushion. Explain the exit leg now dominates losses.' },
  { id: '5-currency',    note: 'BRL vs USD currency peg. Update the nominal/real APY table from the capture (BRL ~23% / USD ~14.5% nominal); keep "spread is currency-independent".' },
  { id: '6-lever',       note: 'The coverage-cap lever. Reframe around N (default leg) with E fixed at 6; rebuild the N-lever table from the capture (N=3/6/12/30 → capital 9k/12k/18k/36k, APY). Note the 30× LMI is the deferred variant.' },
  { id: '7-capacity',    note: 'Reserve capacity & portfolio. Rebuild from the capture: each guarantee needs 9R; capacity table (50k→5, 100k→11, 500k→55, 1M→111) with premiums/payouts/APY.' },
  { id: '8-actuarial',   note: 'Actuarial mode c<1.0. Rebuild the c table from the capture (c=1.0/0.5/0.3 → capital 9k/4.5k/2.7k, APY ~23/32/44%). Keep the c=1.0 breach-proof-by-construction argument (now: cover_default AND cover_exit drop NAV and floor in lockstep).' },
  { id: '9-montecarlo',  note: 'Monte Carlo tail. Rebuild the base + stress tables from the capture (c=1.0 breach 0%); describe the exit leg as a lockstep one-time draw preserving breach-proofness; keep the recession-regime description.' },
  { id: '10-conclusions',note: 'Conclusions. Update the 4 numbered takeaways to the two-leg numbers and the fiança (not insurance) positioning; note exit-cost assumption pending Draau.' },
  { id: 'appendix',      note: 'Reproduce/appendix. Update the commands (add --exit-months if useful) and the "every number from the script" note. Keep it runnable.' },
]

// ── Capture: ground-truth numbers from the model ────────────────────────────
phase('Capture')
const capture = await agent(`Run the economic model and return its FULL stdout verbatim (this is the numeric source of truth for the whitepaper). Repo: ${REPO}. Run all three and concatenate, each under a clear header:\n  python3 model/mutav_model.py\n  python3 model/mutav_model.py --currency USD\n  python3 model/mutav_model.py --scenario banda_ate_1k\nAlso run \`python3 model/mutav_model.py --selftest\` and report its result line. Return the raw concatenated output — do not summarize or round.`, { label: 'capture-model', phase: 'Capture' })

// ── Draft: surgical per-section rewrite (parallel; each returns markdown) ─────
phase('Draft')
const drafts = (await parallel(SECTIONS.map((s) => () =>
  agent(`Surgically rewrite ONE whitepaper section. Repo: ${REPO}. Read the CURRENT ${WP} and the design spec ${SPEC}.\n${FRAMING}\n${RULES}\n\nSECTION: ${s.id}. What to do: ${s.note}\n\nCANONICAL MODEL OUTPUT (the only source for numbers):\n${capture}\n\nReturn {id:'${s.id}', markdown (the full rewritten section, heading included, ready to splice in verbatim — preserve the original heading text/level and every citation/link in this section), notes (anything you could not source from the capture)}.`,
    { schema: DRAFT_SCHEMA, phase: 'Draft', label: `draft:${s.id}` })))).filter(Boolean)

// ── Assemble: write whitepaper (from drafts) + README (direct), parallel files ─
phase('Assemble')
const ordered = SECTIONS.map((s) => drafts.find((d) => d && d.id === s.id)).filter(Boolean)
const [wpReport] = await parallel([
  () => agent(`Assemble and WRITE the regenerated whitepaper. Repo: ${REPO}. Read the current ${WP} to keep its YAML frontmatter (if any), title, date, and any prose between/around sections you were not given. Then splice in these rewritten sections IN ORDER, replacing the originals, producing one coherent document with consistent cross-references (the §1 headline APY must match §4/§5). ${RULES}\n\nORDERED SECTION DRAFTS:\n${JSON.stringify(ordered)}\n\nWrite the final markdown to ${WP}. Do NOT run git. Return a short report: sections written, any cross-reference reconciliations, anything left unsourced.`, { label: 'assemble-whitepaper', phase: 'Assemble' }),
  () => agent(`Rewrite and WRITE ${RM}. Repo: ${REPO}. Read the current ${RM} and the design spec ${SPEC}.\n${FRAMING}\n${RULES}\n\nCANONICAL MODEL OUTPUT:\n${capture}\n\nUpdate the "contract-exact" mechanics table (fee/pay_fee, two-leg coverage_required with DEFAULT+EXIT, cover_default + cover_exit, fees→NAV, free_capital), the one-formula box, and the key-variables list (add exit_months, p_exit, exit_severity, lease_months; months_covered is now the default leg). Keep it a faithful companion to model/mutav_model.py. Write the result to ${RM}. Do NOT run git. Return a short report.`, { label: 'assemble-readme', phase: 'Assemble' }),
])

// ── Verify: adversarial — numbers match the model, no stale artefacts ─────────
phase('Verify')
const checks = (await parallel([
  `No stale single-leg / insurance artefacts remain in ${WP} or ${RM}: grep for "6,000"/"6000", "33.4"/"33%", "N = 6"/"N=6", "pay_premium", "prêmio", "premium", "apólice", "sinistro", "seguradora". Each hit must be either gone or a deliberate historical/contrast reference; flag any that is a live current-product claim.`,
  `Every numeric table in ${WP} matches python3 model/mutav_model.py output. Re-run the model (default, --currency USD, --scenario banda_ate_1k) and spot-check the unit-economics table (§4), currency table (§5), N-lever (§6), capacity (§7), actuarial (§8), and Monte Carlo (§9) cell-by-cell. Report any cell that does not match the model.`,
  `Framing is correct in both docs: two legs (DEFAULT 3 + EXIT 6, capital 9R) throughout; fiança (not insurance) positioning; fee-miss-past-grace = default with NO time-gate; the exit-cost assumption (p_exit/exit_severity/lease_months) is stated as pending Draau; the 30× LMI is described as deferred/out-of-scope. Quote evidence for each.`,
  ].map((claim) => () =>
    agent(`Read-only adversarial verification for the whitepaper regen. Repo: ${REPO}. Read ${WP} and ${RM} (and re-run the model as needed). VERIFY: "${claim}". Be skeptical; do not trust prose, check the actual files/numbers. Return {check (short label), verdict pass/fail, evidence (file:line / exact mismatched values)}.`,
      { schema: VERIFY_SCHEMA, phase: 'Verify', label: 'verify' })))).filter(Boolean)

return {
  whitepaper: wpReport,
  drafts: drafts.map((d) => ({ id: d.id, notes: d.notes })),
  verify: checks,
  fails: checks.filter((c) => c.verdict === 'fail'),
}
