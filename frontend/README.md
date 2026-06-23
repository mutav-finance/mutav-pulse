# mutav-pulse frontend

Next.js 16 frontend for the **Mutav Pulse** SGR reserve vault testbed. Connects to Stellar Soroban testnet contracts, Stellar Wallets Kit, and the three TGA brand fronts.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (OKLCH tokens, Precision Brutalism system)
- **Bun** package manager and test runner
- **Stellar Wallets Kit** — wallet connection (no Privy, no injected keys)
- **Soroban contract bindings** — generated via `stellar contract bindings typescript`

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | Soroban RPC endpoint (e.g. `https://soroban-testnet.stellar.org`) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Stellar network passphrase (`Test SDF Network ; September 2015` for testnet) |
| `NEXT_PUBLIC_EXPLORER_BASE` | Stellar Explorer base URL (e.g. `https://stellar.expert/explorer/testnet`) |
| `NEXT_PUBLIC_VAULT_ID` | Deployed vault contract address (Stellar `C…` address) |
| `NEXT_PUBLIC_POLICY_ID` | Deployed policy contract address |
| `NEXT_PUBLIC_REGISTRY_ID` | Deployed registry contract address |
| `NEXT_PUBLIC_USDC_ID` | USDC SAC address the vault settles in |

All variables are prefixed `NEXT_PUBLIC_` and are safe to expose to the browser. No private keys are held by this frontend.

## Development

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
bunx vitest run
```

Test files live in `lib/*.test.ts` and cover format helpers, APY estimation, and queue logic.

## Build

```bash
bun run build
```

Runs `next build`. The build must pass before deploying.

## Deploying to Vercel (team `mutav`)

1. **Create the project** on [Vercel](https://vercel.com) under team `mutav`.
2. **Set root directory** to `frontend/` (this directory), or deploy from the monorepo root with the framework preset pointing here.
3. **Set env vars** in the Vercel dashboard (Settings → Environment Variables) — all `NEXT_PUBLIC_*` from the table above.
4. **Attach a domain** — e.g. `pulse.mutav.finance`. The wildcard `* ALIAS` on the Vercel DNS zone for `mutav.finance` means any subdomain resolves automatically; just attach it in the Vercel project and Vercel issues the cert.
5. **Deploy** — push to `main`; Vercel picks up the build automatically.

> **Note:** `mutav.finance` DNS is hosted on Vercel (nameservers `ns1/ns2.vercel-dns.com`). A wildcard ALIAS covers all subdomains — no per-app DNS record needed. HTTPS is provisioned automatically by Vercel on domain attach.

## Routes

| Route | Front | Description |
|---|---|---|
| `/earn` | Investidor (dark/amber) | Deposit / Redeem — NAV hero + position + queue |
| `/earn/transparency` | Investidor | Reserve dashboard — solvency, metrics, guarantee registry, yield venues, verification |
| `/protocol` | Terminal (dark/copper) | Admin cockpit — reserve health + all protocol write actions |

## Design system

Tokens sourced from `.design/branding/tga/` (vendored from `mutav-finance/brand`). Do not edit brand files inside this repo — update via `cd ../brand && bun brand:import mutav-pulse`.

Key token rules:
- **Amber (`#E8A020`)** — accent, <5% of pixels. Logo, active nav state, APY highlight, CTA only.
- **Copper** — terminal front ops register accent.
- **No shadows, no rounded corners, no gradients** — Precision Brutalism.
- Three-layer typography: **Geist Bold** (declaration), **Inter** (explanation), **JetBrains Mono** (evidence/data).
