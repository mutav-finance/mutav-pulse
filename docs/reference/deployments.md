# Testnet deployments

Live contract addresses and network configuration for the mutav-pulse reserves on
Stellar testnet. **Three reserves are live** — MUSD, MTESOURO, MBRL. These are
testnet artifacts; a redeploy (`bootstrap.sh`) issues new contract IDs. The
frontend reads every address from a `NEXT_PUBLIC_*` env var — it never hardcodes
them (see [`../../frontend/.env.example`](../../frontend/.env.example)).

## Network

| Field | Value |
|---|---|
| Network | Stellar testnet |
| RPC URL | `https://soroban-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Explorer | `https://stellar.expert/explorer/testnet` |

## Reserves

Each reserve is its own contract set (vault + policy + registry), pegged to a
currency and settling in its own deposit token. Click an address to verify on
Stellar Expert.

### MUSD — USD reserve (deposit token: cUSD)

| Contract | Address | Env var |
|---|---|---|
| vault | [`CA26WJGO5MINAT47DCGMU54HYW5A3RQ7VSE4ANPCYYA4TGXTJZQJ5EZQ`](https://stellar.expert/explorer/testnet/contract/CA26WJGO5MINAT47DCGMU54HYW5A3RQ7VSE4ANPCYYA4TGXTJZQJ5EZQ) | `NEXT_PUBLIC_VAULT_ID` |
| policy | [`CBC2IJHH3FQMIQETFYDIEQG7OFJXTRKKLJDDONQ6N47AB3HLWWEIZQVO`](https://stellar.expert/explorer/testnet/contract/CBC2IJHH3FQMIQETFYDIEQG7OFJXTRKKLJDDONQ6N47AB3HLWWEIZQVO) | `NEXT_PUBLIC_POLICY_ID` |
| registry | [`CDJYJLUJL55SFD5YPSEKH6IZN3XRPLOCSFG33LDXOHEI2JY2ILITUSZ4`](https://stellar.expert/explorer/testnet/contract/CDJYJLUJL55SFD5YPSEKH6IZN3XRPLOCSFG33LDXOHEI2JY2ILITUSZ4) | `NEXT_PUBLIC_REGISTRY_ID` |
| cUSD SAC (underlying) | [`CAWAVKYQ5AFSM3PVEZ4COPMBCOQDRCNB4LVGDOZ6GWX5ZK6OQJZTEDAH`](https://stellar.expert/explorer/testnet/contract/CAWAVKYQ5AFSM3PVEZ4COPMBCOQDRCNB4LVGDOZ6GWX5ZK6OQJZTEDAH) | `NEXT_PUBLIC_USDC_ID` |
| faucet | [`CAC734DRXSPPJ3MX2IFY5KIYUAMISRTMRT3HVKQCXH3IHFNK3KQIDQTA`](https://stellar.expert/explorer/testnet/contract/CAC734DRXSPPJ3MX2IFY5KIYUAMISRTMRT3HVKQCXH3IHFNK3KQIDQTA) | `NEXT_PUBLIC_FAUCET_ID` |

### MTESOURO — Brazilian-treasury reserve (deposit token: cTSR)

| Contract | Address | Env var |
|---|---|---|
| vault | [`CCXN22362Q7OXYSU6RLM265MLDZZ6KMD5VFW5TVAGWZNBIN23O5FWIOZ`](https://stellar.expert/explorer/testnet/contract/CCXN22362Q7OXYSU6RLM265MLDZZ6KMD5VFW5TVAGWZNBIN23O5FWIOZ) | `NEXT_PUBLIC_MTESOURO_VAULT_ID` |
| policy | [`CCDB7NYTRXFFSM4CQBWRFFJPDXTDTCYWA6NFOXIKZRF2V2L7V6OCOI3W`](https://stellar.expert/explorer/testnet/contract/CCDB7NYTRXFFSM4CQBWRFFJPDXTDTCYWA6NFOXIKZRF2V2L7V6OCOI3W) | `NEXT_PUBLIC_MTESOURO_POLICY_ID` |
| registry | [`CAJUFQP6CDLSCATYHABVJKTPEQJZL75XS2SEVWC26PY6B3MNHAL3SU2M`](https://stellar.expert/explorer/testnet/contract/CAJUFQP6CDLSCATYHABVJKTPEQJZL75XS2SEVWC26PY6B3MNHAL3SU2M) | `NEXT_PUBLIC_MTESOURO_REGISTRY_ID` |
| cTSR SAC (underlying) | [`CADX23YFVDEOFWWOJJGA6PCFLHAVAMZJHUMKBWMZBMCM7IRZ4MIQAUKN`](https://stellar.expert/explorer/testnet/contract/CADX23YFVDEOFWWOJJGA6PCFLHAVAMZJHUMKBWMZBMCM7IRZ4MIQAUKN) | — (read on-chain) |
| faucet | [`CBA3X6NSUVJQYYB64IVJHPR33W3S5MUYBVO53OTFZSUE2YZWLQPMYYMZ`](https://stellar.expert/explorer/testnet/contract/CBA3X6NSUVJQYYB64IVJHPR33W3S5MUYBVO53OTFZSUE2YZWLQPMYYMZ) | `NEXT_PUBLIC_TESOURO_FAUCET_ID` |

### MBRL — BRL-native reserve (deposit token: cBRL)

| Contract | Address | Env var |
|---|---|---|
| vault | [`CCZEVACETO4HYELGBVBW3KZRQU2Y2Q4B2T7OS4OMQHY7IQ5KR3UHWDMN`](https://stellar.expert/explorer/testnet/contract/CCZEVACETO4HYELGBVBW3KZRQU2Y2Q4B2T7OS4OMQHY7IQ5KR3UHWDMN) | `NEXT_PUBLIC_MBRL_VAULT_ID` |
| policy | [`CCDHCRA7RFWEVHMXOJOIBY4NKOEON3PZRSQ2G6CVVE3GSPU45IKCTCX2`](https://stellar.expert/explorer/testnet/contract/CCDHCRA7RFWEVHMXOJOIBY4NKOEON3PZRSQ2G6CVVE3GSPU45IKCTCX2) | `NEXT_PUBLIC_MBRL_POLICY_ID` |
| registry | [`CB3LNCYTV67LMRTCMW34FGMGS4QZQV5PUQYRAARHSV7K5BQCXM53IOGN`](https://stellar.expert/explorer/testnet/contract/CB3LNCYTV67LMRTCMW34FGMGS4QZQV5PUQYRAARHSV7K5BQCXM53IOGN) | `NEXT_PUBLIC_MBRL_REGISTRY_ID` |
| cBRL SAC (underlying) | [`CCRSLV5CL7T5ZW7OUIAM2CTP365S7PUWIKGTHUHFSNIC6IO75XFIZ23V`](https://stellar.expert/explorer/testnet/contract/CCRSLV5CL7T5ZW7OUIAM2CTP365S7PUWIKGTHUHFSNIC6IO75XFIZ23V) | — (read on-chain) |
| faucet | [`CDO4EZPFRRJATNMPMWCHZD2IYNO7ZCDCXPBH4QBB7P5YW3LXCYD5I3EL`](https://stellar.expert/explorer/testnet/contract/CDO4EZPFRRJATNMPMWCHZD2IYNO7ZCDCXPBH4QBB7P5YW3LXCYD5I3EL) | `NEXT_PUBLIC_CBRL_FAUCET_ID` |

## Deposit assets

All three deposit tokens are **mock classic assets** on testnet, issued by the same
account `GA6LJT75ZRW3GWJ3NUQFBIL7CL66ITLT5BS35ZA7E7G35IOMGTSFJRIO`. Each vault's
`underlying` is the asset's Stellar Asset Contract (SAC) above.

| Asset | Code | Peg | Env (code / issuer) |
|---|---|---|---|
| cUSD | `cUSD` | 1:1 USD | `NEXT_PUBLIC_USDC_CODE` / `NEXT_PUBLIC_USDC_ISSUER` |
| cTSR | `cTSR` | yield-bearing (≈ R$1.22, not 1:1) | `NEXT_PUBLIC_TESOURO_CODE` / `NEXT_PUBLIC_TESOURO_ISSUER` |
| cBRL | `cBRL` | 1:1 BRL | `NEXT_PUBLIC_CBRL_CODE` / `NEXT_PUBLIC_CBRL_ISSUER` |

## Notes

- All addresses are **testnet-only**; a redeploy via `bootstrap.sh` changes every
  contract ID, so treat these as ephemeral and re-read them from env after any
  redeploy/reseed. The deploy carries a synthetic demo state (restore with `seed.sh`).
- The two-leg fiança policy is live: each reserve's `policy` exposes `cover_default`,
  `cover_exit`, `grace_secs`, and `set_coverage_ratio_bps`.
- For the per-method contract surface, see [`./contracts/vault.md`](./contracts/vault.md);
  for revert codes see [`./errors.md`](./errors.md).
