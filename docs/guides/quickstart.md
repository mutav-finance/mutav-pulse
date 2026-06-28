# Quickstart

The fastest path to a first successful interaction: run the contract tests, then point the frontend at the already-live testnet deploy.

No deploy is required. The frontend ships with `.env.example` pre-filled with the live testnet contract IDs, so you can interact with the protocol immediately after install.

## 1. Clone the repository

```bash
git clone https://github.com/mutav-finance/mutav-pulse.git
cd mutav-pulse
```

## 2. Run the contract tests

Confirm the Soroban workspace is green before touching anything else.

```bash
cargo test            # 135 unit tests
```

All tests should pass. This exercises the vault / policy / registry / strategy modules end to end (custody, solvency invariant, premium accrual, default coverage).

## 3. Configure the frontend environment

The example env is pre-filled with the live testnet vault, policy, registry, and USDC SAC addresses — copy it as-is.

```bash
cd frontend
cp .env.example .env.local
```

You do not need to edit any values to use the live deploy. The `NEXT_PUBLIC_VAULT_ID`, `NEXT_PUBLIC_POLICY_ID`, `NEXT_PUBLIC_REGISTRY_ID`, and `NEXT_PUBLIC_USDC_ID` are already set to the seeded testnet contracts.

## 4. Install and run the frontend

```bash
bun install
bun dev               # → http://localhost:3000/earn
```

## 5. Open the app

Open [http://localhost:3000/earn](http://localhost:3000/earn). This is the investor front (deposit / redeem, NAV hero, position, redemption queue), wired live to the testnet reserve. Connect a Stellar testnet wallet via Stellar Wallets Kit to deposit and redeem.

Other routes:

- `/earn/transparency` — reserve dashboard: solvency, metrics, guarantee registry, yield venues, verification.
- `/protocol` — operator cockpit: reserve health + protocol write actions.

## Next steps

- [running-locally.md](running-locally.md) — the full local dev loop (prerequisites, contract build, vitest, frontend build).
- [deploying-and-wiring.md](deploying-and-wiring.md) — redeploy and setter-wire every contract from scratch, plus wiring the DeFindex adapter.
