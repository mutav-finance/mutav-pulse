# Frontend contract bindings

TypeScript clients generated from the **deployed** Soroban contracts. Each is a
workspace package (`file:./bindings/<name>` in `frontend/package.json`) imported
by name (e.g. `import { Client } from "vault"`).

> ⚠️ **A binding is a snapshot of one specific deployed contract's method surface.**
> If the deployed contract's ABI changes (a redeploy with a different method
> signature), the binding **and** the env contract ID must be regenerated/updated
> **together**. A mismatch fails only at call time, on-chain, with a cryptic error.
>
> This bit us once: `lib/tx.ts` calls the **4-arg** SEP-0056 `deposit(assets,
> receiver, from, operator)` (the shape the `vault` binding was generated from),
> while `.env.local` had drifted to an **older 2-arg** `deposit(from, amount)`
> vault. Reads worked; deposits would have failed. Fix was to repoint the env at
> the binding-matching vault. **Keep the table below in sync.**

## Bindings we must ensure

| Binding    | Env var (contract ID)      | Maps to                         | Consumed by                          |
| ---------- | -------------------------- | ------------------------------- | ------------------------------------ |
| `vault`    | `NEXT_PUBLIC_VAULT_ID`     | SEP-0056 reserve vault          | `lib/contracts.ts` (reads), `lib/tx.ts` (deposit/redeem/claim/cancel) |
| `policy`   | `NEXT_PUBLIC_POLICY_ID`    | underwriting policy             | `lib/contracts.ts` (coverage, guarantees) |
| `registry` | `NEXT_PUBLIC_REGISTRY_ID`  | guarantee registry              | `lib/contracts.ts` (active ids)      |
| `faucet`   | `NEXT_PUBLIC_FAUCET_ID`    | **testnet-only** demo faucet    | `lib/onramp.ts` (`drip`)             |

All four must point at the **same deploy generation**. The SEP-0056 set
(vault / policy / registry) is seeded together — mixing a vault from one deploy
with a policy/registry from another shows inconsistent reserve/coverage data.

`faucet` is **testnet-only**. On mainnet leave `NEXT_PUBLIC_FAUCET_ID` empty:
`faucetEnabled` (in `lib/config.ts`) is `false` off-testnet, so the on-ramp UI
never renders and the binding is never called. Mainnet uses real USDC.

> The USDC SAC (`NEXT_PUBLIC_USDC_ID`) and its classic asset
> (`NEXT_PUBLIC_USDC_CODE` / `NEXT_PUBLIC_USDC_ISSUER`) are **not** bindings — the
> SAC is read/transacted via `@stellar/stellar-sdk` directly (token client +
> `change_trust`), not a generated client.

## Regenerating a binding (after a redeploy or ABI change)

```bash
# from repo root; <NAME> ∈ {vault, policy, registry, faucet}, <ID> = the deployed contract
stellar contract bindings typescript \
  --network testnet --contract-id <ID> \
  --output-dir frontend/bindings/<NAME> --overwrite
(cd frontend/bindings/<NAME> && bun install && bun run build)
```

Then update the matching `NEXT_PUBLIC_*_ID` in `.env.local` (and `.env.example`),
restart `bun dev`, and re-verify the affected flow. After a full
`bootstrap.sh` redeploy, regenerate every binding whose method surface changed
(the vault's is baked in; policy/registry usually only change ID).
