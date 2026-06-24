# ZK Solvency Seal — Plan (MUTAV × Stellar Hacks: Real-World ZK)

> Hackathon: **Stellar Hacks: Real-World ZK** (DoraHacks / Stellar Development Foundation).
> Deliverable: repository (and a demo video — _out of scope for this plan by team decision_).
> Stage: the **`frontend/app/earn/transparency/page.tsx`** page in this repo — the **Investor** front (dark + amber). Audience = people who invest in the fund (holders of `mtvR`).

---

## 1. The idea in one sentence

Today the `SolvencyChip` on the transparency page says _"the fund is covered"_ — but it only proves it with what is **public on-chain**. We'll add a **mathematically proven seal (ZK)** that also covers **what is secret**: money in the bank (A), the customer list (B), and the set of wallets (C). The investor gets a **"✅ covered, and it's provably true — your shares are backed"** without the fund exposing any of that data.

This is the classic **proof of reserves / proof of solvency** pattern (the one serious exchanges adopted post-FTX): proving solvency to depositors/investors without opening the whole wallet.

## 2. What ZK is here (plain language)

Proving that a statement is **true without showing the data behind it**. Analogy: proving you're 18+ by turning on a **green light**, without handing over your ID. The proof is generated **off-chain** (on our computer) and **verified on-chain** in a Soroban contract (cheap and fast — Protocol 25/26, BN254 + Poseidon host functions).

## 3. The single equation

The three pieces feed **one single proof**:

```
Reserves (vault on-chain + A bank + C wallets)  ≥  Obligations (B guarantee list) × band
```

- **What goes public (the "green light"):** only `solvent = yes/no` + a health **band** (e.g., "≥100%", "≥120%") + a moment/ledger stamp. Never the values.
- **What stays secret:** reserve values, where the money is, composition/strategy, and the customer list (LGPD).

---

## 4. Technical choice — **UPDATED** (Track A = Circom, recommended)

Research changed the recommendation. There are **ready-made Stellar/Nethermind pieces in Circom** that cover almost exactly our case — especially piece B (a list anchored in a Merkle root), which is the hardest and most important part.

### ✅ Track A — Circom + snarkjs + circom2soroban (RECOMMENDED)
- **Why:** piece B is a **Merkle tree with Poseidon** (in our case the circuit **recomputes the entire root** from all leaves — see 6.2 — not single-leaf inclusion) — and the `stellar-private-payments` repo already provides these ready-made building blocks (`main.circom` + **Poseidon**, of which we reuse the tree hashing), the **`circom2soroban`** tool (converts verification key/proof/inputs into Rust for the contract), and **`coinutils`** (reconstructs the Merkle tree). And `soroban-examples/groth16_verifier` is an **official ready-made Groth16 verifier** to use as a base.
- **Cost:** writing signature verification (pieces A/C) in Circom is more work → we use **EdDSA from circomlib** (`eddsaposeidon`), which is circuit-friendly. (The oracle key is ours/simulated anyway, so it doesn't have to be Stellar's ed25519.)

### 🅱️ Track B — RISC Zero (FALLBACK)
- You write the rule in plain Rust; **Nethermind has the verifier ready** (`stellar-risc0-verifier`). Good if the signature part in Circom gets stuck.
- **Cons:** heavier proofs (requires Docker), a larger/unaudited verifier (router + timelock + emergency-stop), and **the Merkle would have to be written in the guest** (not provided ready-made).

> **Decision:** start with Track A. Day 1 is purely de-risking that track end-to-end. If the signature in Circom becomes a bottleneck, A/C fall back to a **Poseidon commitment** scheme (simpler) or we migrate just that part to Track B.

### On-chain budget note ⚠️
Verifying **one** Groth16 proof costs ~**40 million instructions (~40% of a transaction's budget on testnet)**. Therefore: **one aggregated proof per attestation** (not several), and `solvency_attestor` must be lean. Our design is already this way (one proof covers A+B+C).

---

## 5. Reusable Stellar/Nethermind materials

| Repo / resource | What it gives us | Where we use it |
|---|---|---|
| **`stellar/soroban-examples` → `groth16_verifier`** | Official Groth16 example — but **BLS12-381 + soroban-sdk 25** (wrong curve and SDK for us, since we need BN254 because of Poseidon). Useful only as a reference for the `proof.json`/`verification_key.json`/`public.json` format. | Format reference; **NOT** the basis of the attestor. |
| **`NethermindEth/stellar-private-payments`** (docs: `nethermindeth.github.io/stellar-private-payments`) | **`contracts/circom-groth16-verifier`** — a Groth16 verifier for **BN254 + sdk 26** using the host functions `env.crypto().bn254()` (`g1_mul`/`g1_add`/`pairing_check`); **`build.rs` + the `circuit-keys` crate** = the "circom2soroban" (reads `verification_key.json` via `VERIFIER_VK_JSON` → embeds `vk.rs`). Circuits `merkleProof.circom`/`merkleTree.circom` + `poseidon2/`. | **Real base for `solvency_attestor`** (Stage 4); piece **B** of the circuit; embedded-VK pattern. _Confirmed in the de-risking._ |
| **`stellar/rs-soroban-poseidon`** (crate `soroban-poseidon`) | Ready-made on-chain Poseidon/Poseidon2 (`poseidon_hash::<3, Bn254Fr>`); **BN254 = circomlib by construction** (sponge identical to `poseidon.circom`). Pointed to by the soroban-sdk docs themselves. | **On-chain Poseidon-Merkle root in `registry`** (Stage 1), matching the circuit without aligning constants by hand. _Runs on our VM — confirmed in the de-risking._ |
| **`NethermindEth/stellar-risc0-verifier`** | RISC Zero verifier (VerifierRouter by 4-byte selector, Groth16Verifier, TimelockController, EmergencyStop). `verify(journal, image_id, seal)`. _Unaudited._ | Track B (fallback). |
| **`jayz22/soroban-examples` (branch `p25-preview`)** | Examples of using the P25 host functions (BN254 `g1_add`/`g1_mul`/`pairing_check`, Poseidon `poseidon`/`poseidon2`). | On-chain API reference. |
| **`indextree/ultrahonk_soroban_contract`** | UltraHonk verifier (Noir/barretenberg path). | Only if we ever go Noir. |
| **soroban-sdk migration docs** — `_migrating/v25_bn254` and `v25_poseidon` (docs.rs) | The exact BN254 and Poseidon API in the contract. | Implementation of `solvency_attestor`. |
| **`stellar-protocol` CAP-0074 / CAP-0075** | Spec of the curve/hash host functions. | Background reference. |

---

## 6. Detailed technical architecture

### 6.1 End-to-end flow
```
[on-chain]                 [off-chain: prover service (Node/TS + snarkjs)]            [on-chain]
registry.guarantees_root() ─┐
vault.stable_assets()       ─┤→ build witness (list+paths B, bank+sig A,             solvency_attestor.attest(proof, public)
                             │   wallets+sig C) → snarkjs groth16 fullProve ────────→  ├─ verify Groth16 (BN254 pairing_check)
signed attestations (A,C)   ─┘   → proof.json + public.json                            ├─ check public.root == registry.guarantees_root() (live)
                                                                                       ├─ check public.stable == vault.stable_assets() (live)
                                                                                       ├─ check freshness (ledger/timestamp)
                                                                                       └─ write last_attestation{solvent, band, ledger, ts}
                                                                                                  │
frontend reads reads.solvencyAttestation() ←─────────────────────────────────────────────────────┘
```

### 6.2 Circuit specification (`solvency.circom`) — MVP A+B
**Public signals** (enter the on-chain verification):
- `guarantees_root` — Poseidon-Merkle root of the active guarantees (read from `registry`).
- `vault_stable_assets` — read from `vault` (binds the proof to the current on-chain state).
- `ratio_bps` — the proven band in basis points (e.g., `10000` = 100%, `12000` = 120%).
- `nonce` — anti-replay / freshness.

**Private signals** (witness, never leave):
- Piece **B**: the circuit receives **all active leaves** `(id, obligation)` and **recomputes the entire root** (depth-8, Poseidon), **requiring `== guarantees_root`**; it sums **all** the `obligations` → `obligations`. _Anti-omission: omitting a leaf changes the root, which then doesn't match the on-chain one. It does **not** use per-leaf inclusion proofs (which would not prevent omission)._
- Piece **A**: `bank_balance` + the bank oracle's EdDSA signature (embedded public key). Verifies the signature → adds to `reserves`.
- Piece **C** (stretch): `wallet_balances[]` + the custody oracle's EdDSA signature. Adds to `reserves`.

**Main constraint (the proof):**
```
reserves = vault_stable_assets + bank_balance + Σ wallet_balances
assert  reserves * 10000 >= obligations * ratio_bps
```
No secret output: the public signals already carry the statement ("at this root, in this vault state, at this band: solvent").

### 6.3 `solvency_attestor` contract (Soroban, base = Nethermind's `circom-groth16-verifier` — BN254)
```
attest(proof: Proof, public: PublicInputs) -> ()
  1. groth16_verify(EMBEDDED_VK, proof, public)           // BN254 pairing_check
  2. require(public.guarantees_root == registry.guarantees_root())   // anti stale/forged proof
  3. require(public.vault_stable_assets == vault.stable_assets())    // bind to current state
  4. require(env.ledger().timestamp() - public.nonce_ts <= WINDOW)   // freshness
  5. storage.set(last_attestation, Attestation{ solvent: true, ratio_bps: public.ratio_bps,
                                                ledger: env.ledger().sequence(), ts })

last_attestation() -> Attestation                          // public read for the frontend
```
The verification key (`verification_key.json`) is **embedded in the contract** at build time via Nethermind's `build.rs` + `circuit-keys` crate (env `VERIFIER_VK_JSON` → `vk.rs`); it is not a parameter — this guarantees that only proofs from our circuit pass.

### 6.4 `registry` — new `guarantees_root()` (piece B)
- Maintain a **Poseidon-Merkle** accumulator of the active guarantees (leaf = `Poseidon(id, obligation)`, with `obligation = monthly_amount*(months_covered-months_used)`; `active` is implicit because only active ones become leaves), updated on transitions (create/expire/settle) — respecting "only `policy` writes". On-chain hashing via the **`soroban-poseidon`** crate (`poseidon_hash::<3, Bn254Fr>`), which matches the circomlib `poseidon.circom` used in the circuit.
- Expose `guarantees_root() -> BytesN<32>` (public read). It is the "list seal" that the circuit and the attestor cross-check.
- Keep the tree reconstructible off-chain (private-payments' `coinutils` serves as a reference) so the prover can build the **complete leaf list** (in the order of `active_ids()`) that the circuit recomputes.
- **Depth:** `TREE_DEPTH = 5` (32 guarantees) in the MVP — it must match the circuit. Changeable later via a coordinated upgrade (registry + circuit/VK + attestor), without moving funds.
- **⚠️ Scalability (v2, post-MVP):** the current design is **full-recompute O(n)** per `put()` and per proof — it doesn't scale beyond ~thousands of guarantees. For 100k+ (e.g., 200k contracts in ~5 years), migrate to an **incremental Merkle Sum Tree**: each node stores the sum of the obligations below it (the **total lives in the root**, read O(1)) and each write updates only the leaf's path (O(depth), not O(n)). The ZK proof then proves the **reserves** side against the total proven in the root. Nethermind has a reference `smt/`. The modularity (swappable registry + `upgrade()`) allows this migration without moving money.

### 6.5 Prover service (off-chain, Node/TS + snarkjs)
1. Reads on-chain: guarantees + `guarantees_root`, `vault.stable_assets`.
2. Collects the privates: signed bank attestation (A), signed wallet snapshot (C), **complete leaf list** (B).
3. `snarkjs groth16 fullProve` (or WASM in the browser, as in private-payments) → `proof.json` + `public.json`.
4. Submits `solvency_attestor.attest(proof, public)`.
> At the hackathon, the oracle keys (bank/custody) are ours and the service can run via cron/manually. The README makes explicit what is simulated.

---

## 7. The three pieces (A / B / C)

### Piece A — Bank reserve (money off the blockchain)
- **What it is:** part of the reserve sits in a bank; the explorer doesn't see it. Piece A includes that money in the proof without showing the statement/account.
- **How to apply it (technical):** the bank oracle key signs `(balance, date, account_id)` with **EdDSA-Poseidon (circomlib)**. The circuit **verifies the signature** and adds the balance to `reserves`. `solvency_attestor` checks freshness.
- **Risks:** "garbage in, garbage out" (trusts the oracle) → freshness + Open Finance in the future; signature/key → protection/rotation; **simulated at the hackathon → declare it in the README**. If EdDSA in the circuit gets stuck: fall back to a **Poseidon commitment** of the balance (simpler).
- **Why it matters:** without A, you only prove the on-chain side — but MUTAV's real reserve partly lives in the bank. A makes the proof **faithful to reality**.

### Piece B — Guarantee / customer list (the obligations) 👑
- **What it is:** the contract/customer list (sensitive) stays **secret**, but it is proven that the equation used the **whole, true list** — without omitting anyone.
- **How to apply it (technical):** `registry.guarantees_root()` (Poseidon-Merkle) published on-chain. The inclusion circuit (reusing private-payments' `main.circom`) recomputes the root from the private leaves+siblings and **requires `== guarantees_root`**; it sums the obligations. `solvency_attestor` **re-checks the root live**.
- **Risks:** cheating by omission → **the root prevents it** (a tampered list won't match); stale root → update on every transition + freshness.
- **Why it matters:** **the crown jewel** — it turns a "typed-in number" into an **anti-tamper proof**, protects the customer (LGPD), and opens the path to **decluttering the `GuaranteeTable`** without losing trust. **It's the piece with the most ready-made code to reuse.**

### Piece C — The fund's set of wallets (the "map")
- **What it is:** sums the balance of several wallets **without revealing which** they are.
- **How to apply it (technical):** a signed snapshot (EdDSA) of the per-wallet balances enters as the witness; the circuit adds it to `reserves`; addresses never leave. (Strong version: proof of control, not just balance.)
- **Risks:** balance ≠ control → control becomes an improvement; addresses inferable from specific values → aggregate into bands; **scope → stretch goal** (first to cut).
- **Why it matters:** protects structure/security and enables a **distributed** reserve without exposing the map.

**Summary:** **A** makes the proof **real** (includes the bank), **B** makes the proof **honest** (anti-tamper + protects the customer), **C** makes the proof **complete** (all wallets).

---

## 8. Stages — Track A (Circom)

A **vertical** organization (one group of stages per component), each stage broken into
small, independent sub-steps — lego-style assembly, piece by piece. No dates: the
order is by dependency, not by the clock. Advance only when the **exit criterion** of the
sub-step closes.

**Why a Stage 0 before the vertical:** the biggest risk isn't any single component — it's the
toolchain (`circom2soroban` + BN254 `pairing_check` + the `poseidon` host function) not running
on our testnet deploy. A pure vertical only discovers that at the attestor (the 4th component).
Stage 0 is a thin, throwaway spike that proves Track A's viability **before**
investing in registry/circuit. After it, the components are independent legos.

**Single serial gate:** only **prover → attestor** is strictly sequential (the attestor
needs the VK produced by the circuit). Everything else parallelizes: the **front (Stage 5) can
start mocked** right away; **registry (Stage 1)** and **circuit (Stage 2)** are testable
in isolation (root on-chain on its own; local proof with snarkjs without the chain).

---

### Stage 0 — De-risking Track A (thin spike) ✅ DONE (Option B: local confirmation, no testnet)
- **0.1** ✅ Toolchain installed: **circom 2.2.3**, **snarkjs 0.7.6**, Node 25, **Stellar CLI 26.0.0**,
  Rust 1.96 + wasm32. (circom was a pre-compiled binary in `~/.cargo/bin`.)
- **0.2** ✅ Trivial circuit (`c = a*b`) → snarkjs (bn128) → `proof.json`/`public.json` →
  `snarkjs groth16 verify` = **OK**. The proving pipeline validated on the machine.
- **0.3** ✅ BN254 on the test VM: a mini-crate with `soroban-sdk 26.1.0` →
  `env.crypto().bn254()`. `cargo test` passed: curve arithmetic (`g1_is_on_curve`,
  `g1_add`, `g1_mul` → `G+G == 2G`) **and `pairing_check`** — the core of Groth16 —
  actually executing (tested from two angles: `e(G1,G2) ≠ 1` and bilinearity
  `e(G1,G2)·e(-G1,G2) = 1`, with the G2 generator in the host's Ethereum `c1||c0` format).
  **No special feature.** _(real testnet deploy → deferred to Stage 4)_
- **0.4** ✅ On-chain Poseidon: the **`soroban-poseidon`** crate (`poseidon_hash::<3, Bn254Fr>`)
  runs on the test VM and **matches the canonical circomlib vector** — `poseidon([1,2])` ==
  `0x115cc0f5…7189a` (an empirical cross-check, not just the README's word). This confirms the
  central invariant of Stage 1: on-chain root == circuit root. _(raw host fn:
  `CryptoHazmat::poseidon2_permutation`, feature `hazmat-crypto` — but we use the crate.)_
- **Exit achieved:** Track A viable and proven locally — toolchain, `pairing_check`, and
  Poseidon↔circomlib all with evidence. **Still open (deferred to Stage 4, by
  Option B's decision):** (a) the full *splice* — taking a real `proof.json` from snarkjs and
  verifying it inside a contract (vendoring the Nethermind piece); (b) testnet deploy;
  (c) **measuring the real instruction cost** (the "~40% of the budget" is from the plan, not yet measured).
- **Spike artifacts:** in `scratchpad/zk-spike/` (throwaway, outside the repo).

> **Corrections the de-risking brought to the plan (see Sections 5 and 6):**
> 1. Base verifier = Nethermind's `circom-groth16-verifier` (BN254 + sdk 26), **not** the
>    official `groth16_verifier` (that's BLS12-381 + sdk 25 — wrong curve and SDK for us).
> 2. "circom2soroban" = Nethermind's `build.rs` + `circuit-keys` crate (reads `verification_key.json`
>    via env `VERIFIER_VK_JSON` → generates the embedded `vk.rs`).
> 3. On-chain Poseidon = the `soroban-poseidon` crate (Stellar org), circomlib-compatible.

### Stage 1 — Piece B: anchoring the list in `registry` ✅ DONE
- **1.1** ✅ Leaf = `Poseidon(id, obligation)`, `obligation = monthly_amount*(months_covered-months_used)`
  (same equation as `coverage_required`). A binary tree of **fixed depth 8** (up to 256
  guarantees), leaves on the left, missing sibling = 0, parent = `Poseidon(left, right)`. Leaf
  order = order of `active_ids()`. Only **active** guarantees are leaves.
  _Conscious simplification:_ it doesn't filter `paid_until > now` (counts all active ones) → the proven
  obligation is an upper bound = the safe side; in the demo (guarantees up to date) it matches exactly.
- **1.2** ✅ `registry` recomputes the root on every `put()` via `soroban-poseidon`
  (`poseidon_hash::<3, Bn254Fr>`), respecting the writer-gating.
- **1.3** ✅ `guarantees_root() -> BytesN<32>` (in `interfaces` + `RegistryClient`, public read).
- **1.4** ✅ Off-chain reconstruction in `prover/merkle.mjs` (circomlibjs): `computeRoot` over the
  **complete leaf list** (order of `active_ids()`). No per-leaf inclusion proofs — the
  anti-omission comes from recomputing the entire root (see 6.2). `prover/derisk-merkle.mjs` prints the
  reference roots (n=2, n=3) used in the cross-checks.
- **1.5** ✅ On-chain `==` off-chain cross-check: the test `root_matches_offchain_circomlibjs` asserts
  that the `registry` root (soroban-poseidon) matches the circomlibjs one — **two independent Poseidon
  implementations agreeing**. Tests: `cargo +stable-x86_64-pc-windows-gnu test -p registry --lib` (4/4).
- **Exit:** on-chain list seal, reconstructible off-chain, without exposing the list. _Demoable on its own._

> **Environment note (Windows):** this machine doesn't have the MSVC linker; `rust-toolchain.toml`
> forces MSVC and the default build breaks. **Everything runs with the gnu toolchain** (which has a working linker):
> - **Host tests:** `cargo +stable-x86_64-pc-windows-gnu test -p <crate> --lib` (lib only —
>   `cargo test --workspace` blows up with "export ordinal too large" in the **native cdylib**).
> - **Wasm build for deploy:** `rustup target add wasm32v1-none --toolchain stable-x86_64-pc-windows-gnu`
>   once, then `RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu stellar contract build`. **No
>   MSVC needed** — the "export ordinal too large" is specific to the native cdylib, not the wasm target.
>   _(Confirmed in Stage 2.5: the 7 wasm built and the registry deployed to testnet.)_

### Stage 2 — `solvency.circom` circuit
Incremental: each sub-step compiles and proves locally (snarkjs, no chain).
- **2.0** ✅ Poseidon link verified: `circuits/leaf_check.circom` (circomlib `Poseidon(2)`)
  produces `Poseidon(0,600)` == `0x247c2fa2…` — **identical** to the `registry` leaf (soroban-poseidon)
  and to the off-chain one (circomlibjs). All three Poseidons match.
- **2.1** ✅ `circuits/solvency_b.circom`: recomputes the depth-5 root of the 32 leaves `(id, obligation, active)`
  and sums the obligations. **Verified:** the circuit root == the `registry` root (`0x2fc574f6…`) and sum = 1200
  in the n=2 case. ~32k constraints (light proof). Inactive leaf = 0; perfect tree (no odd padding).
  _Anti-omission binding:_ the root is a public signal; the attestor (Stage 4) checks `== guarantees_root` on-chain.
- **2.2** ✅ `circuits/solvency.circom`: bound root (`b.root === guarantees_root`) + reserves
  (`vault_stable_assets`) + band comparison (`reserves*10000 >= obligations*ratio_bps`, via
  `GreaterEqThan(200)`). **Verified:** accepts solvent; rejects insolvent, a tampered root, and an
  insufficient 120% band.
- **2.3** ✅ piece A: `EdDSAPoseidonVerifier` (circomlib) verifies the bank oracle's signature
  over `M = Poseidon(balance, nonce)` → adds `bank_balance` to the reserves (the balance never leaves). Publics:
  `nonce`, `oracle_Ax/Ay`. **Verified:** bank covering alone / combined are accepted; insolvent and
  a balance tampered post-signature are rejected. Signature generator: `circuits/gen_input.mjs` (the oracle's
  key is simulated/fixed). Circuit ~41k constraints.
- **finale** ✅ Real Groth16 proof generated and **verified off-chain** (`snarkjs groth16 verify` = OK):
  powers-of-tau 2^16 → `solvency_final.zkey` → `proof.json`/`public.json`/`verification_key.json`.
  The VK is embedded in the attestor (Stage 4).
- **2.4** _(stretch — first to cut)_ piece C: sum signed `wallet_balances[]` (same pattern as A).
- **Exit:** ✅ MVP **A+B** complete — `proof.json`/`public.json`/`verification_key.json` generated.

### Stage 2.5 — Testnet deploy (prerequisite for Stage 3 and Stage 4) ✅ DONE
Everything up to here ran **locally** (Stage 0 deferred the deploy on purpose). Both the prover
(Stage 3 reads real on-chain state) and the attestor (Stage 4 lives on-chain) need a
live deploy. That's why this step comes **before** Stage 3.

**Decision (registry-only):** the 2026-06-22 core (`vault`/`policy`/`registry`) was already
live and seeded, but the **admin is `GBE3QZQS…` — a key we don't have** (only `mutav-test` =
`GCG2L74G…`), so the live `registry` (without `guarantees_root`) **could not be `upgrade()`-d**.
Chosen way out: deploy a **new registry** under our admin and **reuse the existing vault**
(which we only need to *read* — `stable_assets` is permissionless). The new registry stays decoupled
from the old `policy` (writer = us); seeded directly via `put()`.

- **2.5.1** ✅ Wasm build with `stellar contract build` (NOT `cargo build --release` — soroban-sdk 26.1
  spec-shaking). ⚠️ **Windows:** **no MSVC needed** — just the **gnu** toolchain with the
  wasm target installed: `rustup target add wasm32v1-none --toolchain stable-x86_64-pc-windows-gnu`
  and then `RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu stellar contract build`. (The gnu toolchain has a working linker
  for the host proc-macros; the "export ordinal too large" only affects the **native cdylib** of
  `cargo test --workspace`, not the `wasm32v1-none` target. The earlier note that "the wasm build
  needs MSVC" was wrong — corrected here.)
- **2.5.2** ✅ Deploy of the new `registry` (admin = `mutav-test`) + `set_writer(mutav-test)`. Vault
  reused (no re-wire). **Contract IDs (testnet):**
  - **REGISTRY (new, with `guarantees_root`):** `CCIIYG572C5HUJKPDVSCYWAJNUUPOEEXKXIURA3DMAPTMETE3HHOU3FC`
  - **VAULT (existing, read-only):** `CCOIGCO7JTWHFDAEQPXDONJABKFP2PQ5OBDUWHBTASUPZ4EMFCNESICO`
  - **USDC SAC:** `CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6`
  - (old registry/vault/policy administered by `GBE3QZQS…`; `solvency_attestor` enters in Stage 4.)
- **2.5.3** ✅ Seed: 4 guarantees `[0,1,2,3]` mirroring the real book of the old deploy
  (obligations 18,000 + 12,000 + 4,800 + 14,400 = **49,200 USDC**). Vault `stable_assets` =
  **50,420 USDC** → solvent (~**102.5%**).
- **2.5.4** ✅ Live cross-check: on-chain `guarantees_root()` ==
  off-chain `prover/merkle.mjs` == `0x2962a3bbb708bf58677b8a51a5605c5d45d03c87981e11b790606ff4d3342231`.
- **Exit:** ✅ new registry deployed and seeded on testnet; `guarantees_root` + `stable_assets`
  ready for the prover (Stage 3) and the attestor (Stage 4).

> **⏳ PENDING — decision for when the `GBE3QZQS…` key is available** (admin of the
> 2026-06-22 core; see [[zk-testnet-deploy-state]]). The registry-only above is a **workaround** for the lack of that
> key: the new registry is seeded **by hand** (writer = us), so the anti-omission proves that the prover used
> the whole list *that is in the registry* — but the registry↔real-book fidelity is an **assumption**, not
> a chain guarantee. With the key in hand, eliminate the hand-seed and bind the proof to the REAL book written
> by the `policy`. Two routes:
> - **(A) Recommended — in-place `upgrade()` of the OLD registry.** Adding `guarantees_root()` is an **additive**
>   change (a new `DataKey::GuaranteesRoot` variant at the end of the enum; the `unwrap_or_else(compute_root)` fallback
>   already covers a registry that has guarantees but hasn't yet written the root). It keeps the `policy` as the writer → the root
>   then **tracks reality on its own**, without a manual copy. Afterwards, re-point the attestor + prover to the
>   old registry. **Verify before the upgrade:** preserved storage layout and `active_ids` already existing in the
>   old registry — this is the only risky decision (in-place upgrade requires a compatible layout).
> - **(B) Alternative — redeploy the whole core** (registry+policy+vault) under our key + re-wire
>   `policy → new registry` via `bootstrap.sh`. A clean slate, but more disruptive (re-deploy + handling the
>   vault's funds).
> **Team decision:** go with **(A)** if the old registry's layout is compatible; fall back to **(B)** if it isn't.
> jubscodes executes this decision during the review, with the key already in hand.

### Stage 3 — Prover service (Node/TS + snarkjs) ✅ 3.1–3.3 (3.4 awaits Stage 4)
Implemented in **`prover/prove.mjs`** (`npm run prove [bank_balance] [ratio_bps]`).
- **3.1** ✅ Reads on-chain (testnet, via `stellar contract invoke`): `registry.active_ids()` +
  `get(id)` per guarantee + `guarantees_root()`; `vault.stable_assets()`.
- **3.2** ✅ Builds the witness — B: real leaves in the order of `active_ids`, padded to 2^5; recomputes the
  root off-chain (`merkle.mjs`) and **fail-fast if != on-chain root**. A (option B): a **simulated** bank
  attestation with a balance, EdDSA-Poseidon signed by a fixed oracle key (same as `gen_input.mjs`).
- **3.3** ✅ `snarkjs groth16 fullProve` (wasm + the `solvency_final.zkey` from Stage 2) → `prover/out/`
  `proof.json`/`public.json`/`input.json` of **real data**. Re-verifies off-chain + checks the
  publics (`root`==on-chain, `stable`==on-chain, `ratio`). _Real run:_ obl. 49,200 + vault
  reserves 50,420 + sim. bank 10,000 → **coverage 122.8%**, green proof.
- **3.4** ✅ Submit to the attestor: `prover/encode-for-soroban.mjs` converts `proof.json`/`public.json`
  → proof 256 bytes + publics; `attest` submitted on testnet (tx `355bee82…`) → `last_attestation`
  written. `nonce` is now a timestamp (freshness). _(integration gate closed.)_
- **Exit:** ✅ real-data proof generated **and verified on-chain**.

### Stage 4 — `solvency_attestor` (Soroban) ✅ DONE
Crate `contracts/solvency-attestor`. Attestor on testnet:
**`CBYXNYYZRD5SOBU3HP5GWV7I64GISOF5H4SWN2UTXZ7FIF6LSVII36MT`** (admin=`mutav-test`,
wired to registry `CCIIYG57…` + vault `CCOIGCO7…` + fixed oracle).
- **4.0** ✅ Leanly vendored Nethermind's `circom-groth16-verifier` (BN254): `build.rs`
  embeds the `verification_key.json` as consts (only `serde_json`+`num-bigint`, no `ark-*`/`circuit-keys`).
- **4.1** ✅ `groth16_verify` (BN254 `pairing_check`) with the **embedded** VK. **Splice closed:** a host
  test verifies the REAL snarkjs proof INSIDE the contract (the open item from Stage 0).
- **4.2** ✅ Live cross-check **implicit**: `attest` reads `registry.guarantees_root()` and
  `vault.stable_assets()` LIVE and uses them as publics — a proof made for another state doesn't verify.
- **4.3** ✅ Freshness: `nonce` = a timestamp signed by the oracle; window `WINDOW_SECS=3600`
  (`StaleProof`/`ProofFromFuture`). **Pinning the oracle pubkey** in storage (`set_oracle`) closes the
  forgery of piece A (findings 1 and 2 from the Stage 3 review).
- **4.4** ✅ Writes/exposes `last_attestation -> Option<Attestation{solvent, ratio_bps, ledger, ts}>`.
  _Real attestation written:_ `{solvent:true, ratio_bps:10000, ledger:3249257, ts:1782260148}`.
- **4.5** ✅ Deploy + real submit on testnet. **Measured cost:** ~**37.96M instructions** (~38% of a 1-tx
  budget — matches the "~40%" estimate); `minResourceFee` ≈ 45,424 stroops. _(the last 2 open
  items from Stage 0 — deploy and cost measurement — closed.)_
- **Exit:** ✅ the "green light" lives on-chain and is re-verifiable; the prover→attestor cycle is complete.

### Stages 0–4 review — fixes applied (post full-cycle)
Cross-review with the entire path live. End-to-end consistency of encoding/order
**proven** by the real `attest` passing on-chain; binding to the live state **proven adversarially**
(wrong nonce/ratio → `InvalidProof`; control → `Ok`). Fixes applied and **deployed via
`upgrade()`** (registry `CCIIYG57…` + attestor `CBYXNYYZ…`; storage preserved, root and
`last_attestation` intact):
- **#1 [HIGH soundness]** `registry.put()` rejects the `2^TREE_DEPTH+1`-th active guarantee.
  Above capacity, `compute_root` silently truncated the root (excess leaves disappear
  from the root AND from the sum → false solvency by omission). It now fails loud. _(Confirmed empirically:
  `root(33)==root(32)`.)_ Test `put_rejects_beyond_tree_capacity`.
- **#2 [MED]** the attestor extends the instance storage TTL (`attest` + setters) — the seal doesn't expire.
- **#3** the attestor emits an `attested` event (confirmed on-chain) — the front reacts without polling.
- **#4** note: the embedded VK and `solvency_final.zkey` are a pair — keep them in sync (Stage 7).
- **#7** the prover saturates `obligationOf` (>=0) just like the registry's `leaf()`.
- _Not applied:_ **#5** (replay — not a vector: idempotent vs. live state) and **#6** (embedding the
  oracle in the VK — requires circuit + regenerating VK/zkey/proof + redeploy; stretch).
- **Observation (scale):** the O(n) recompute per `put` (section 6.4) already weighs heavily near capacity 32
  (in the test, 32 cumulative puts blow the `Env` budget); the cap (#1) limits the worst case. The
  migration to an incremental Merkle Sum Tree (6.4) remains the v2 path.

### Stage 5 — Seal on the dashboard (Investor front)
Can start **mocked** in parallel with stages 1–4.
- **5.1** `reads.solvencyAttestation()` in `lib/contracts.ts` (mock until the attestor is live).
- **5.2** `ZkSolvencyBadge` above the `SolvencyChip` in `transparency/page.tsx` (the
  `loading`/`error` pattern; Precision Brutalism; the `impeccable` skill).
- **5.3** "How does it work?" drawer + honest red state + "re-verify it yourself".
- ⚠️ read `node_modules/next/dist/docs/` **before** coding (breaking changes — see `frontend/AGENTS.md`).
- **Exit:** a functional seal reading the attestor.

### Stage 6 — Robustness + anti-tamper scenario ✅ (6.1+6.2; 6.3 cut)
Reproducible demo in **`prover/anti-tamper.mjs`** (`npm run anti-tamper [bank] [ratio] [--submit]`),
reading the real testnet state. The four signals, verified live:
- **6.1** ✅ HONEST → complete list + real root → proof verifies off-chain (coverage 122.8%) → **green seal**.
- **6.2** ✅ Anti-tamper, two angles:
  - **Omission + REAL root:** hiding the largest guarantee (liability 492,000 → 312,000) while keeping the
    on-chain `guarantees_root` → the proof is **IMPOSSIBLE to generate** (the circuit requires
    `b.root === guarantees_root`; tampered leaves recompute a different root → the constraint fails at line 110).
  - **Omission + FAKE root:** tamper with the leaves AND the public root together → the proof does generate (fake root
    `0x264bc63c…` ≠ real root `0x2962a3bb…`). With `--submit`, the forged proof was sent to the attestor
    and **reverted on-chain (`InvalidProof`)** — the attestor reads the REAL root live. **Red seal. Cheating blocked.**
  - _(Insolvency → red is already covered by `prove.mjs`'s pre-check: with no reserves, `fullProve` doesn't even generate.)_
- **6.3** ✂️ piece **C** (wallets) — stretch, cut without breaking the demo (A+B is the award-worthy MVP).
- **Exit:** ✅ a round, attack-proof flow, demonstrable with a single command.

### Stage 7 — README + delivery
- Architecture, real vs. simulated, how to run/re-check; clean up the repo; submit.
- **⚠️ VK↔zkey reminder (indivisible pair):** `circuits/verification_key.json` (versioned, embedded in the
  attestor via `build.rs`) and `circuits/solvency_final.zkey` (**NOT** versioned — ~19MB, gitignored) are a
  PAIR from **one** trusted setup. Touching the circuit OR redoing the setup invalidates the pair → the attestor starts
  rejecting valid proofs. When regenerating, regenerate the entire chain AND re-deploy the attestor's wasm:
  ```
  circom solvency.circom --r1cs --wasm --sym -l node_modules -p bn128
  snarkjs groth16 setup solvency.r1cs pot16_final.ptau solvency_0.zkey
  snarkjs zkey contribute solvency_0.zkey solvency_final.zkey -e="..."
  snarkjs zkey export verificationkey solvency_final.zkey verification_key.json
  # test fixture: node gen_input.mjs 0 10000 2000 → (gen witness → groth16 prove) →
  #   node ../prover/encode-for-soroban.mjs . --rust > ../contracts/solvency-attestor/src/test_fixture.rs
  # finally: stellar contract build (new wasm with new VK) + upgrade() on CBYXNYYZ…
  ```
  Existing sensor: the test `verifies_real_snarkjs_proof` breaks if the embedded VK diverges from the `proof.json`
  fixture. Since the `zkey` doesn't go into the repo, the README **must** say how to regenerate it (only the VK travels).

---

**Guaranteed MVP:** **A + B** (Stages 0–6 without the C sub-step) is already an award-worthy project.
**C** is stretch — first to cut, without breaking the demo.

## 9. The seal on the dashboard (Investor front)

The `ZkSolvencyBadge` component, above the `SolvencyChip` in `transparency/page.tsx`:

```
🟢  RESERVE PROVEN · BACKING VERIFIED
The fund's reserves cover 100%+ of the issued guarantees —
independently proven, without exposing wallets or customer data.
Your mtvR shares are backed.
Checked: a few minutes ago
[ Re-verify now ]   [ How does it work? ▾ ]
```

**UX (abstract away the blockchain):**
- The default view has no hashes/addresses/ledger — just the state (🟢/🔴), a sentence in PT, the band, a friendly date.
- "How does it work? ▾" → 3 simple bullets, no ZK jargon.
- "Technical details" (in the drawer) → a link to the `solvency_attestor` on the explorer + a "re-verify it yourself" button (preserving the self-verification the page already has).
- An honest red state if the proof failed/expired ("coverage not confirmed at the moment").

**Technical fit:**
- `lib/contracts.ts`: a new read `reads.solvencyAttestation()` → `last_attestation`.
- `ZkSolvencyBadge` follows the page's `loading`/`error` pattern; Precision Brutalism visual (Investor front) + the `impeccable` skill.
- ⚠️ `frontend/AGENTS.md`: this version of Next.js has breaking changes — **read `node_modules/next/dist/docs/` before coding the component**.

## 10. General risks
1. **Toolchain getting stuck** → Day 1 dedicated to de-risking Track A; RISC Zero fallback (Track B) for whatever gets stuck.
2. **Signature in the circuit (A/C)** → fall back to a Poseidon commitment, simpler.
3. **Simulated attestations** (bank/wallet) → normal and accepted; declared in the README (real = the proof's math + on-chain verification).
4. **Instruction budget** → one aggregated proof per attestation; a lean attestor (~40% of the budget per pairing).
5. **Scope** → A+B is the MVP; C is cuttable without breaking the demo.

## 11. Components to build (map)
- `contracts/registry`: + Poseidon-Merkle accumulator + `guarantees_root()`.
- `circuits/solvency.circom`: full Merkle root recomposition (B) + EdDSA (A/C) + sum + band comparison. _(reuses the Poseidon/hashing from private-payments' `main.circom` + circomlib's `eddsaposeidon`.)_
- `prover/` (Node/TS + snarkjs): reads testnet + attestations; generates `proof.json`/`public.json`; calls `attest`.
- `contracts/solvency_attestor` (Soroban, base `groth16_verifier`): verifies Groth16, checks root/stable/freshness, writes `last_attestation`.
- `frontend`: `ZkSolvencyBadge` + `reads.solvencyAttestation()` in `transparency/page.tsx`.

## 12. References
**Repos / templates**
- soroban-examples (groth16_verifier): https://github.com/stellar/soroban-examples/tree/main/groth16_verifier
- Stellar Private Payments (Nethermind): https://github.com/NethermindEth/stellar-private-payments — docs: https://nethermindeth.github.io/stellar-private-payments/
- RISC Zero verifier (Nethermind): https://github.com/NethermindEth/stellar-risc0-verifier
- P25 preview examples: https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview
- UltraHonk verifier (Noir): https://github.com/indextree/ultrahonk_soroban_contract
- soroban-sdk BN254: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html
- soroban-sdk Poseidon: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_poseidon/index.html

**Specs / blogs / docs**
- Prototyping Privacy Pools on Stellar (design): https://stellar.org/blog/ecosystem/prototyping-privacy-pools-on-stellar
- RISC Zero verifier (step by step): https://stellar.org/blog/developers/risc-zero-verifier
- Protocol 25 "X-Ray": https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25
- 5 real-world ZK use cases (SDF): https://stellar.org/blog/developers/5-real-world-zero-knowledge-use-cases
- Official ZK docs on Stellar: https://developers.stellar.org/docs/build/apps/zk
- CAP-0074 (BN254): https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md
- Hackathon: https://dorahacks.io/hackathon/stellar-hacks-zk/detail

**ZK tools**
- Circom: https://docs.circom.io · snarkjs: https://github.com/iden3/snarkjs · circomlib: https://github.com/iden3/circomlib
- Noir: https://noir-lang.org/docs/ · RISC Zero: https://dev.risczero.com/

---

## Appendix A — Stage 0 de-risking spike (code + results)

> Record of the Option B de-risking (local confirmation, no testnet). The code ran in
> `scratchpad/zk-spike/` (throwaway, deleted after documentation). Reproducible with the
> toolchain below. Everything passed.

### A.0 Confirmed toolchain
| Tool | Version |
|---|---|
| circom | 2.2.3 (pre-compiled binary in `~/.cargo/bin`) |
| snarkjs | 0.7.6 |
| Node | 25.9.0 |
| Stellar CLI | 26.0.0 |
| Rust / target | 1.96.0 / `wasm32v1-none` |
| soroban-sdk (in the test) | 26.1.0 |
| soroban-poseidon | 26.0.0 (`git: stellar/rs-soroban-poseidon`) |

### A.1 Part 1 — the circom + snarkjs pipeline generates/validates a BN254 proof

Trivial circuit (`multiplier.circom`):
```circom
pragma circom 2.0.0;
template Multiplier() {
    signal input a;   // private
    signal input b;   // private
    signal output c;  // public
    c <== a * b;
}
component main = Multiplier();
```

Pipeline (bn128 curve = BN254):
```bash
circom multiplier.circom --r1cs --wasm --sym -p bn128
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau -e="..."
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau
snarkjs groth16 setup multiplier.r1cs pot12_final.ptau multiplier_0000.zkey
snarkjs zkey contribute multiplier_0000.zkey multiplier_final.zkey -e="..."
snarkjs zkey export verificationkey multiplier_final.zkey verification_key.json
echo '{"a":"3","b":"11"}' > input.json
node multiplier_js/generate_witness.js multiplier_js/multiplier.wasm input.json witness.wtns
snarkjs groth16 prove multiplier_final.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
```

**Result:** `public.json = ["33"]` (only the public `c` leaked; `a=3`/`b=11` stayed secret)
and `[INFO] snarkJS: OK!` — a valid proof.

### A.2 Part 2 — BN254 + Poseidon on-chain on soroban-sdk 26.1.0

`Cargo.toml` (deps):
```toml
[dependencies]
soroban-sdk = "26.1.0"
soroban-poseidon = { git = "https://github.com/stellar/rs-soroban-poseidon" }
[dev-dependencies]
soroban-sdk = { version = "26.1.0", features = ["testutils"] }
```

Tests (`src/lib.rs`, abridged) — 3 independent checks:
```rust
// (1) Curve arithmetic: generator on the curve + G + G == 2*G.
#[test] fn bn254_curve_ops_work() {
    let env = Env::default(); let bn = env.crypto().bn254();
    let g = g1_gen(&env);                       // generator G1 = (1, 2)
    assert!(bn.g1_is_on_curve(&g));
    let two = Bn254Fr::from_u256(U256::from_u32(&env, 2));
    assert_eq!(bn.g1_add(&g, &g).to_array(), bn.g1_mul(&g, &two).to_array());
}

// (2) pairing_check (the core of Groth16) actually runs — tested from two sides.
#[test] fn bn254_pairing_check_real() {
    let env = Env::default(); let bn = env.crypto().bn254();
    let (g1g, g2g, neg) = (g1_gen(&env), g2_gen(&env), g1_neg_gen(&env));
    assert!(!bn.pairing_check(vec![&env, g1g.clone()], vec![&env, g2g.clone()])); // e(G1,G2) != 1
    assert!( bn.pairing_check(vec![&env, g1g, neg], vec![&env, g2g.clone(), g2g])); // bilinearity = 1
}

// (3) on-chain Poseidon matches the circomlib canonical vector: poseidon([1,2]) with t=3.
#[test] fn poseidon_matches_circomlib() {
    use soroban_poseidon::poseidon_hash;
    let env = Env::default();
    let h = poseidon_hash::<3, Bn254Fr>(&env, &vec![&env, U256::from_u32(&env,1), U256::from_u32(&env,2)]);
    let expected = U256::from_be_bytes(&env,
        &Bytes::from(bytesn!(&env, 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a)));
    assert_eq!(h, expected); // == 7853200120776062878684798364095072458815029376092732009249414926327459813530
}
```

Encoding details confirmed in the de-risking (useful for Stage 1/4):
- **G1**: `x || y`, each `Fp` big-endian (32+32 = 64 bytes).
- **G2**: the host's Ethereum format → `c1 || c0` per `Fp2`, each `Fp` big-endian (4×32 = 128 bytes).
  (ref. `soroban-env-host` `crypto/bn254.rs`, ~lines 99-102.)
- **-G1** of `(1,2)` = `(1, p-2)`, `p` = the BN254 base field prime.
- Poseidon: `CryptoHazmat::poseidon2_permutation` is the raw host fn (feature `hazmat-crypto`);
  we use the `soroban-poseidon` crate (`poseidon_hash::<3, Bn254Fr>`), which matches circomlib.

**Result (`cargo test`):**
```
running 3 tests
test bn254_curve_ops_work ... ok
test poseidon_matches_circomlib ... ok
test bn254_pairing_check_real ... ok
test result: ok. 3 passed; 0 failed
```

### A.3 De-risking conclusion
Track A viable and proven locally (toolchain, `pairing_check`, Poseidon↔circomlib).
**Open for Stage 4** (by Option B's decision): the full splice (a real snarkjs proof
verified inside a Soroban contract), testnet deploy, and the real measurement of the instruction
cost (the "~40% of the budget" remains unmeasured).
