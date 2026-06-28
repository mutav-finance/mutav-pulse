---
name: defindex-api
description: End-to-end playbook for integrating the Defindex REST API. Covers authentication (register → login → API key), all vault endpoints (deposit, withdraw, balance, APY, discover), vault administration (roles, rebalance, fees, rescue, upgrade), factory endpoints (create-vault), the /send endpoint, rate limits, and error handling. Use when building apps that call api.defindex.io directly, or when debugging API responses.
user-invocable: true
argument-hint: "[task or topic: auth|vault|deposit|withdraw|admin|factory|send|rate-limits]"
---

# Defindex API Skill

## What this Skill is for

Use this Skill when the user asks about:
- Authenticating with the Defindex API (register, login, API keys)
- Calling any `api.defindex.io` endpoint from TypeScript, Python, or any HTTP client
- Depositing into or withdrawing from a Defindex vault via REST
- Getting vault info, balance, APY, or discovering all vaults
- Administering a vault: roles, rebalance, fees, rescue, pause/unpause strategies, upgrade WASM
- Creating new vaults via the factory
- Submitting signed XDR transactions via `/send`
- Understanding rate limits and tier configurations
- Debugging 401, 403, 429, or 400 errors from the Defindex API

## What this Skill is NOT for

- Bridging USDC from Base → Stellar (→ use `defindex-bridge` skill)
- General Stellar / Soroban contract development (→ use `stellar-dev` skill)
- Building DeFindex strategies on-chain (→ see strategy-developers docs)

---

## Quick Decision: Which sub-file?

| Need | Sub-file |
|---|---|
| Register, login, API key generation, token refresh | [auth.md](auth.md) |
| Public endpoints: health, discover, strategies, factory address | [endpoints.md](endpoints.md) — Section 1 |
| User operations: vault info, balance, APY, deposit, withdraw, send | [endpoints.md](endpoints.md) — Section 2 |
| Vault admin: roles, rebalance, fees, rescue, pause, upgrade | [endpoints.md](endpoints.md) — Section 3 |
| Factory: create-vault, create-vault-deposit, create-vault-auto-invest | [endpoints.md](endpoints.md) — Section 4 |

---

## Base URL & Auth Header

```
Base URL:  https://api.defindex.io
Auth:      Authorization: Bearer <API_KEY>
```

Public endpoints (marked in endpoints.md) do not require auth.
All other endpoints require the `Authorization: Bearer <API_KEY>` header.

---

## XDR Flow (deposit / withdraw / admin operations)

All write operations return an **unsigned Soroban XDR** that must be signed by the user's wallet before submission:

```
POST /vault/{addr}/deposit        →  { xdr: "AAAA..." }   (unsigned)
  ↓ sign with Stellar wallet (Freighter, Privy, Crossmint…)
POST /send?network=mainnet        →  { txHash, success, ledger, … }
```

---

## Rate Limits (Token Bucket)

| Tier | Burst | Sustained |
|---|---|---|
| DEFAULT / unauthenticated | 5 req | 1 req/s |
| FREE | 5 req | 1 req/s |
| STARTER | 20 req | 10 req/s |
| PROFESSIONAL | 100 req | 50 req/s |
| BUSINESS | 200 req | 100 req/s |

Response headers on every request:
- `X-RateLimit-Limit` — bucket size
- `X-RateLimit-Remaining` — tokens remaining
- `X-RateLimit-Reset` — seconds until reset

On `429`: read `retryAfter` (seconds) from the JSON body, back off, and retry.

```ts
if (res.status === 429) {
  const { retryAfter } = await res.json();
  await new Promise(r => setTimeout(r, retryAfter * 1000));
}
```

---

## Network Values

| Value | Description |
|---|---|
| `mainnet` | Stellar Public Network |
| `testnet` | Stellar Testnet |

Always pass `?network=mainnet` or `?network=testnet` as a query parameter.

---

## Quick Routing

- Register / login / API key → [auth.md](auth.md)
- All endpoints → [endpoints.md](endpoints.md)

---

## Keywords

defindex, api.defindex.io, api key, register, login, vault, deposit, withdraw,
withdraw-shares, balance, apy, discover, send, xdr, stellar, soroban, rate-limit,
429, 401, 403, bearer token, dfTokens, stroops, network, testnet, mainnet,
rebalance, rescue, pause, unpause, fees, lock-fees, release-fees, distribute-fees,
factory, create-vault, upgrade, wasm, roles, manager, emergency-manager,
rebalance-manager, fee-receiver, strategies, TVL
