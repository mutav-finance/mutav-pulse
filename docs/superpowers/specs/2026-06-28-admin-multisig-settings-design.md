# Admin multisig settings — design

**Date:** 2026-06-28
**Branch:** `feat/admin-multisig-settings`
**Status:** approved, implementing

## Problem

Each Soroban contract (`vault`/`policy`/`registry`/`adapter-defindex`) has exactly one
admin `Address`, set in the constructor and pointed at the `deployer` account
(`GA6LJT75ZRW3GWJ3NUQFBIL7CL66ITLT5BS35ZA7E7G35IOMGTSFJRIO`). We want multiple people
(the user, CI, Draau) to act as admin on testnet **without sharing a secret key and
without importing any key into a wallet**.

## Approach: classic-account multisig, threshold 1

Soroban's `require_auth()` honors a classic account's signers and thresholds. We make the
admin account a multisig: add each person's personal wallet pubkey as a weight-1 signer,
thresholds stay at 0/0/0 (any single signer authorizes). No contract change, no redeploy.

The bootstrap signer (the user's wallet `GBGRCDML…`) was already added on-chain via
`stellar tx new set-options` (tx `b54162d7…`). This spec covers the **frontend** so signers
can (a) be managed from the UI and (b) actually use the admin surfaces.

### Why the write path must change

Today admin writes build the tx with `source = connected wallet` and the contract's
`require_auth(adminAccount)` is satisfied via source-account credentials — which only works
when the connected wallet *is* the admin account. With a multisig, the connected wallet is a
**signer** of the admin account, not the account itself. The fix: set
**tx source = the admin account**, and sign the envelope with the connected (signer) wallet.
Soroban then satisfies `require_auth(adminAccount)` via source-account credentials, and the
single signer signature (weight 1 ≥ medium threshold) validates the envelope. No Soroban
auth-entry juggling, no multi-party coordination — because the threshold is 1.

**Invariant to preserve:** keep the admin account's thresholds at ≤ 1. Raising them turns
this into true M-of-N signature collection (the production path), out of scope here.

## Changes

### 1. `lib/wallet.ts` — decouple source from signer
`makeWriterOpts(address, contractId, sourceAccount?)`: when `sourceAccount` is given,
`publicKey = sourceAccount` (tx source) while `signTransaction` still signs with `address`
(the connected wallet). Default (no `sourceAccount`) is unchanged — investor deposit/redeem
and the faucet keep `source = signer`.

### 2. `lib/admin-tx.ts` — resolve the admin account as source
The internal `vaultWriter`/`policyWriter` factories take the resolved source. Each
admin-gated helper resolves the on-chain admin (`vault.admin()` / `policy.admin()`, cached
per contract id) and passes it as the source. `payFee` is **not** admin-gated (gated on
`payer`) and stays `source = caller`. The 16 call sites in the protocol page are unchanged —
the source is resolved inside the helpers.

### 3. `lib/admin-account.ts` — new, signer management (classic ops)
Mirrors `lib/trustline.ts` (classic op via `signAndSubmit`):
- `readAdminAccount(address)` → `{ signers: {key, weight}[], thresholds: {low,med,high} }`
  from Horizon (`config.horizonUrl`); 404 → account not found (throw, don't mislabel).
- `addSigner(adminAccount, signerPubkey, connectedAddress, weight = 1)` and
  `removeSigner(...)` (weight 0) — build `Operation.setOptions({ signer })` with
  **source = adminAccount**, submit via `signAndSubmit(xdr, connectedAddress)`.
- `isSigner(signers, address)` — case-insensitive membership; `isValidPubkey` via
  `StrKey.isValidEd25519PublicKey`. (Pure helpers, unit-tested.)

### 4. `app/admin/page.tsx` — new Admin tab
Two zones, terminal front (copper), reusing `ProtocolActionForm`/`FormField`:
- **Admin status** (read-only): the canonical admin account, then per live reserve the
  on-chain `vault.admin()`/`policy.admin()` with a ✓/⚠ match indicator (surfaces drift).
- **Signer management**: the signer table (key + weight) and thresholds; add-signer form
  (pubkey + weight, default 1) and per-signer remove. Gated on
  `connected ∈ signers(adminAccount)`; read-only otherwise.

### 5. `components/NavShell.tsx`
Add `{ href: "/admin", label: "admin", match: "prefix" }`; extend `isTerminalFront` to treat
`/admin` as the terminal (copper) front.

### 6. `app/protocol/[vault]/page.tsx` — gate on signers, not equality
Fetch the admin account's signer set (`readAdminAccount(vaultAdmin)`), then
`isVaultAdmin = connected === vaultAdmin || connected ∈ signers`; same for policy. This is the
"check signers instead of admin" change. With (1)+(2), the opened Manage buttons actually
succeed for any signer wallet.

## Out of scope
- Threshold management UI (keep at 1; M-of-N is the production path).
- Touching the contracts (zero Rust changes).
- `registry`/`adapter` admin surfaces (vault+policy cover the demo).

## Verification
`bun lint`, `bun test` (vitest — incl. new `admin-account` helper tests), `bun run build`
in `frontend/`. Manual: connect the user's wallet, confirm the Admin tab shows it as a signer
and a Manage action (e.g. set coverage ratio) succeeds end-to-end on testnet.
