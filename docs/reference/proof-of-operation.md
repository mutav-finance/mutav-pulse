# Proof of Operation (Stellar testnet)

> Every transaction below is real and on-chain — the integration is **load-bearing, not a slide**.
> Two things are proven live: **(1)** the rental-guarantee protocol itself — underwrite a *fiança*,
> collect the premium, and pay out both coverage legs to a real landlord — and **(2)** the yield
> integration — the reserve's idle capital flowing through our audited `adapter-defindex` into a
> real [DeFindex](https://www.defindex.io/) vault and back.

Network: **testnet** (`Test SDF Network ; September 2015`) · Explorer: `https://stellar.expert/explorer/testnet`

**Verify any of it yourself:** open a link below on Stellar Expert, or re-read state straight from
the contracts with the bindings in [`frontend/`](../../frontend) (every figure on the
`/earn/transparency` dashboard resolves to one of these contracts).

| | Layer | Headline evidence |
|---|---|---|
| **Part 1** | The protocol | `cover_default` + `cover_exit` pay **3,000 cBRL** to a real landlord |
| **Part 2** | The integration | `rebalance` moves **~454k cUSD into a real DeFindex vault**; `process_redemptions` pulls **~95k back out** |

## Part 1 — the guarantee lifecycle (the protocol)

Executed on the **MBRL** (cBRL) pilot reserve. The landlord
[`GAEILCIV…R2LB`](https://stellar.expert/explorer/testnet/account/GAEILCIVINMSDUXWQEQF7OVIHM563B5U2JTG4JHLMI2TG3UIJMWLR2LB)
(a real, cBRL-trustlined third party) received **3,000 cBRL** across the two payout legs.

| # | Operation | What it proves | Tx |
|---|---|---|---|
| 1 | `sign_guarantee` (#8) | underwrite a fiança — reserves both legs (9× rent); reverts unless `stable_assets ≥ coverage_required` | [`ff173e3c`](https://stellar.expert/explorer/testnet/tx/ff173e3c87bdf5a402bad12ec6cf161da3e52c6bda3eabc522c4a0141cdbd555) |
| 2 | `pay_fee` (#8) | premium collected via the vault; accrues to NAV (mints no shares) | [`05bddeb1`](https://stellar.expert/explorer/testnet/tx/05bddeb16842bc1ed68d5e04102f64e4f154be40520a6f9bb60baff9d62fc9f5) |
| 3 | **`cover_exit`** (#8) | **EXIT leg — 1,000 cBRL property-recovery draw disbursed to the landlord** | [`18cfe2d0`](https://stellar.expert/explorer/testnet/tx/18cfe2d01e79c7c9d093b54a295b7aced74a0e5048c5b6c146e6a8cd1a152d11) |
| 4 | `sign_guarantee` (#9) | second guarantee, for the default demo | [`a482f660`](https://stellar.expert/explorer/testnet/tx/a482f660c5e2bf3a817462da3c72e5e956aff7db24115656bb562a668d86b160) |
| 5 | `set_grace_secs(0)` | demo shortcut: simulate the 5-day fee-grace window having elapsed (so the unpaid #9 is in default) | [`8227cf0e`](https://stellar.expert/explorer/testnet/tx/8227cf0e997814a45ffc924a10fdc9d81dcea62237e3377a745cebcf97cd663f) |
| 6 | **`cover_default`** (#9) | **DEFAULT leg — 2,000 cBRL rent-arrears month disbursed to the landlord** | [`5aa4b5bc`](https://stellar.expert/explorer/testnet/tx/5aa4b5bc0f8f01d93ca89adeefd2dce3dc1ba02386847d2db50867d49dbb80ce) |
| 7 | `set_grace_secs(432000)` | restore the 5-day grace window | [`5d7d6d68`](https://stellar.expert/explorer/testnet/tx/5d7d6d68e64d82f1e7af081f8a811d2ecd4ab4418ba357cab166cbdc6f013ce6) |

Contracts: MBRL policy [`CCDHCRA7…TCX2`](https://stellar.expert/explorer/testnet/contract/CCDHCRA7RFWEVHMXOJOIBY4NKOEON3PZRSQ2G6CVVE3GSPU45IKCTCX2),
vault [`CCZEVACE…WDMN`](https://stellar.expert/explorer/testnet/contract/CCZEVACETO4HYELGBVBW3KZRQU2Y2Q4B2T7OS4OMQHY7IQ5KR3UHWDMN),
cBRL SAC [`CCRSLV5C…23V`](https://stellar.expert/explorer/testnet/contract/CCRSLV5CL7T5ZW7OUIAM2CTP365S7PUWIKGTHUHFSNIC6IO75XFIZ23V).

> The `set_grace_secs(0)` step is only a time shortcut for the demo — `cover_default` requires a
> guarantee to be past its fee-grace window (`paid_until + grace < now`); rather than wait 5 days,
> we collapse the window, cover the default, and restore it. Everything else is the unmodified path.

## Part 2 — the yield integration (DeFindex)

The MUSD reserve runs its yield allocator against a **real DeFindex vault**, not the `mock-strategy`:
invest → allocate into DeFindex → async withdraw → divest out of DeFindex → claim, live on testnet.

### Contracts (DeFindex integration)

| Role | Address |
|---|---|
| MUSD reserve vault (controller) | [`CA26WJGO…5EZQ`](https://stellar.expert/explorer/testnet/contract/CA26WJGO5MINAT47DCGMU54HYW5A3RQ7VSE4ANPCYYA4TGXTJZQJ5EZQ) |
| Our `adapter-defindex` | [`CBI5SWRC…ORMQ`](https://stellar.expert/explorer/testnet/contract/CBI5SWRCDVXIVSFBZICNEJKFQFS77T33LBSDGAYXCH4DKF3BV5G7ORMQ) |
| **Real DeFindex vault** (our cUSD, via factory) | [`CCFU2JZF…J3KD`](https://stellar.expert/explorer/testnet/contract/CCFU2JZFEC67A52L4CC52ZWKNZNTBDPYTZUNWGJH4CXHXYKO5W7VJ3KD) |
| DeFindex factory (paltalabs, testnet) | [`CDSCWE4G…4A32`](https://stellar.expert/explorer/testnet/contract/CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32) |
| cUSD underlying (SAC) | [`CAWAVKYQ…EDAH`](https://stellar.expert/explorer/testnet/contract/CAWAVKYQ5AFSM3PVEZ4COPMBCOQDRCNB4LVGDOZ6GWX5ZK6OQJZTEDAH) |

The DeFindex vault was created over our cUSD with an empty strategy set (a real DeFindex vault
contract — real df-share token, real `deposit`/`withdraw` ABI — holding the asset idle, since
DeFindex's yield strategies are asset-specific and there is no Blend pool for a mock cUSD).
The integration surface (factory creation, vault `deposit`/`withdraw`/`get_asset_amounts_per_shares`)
is load-bearing and exercised live below.

### Lifecycle transactions

| # | Operation | What it proves | Tx |
|---|---|---|---|
| 1 | `create_defindex_vault` | DeFindex factory creates our cUSD vault | [`66d249ad`](https://stellar.expert/explorer/testnet/tx/66d249add8f18158b499473befc4d2cfe5daef269bceeedc9a6c12cd2de2fb81) |
| 2 | adapter `deploy` | our audited adapter deployed | [`973bf5d1`](https://stellar.expert/explorer/testnet/tx/973bf5d16e083f2fed45092d8bb7114b6e92d9367883ee7269d8ff630164c0e0) |
| 3 | `set_vault` | adapter → DeFindex vault | [`a4c82fdf`](https://stellar.expert/explorer/testnet/tx/a4c82fdfcbc5af2aef9e67212952846a9422cf3993677cd904f01e3525e7795a) |
| 4 | `set_controller` | adapter authorizes only the MUSD vault | [`8b22dd11`](https://stellar.expert/explorer/testnet/tx/8b22dd11dbfba71be08ec84a604898a07297a54f2ab82cfa6c89cec2c6f8e240) |
| 5 | `remove_strategy` (mock) | unwire the mock (auto-divests) | [`7daadbe7`](https://stellar.expert/explorer/testnet/tx/7daadbe746311a729b47ccb2e1f02e1060638f56156e2544ddd72e41666cec40) |
| 6 | `add_strategy` (adapter) | MUSD routes 100% to DeFindex adapter | [`feed7971`](https://stellar.expert/explorer/testnet/tx/feed7971a27ff84d5fe6142f372b2e25db82f0b9f430e337aa89e2de80540ea9) |
| 7 | `deposit` (**invest**) | cUSD in → MUSD shares minted | [`b8faf048`](https://stellar.expert/explorer/testnet/tx/b8faf0486420dd11c67bf03e5a05e9c3c00fc5aa47d37ce6d0a347c4464e03ef) |
| 8 | `set_min_liquid_buffer_bps` (1000) | 10% liquid buffer governance lever | [`849780ac`](https://stellar.expert/explorer/testnet/tx/849780ac0bc7ef736cc02b24a2d2b77d7529bb8d96a4e909539eceb2add8fd0f) |
| 9 | `upgrade` (adapter) | auth fix so the live DeFindex deposit authorizes (see note) | [`a3d9d4a7`](https://stellar.expert/explorer/testnet/tx/a3d9d4a79d6f29273fcdc684f35d1beb3ae2878ec8ab9187973eed08d3e7fded) |
| 10 | `rebalance` (**allocate**) | **~454k cUSD deposited into the DeFindex vault** | [`9402013f`](https://stellar.expert/explorer/testnet/tx/9402013f7ab667cc17bd2f3df5d799acf7f15a332af7e1a79b1dcb2caf837da0) |
| 11 | `request_redeem` (**withdraw**) | async redemption queued | [`ac9fc7f6`](https://stellar.expert/explorer/testnet/tx/ac9fc7f67752c178cf9973d118f67778238e77cd721656490571a91464083b49) |
| 12 | `process_redemptions` (**divest**) | **~95k cUSD withdrawn back out of DeFindex** to fund the redemption | [`7fa65a91`](https://stellar.expert/explorer/testnet/tx/7fa65a91f87540a735b07b1128a278ed69fe2143d789afa755446e29e44aea63) |
| 13 | `claim` | redeemed cUSD delivered to the holder | [`5188664e`](https://stellar.expert/explorer/testnet/tx/5188664e08f563168dd8f814af6bbde44f46d59bc392993fb7e51ce3f8b0a262) |

Verifiable on-chain after the run: the DeFindex vault's cUSD balance rose by ~454k on `rebalance`
(tx 10) and fell by ~95k on `process_redemptions` (tx 12); `adapter.balance()` tracks the df-share
value held in the DeFindex vault.

### Note — the auth fix (tx 9)

The first `rebalance` reverted with `Error(Auth, InvalidAction)`: the real DeFindex vault's
`deposit` pulls the underlying via `transfer(from = adapter)`, a call it makes on the adapter's
behalf deeper in the stack. The adapter must pre-authorize exactly that transfer with
`authorize_as_current_contract`. Our unit tests run under `mock_all_auths`, which silently
satisfied this — the live vault does not. The fix adds the explicit invoker-contract authorization
in `invest`; the adapter was upgraded in place (storage layout unchanged) and the rebalance then
succeeded. This is a real integration defect that only the live DeFindex vault surfaced.
