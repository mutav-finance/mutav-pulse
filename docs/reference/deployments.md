# Testnet deployments

Live contract addresses and network configuration for the mutav-pulse reserve on
Stellar testnet. These are testnet artifacts — a redeploy (`bootstrap.sh`) issues
new contract IDs.

## Network

| Field | Value |
|---|---|
| Network | Stellar testnet |
| RPC URL | `https://soroban-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Explorer | `https://stellar.expert/explorer/testnet` |

## Contracts

Deployed and wired 2026-06-23 (SEP-0056 surface + realistic seed). The frontend
reads each address from a `NEXT_PUBLIC_*` env var (see
[`../../frontend/.env.example`](../../frontend/.env.example)).

| Contract | Address | Env var | Verify |
|---|---|---|---|
| `vault` | `CD6WEKU2UDDUJFSQAE6AMYUDC2Q5C6RA6J23WQMWRTBQVKTMTLDK45KX` | `NEXT_PUBLIC_VAULT_ID` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CD6WEKU2UDDUJFSQAE6AMYUDC2Q5C6RA6J23WQMWRTBQVKTMTLDK45KX) |
| `policy` | `CDAYVNXHJD2T4QO66ECBX6LNA2SD2HCP66H23FPYWW7VSUR74QJ2K2VK` | `NEXT_PUBLIC_POLICY_ID` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDAYVNXHJD2T4QO66ECBX6LNA2SD2HCP66H23FPYWW7VSUR74QJ2K2VK) |
| `registry` | `CA7WWXTNBG2QCDBQMYL3SV7DRXBW7KALM5JGWPJJEAP34DWWUMLYGSKN` | `NEXT_PUBLIC_REGISTRY_ID` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CA7WWXTNBG2QCDBQMYL3SV7DRXBW7KALM5JGWPJJEAP34DWWUMLYGSKN) |
| `mock-strategy` (yield slot; DeFindex adapter pending deploy) | `CDKJQP5M34SBLT47CHRBGOAUFONG6JUN5URWSGCSGTGAS5JBM2NYGZ33` | — | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDKJQP5M34SBLT47CHRBGOAUFONG6JUN5URWSGCSGTGAS5JBM2NYGZ33) |
| USDC SAC (underlying) | `CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6` | `NEXT_PUBLIC_USDC_ID` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CALOXSNQXDC6KERPHF3WQ3QKFVGF25UHJWMNJR7NMQJRPEV2ZEGKEST6) |

The USDC SAC is the asset the vault settles in (the vault's one immutable
`underlying`), not the Circle faucet SAC.

## Seeded demo state

The deploy carries a **synthetic demo state** (for demonstration, not real
traction): a reserve of ~$50.4k, NAV 1.0084, 4 guarantees (3 active / 1 lapsed),
and $420 in fees collected. Restore it after a redeploy with `seed.sh`.

## Notes

- All addresses are **testnet-only**; a redeploy via `bootstrap.sh` changes every
  contract ID, so treat these as ephemeral and re-read them from env after any
  redeploy/reseed.
- The frontend never hardcodes IDs — it reads them from `NEXT_PUBLIC_*` env vars
  (see [`../../frontend/.env.example`](../../frontend/.env.example)); the BRL-native
  MBRL reserve degrades to a non-live "planned" status while its env vars are blank.
- For the per-method contract surface, see
  [`./contracts/vault.md`](./contracts/vault.md); for revert codes see
  [`./errors.md`](./errors.md).
