# mutav-pulse

Stellar Pulso hackathon testbed for the **mutav SGR** reserve/fund (rental-guarantee
infrastructure). A solvency-gated tokenized reserve vault with premium-gated coverage,
a diversified yield allocator, and a frontend. Org: `mutav-finance`. Throwaway prototype
(not coupled to the audited `mutav-stellar` Fund).

## Contracts (Soroban, Rust — `contracts/`)

Modular, single-responsibility, wired by setters (see `bootstrap.sh`):

- **`interfaces`** — shared `Guarantee` type + cross-contract client traits (`VaultClient`, `PolicyClient`, `RegistryClient`, `DefindexVaultClient`). The clean boundary; keep minimal.
- **`registry`** — writer-gated typed guarantee store (data only).
- **`vault`** — custody: tokenized shares (OZ fungible, virtual-offset anti-inflation), NAV, surplus-gated redemption queue, strategy allocator, policy-gated `disburse`/`collect_premium`.
- **`policy`** — the swappable underwriting brain: premium-gated coverage, `cover_default`. Reads/writes `registry`, moves money via `vault`.
- **`strategy`** (trait) + **`adapter-defindex`** (real DeFindex yield) + `mock-strategy`/`mock-policy`/`mock-defindex` (test doubles).

**Key invariants:** money moves only via `vault`; guarantee data written only by `policy`;
solvency `stable_assets >= coverage_required` held by the policy reducing coverage BEFORE
calling `vault.disburse` at ratio >= 100% (the vault CANNOT call `policy.coverage_required`
during a default — Soroban re-entrancy). Premiums mint no shares (accrue to NAV).

**Build/test:** `cargo test` (whole workspace); `stellar contract build` for wasm
(NOT raw `cargo build --release` — soroban-sdk 26.1 spec-shaking needs the CLI).
Tests use `e.mock_all_auths_allowing_non_root_auth()`. Deploy/wire: `bootstrap.sh`.

## Brand setup (vendored from `mutav-finance/brand`)

Brand assets live at **`.design/branding/tga/`** — **copy-vendored, NOT symlinked**
(the term "symlink" is a misnomer; consumers each hold a copy + a `.brand-version` baseline).
This mirrors the other consumers (`mutav`, `mutav-app`, `mutav-fund`, `mutav-stellar`,
`mutav-solana`), which all vendor to the same `.design/branding/tga/` path.

- **Source of truth:** the `brand` repo (`mutav-finance/brand`), at `brand/branding/tga/`.
  `mutav-pulse` is registered in `brand/consumers.json`.
- **To update** the vendored brand: `cd ../brand && bun brand:import mutav-pulse`
  (3-way merges brand HEAD into our `.design`). `bun brand:export` re-baselines all consumers.
- **NEVER edit `.design/branding/tga/**` directly** — it is vendored. Change the `brand` repo
  and re-import, so edits round-trip through the source of truth.

**Design tokens (read these for the frontend):**
- `identity/palettes.json` — OKLCH scales. Primary accent **amber `#E8A020`** (scarce, <5% of
  pixels); **copper** terminal accent; `amberLight #C47E10` for light surfaces.
- `identity/typography.md` — three-typeface system: **Geist Bold** (authority/headings),
  **Inter** (clarity/body), **JetBrains Mono** (data/numbers). ALL CAPS only for data labels (NAV, APY, TGA).
- `identity/color-system.md`, `patterns/STYLE.md`, `patterns/tga.yml` — full design system.
- Aesthetic: **"Precision Brutalism"** — minimal-dark, terminal, professional.
- `config.json` defines three product fronts that map to our audiences:
  **`dashboard-investidor`** (investors — dark + amber), **`dashboard-imobiliarias`** (agencies — light),
  **`terminal`** (protocol operators).

## Frontend (`frontend/` — Plan 3, in progress)

Stellar Wallets Kit + the three brand fronts wired to the testnet deploy. Use the
**`impeccable`** skill (installed at `.claude/skills/impeccable`) for design quality, and
the TGA brand tokens above — do not invent colors/type.
