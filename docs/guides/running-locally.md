# Running locally

The full local development loop: contracts (test + build) and frontend (install, dev, test, build).

## Prerequisites

- **Rust** — stable toolchain with the `wasm32v1-none` target (installed by the Stellar CLI when building).
- **Stellar CLI** (`stellar`) — required for the wasm build. Contracts are built with `stellar contract build`, NOT raw `cargo build --release`: soroban-sdk 26.1 spec-shaking needs the CLI.
- **Bun** — package manager and test runner for the frontend.

## Contracts

The Rust workspace lives in `contracts/`. Run the tests and produce wasm from the repository root.

```bash
# Whole-workspace unit tests (135 tests)
cargo test

# Build wasm via the Stellar CLI (equivalent to `make build`)
stellar contract build
```

Tests use `e.mock_all_auths_allowing_non_root_auth()`. Build artifacts land under `target/wasm32v1-none/release/`.

Other Make targets:

```bash
make build            # stellar contract build
make test             # cargo test
make fmt              # cargo fmt --all
make clean            # cargo clean
```

## Frontend

The Next.js 16 app lives in `frontend/`.

### Install and run

```bash
cd frontend
cp .env.example .env.local   # pre-filled with the live testnet contract IDs
bun install
bun dev                       # → http://localhost:3000/earn
```

### Test

```bash
bunx vitest run               # 28 tests
```

Test files live in `lib/*.test.ts` and cover format helpers, APY estimation, and queue logic.

### Build

```bash
bun run build                 # runs `next build`; must pass before deploying
```

## Where the env vars come from

`frontend/.env.example` is pre-filled with the live testnet deploy (committed `2026-06-23`, SEP-0056 + realistic seed). All variables are prefixed `NEXT_PUBLIC_` and are safe to expose to the browser — the frontend holds no private keys.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint (`https://soroban-testnet.stellar.org`) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Stellar network passphrase (`Test SDF Network ; September 2015`) |
| `NEXT_PUBLIC_EXPLORER_BASE` | Stellar Explorer base URL (`https://stellar.expert/explorer/testnet`) |
| `NEXT_PUBLIC_VAULT_ID` | Deployed vault contract address (`C…`) |
| `NEXT_PUBLIC_POLICY_ID` | Deployed policy contract address |
| `NEXT_PUBLIC_REGISTRY_ID` | Deployed registry contract address |
| `NEXT_PUBLIC_USDC_ID` | USDC SAC address the vault settles in |

Additional optional vars in `.env.example` gate the BRL-native (MBRL / cBRL) reserve and its faucet UI; leave them blank to keep that reserve in the non-live ("planned") state.

For the current deployed contract addresses, see [../reference/deployments.md](../reference/deployments.md).

To produce your own deploy and obtain fresh values, see [deploying-and-wiring.md](deploying-and-wiring.md).
