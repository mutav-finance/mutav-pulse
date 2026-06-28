# Contract error codes

Every `#[contracterror]` variant across the mutav-pulse contracts, with its
numeric code, owning contract, and meaning. Codes are stable across in-place
`upgrade()` (append-only ABI).

**Banding scheme:** each contract owns a distinct hundreds band so a raw code
identifies its origin — `2xx` interfaces/registry, `3xx` policy, `4xx` strategy,
`5xx` adapter, `6xx` vault.

| Code | Name | Contract | Meaning |
|---|---|---|---|
| 200 | `GuaranteeNotFound` | `registry` (`interfaces`) | No guarantee stored under the requested id. |
| 201 | `InvalidId` | `registry` (`interfaces`) | Guarantee id outside the issued range (`>= NextId`); a writer must not fabricate the primary key. |
| 202 | `WriterNotSet` | `registry` (`interfaces`) | Writer role read before it was set (defense-in-depth; constructor defaults Writer=admin). |
| 203 | `VersionMismatch` | `registry` (`interfaces`) | `upgrade` called against an unexpected on-chain schema version (stale / layout-incompatible storage). |
| 300 | `FeeTooHigh` | `policy` | `fee_bps` exceeds 100% (10_000 bps). |
| 401 | `NotInitialized` | `mock-defindex` strategy (`defindex-hodl`) | Strategy used before initialization. |
| 410 | `NegativeNotAllowed` | `mock-defindex` strategy (`defindex-hodl`) | Negative amount supplied where non-negative is required. |
| 412 | `InsufficientBalance` | `mock-defindex` strategy (`defindex-hodl`) | Divest/withdraw exceeds the strategy's balance. |
| 500 | `MalformedVaultResponse` | `adapter-defindex` | DeFindex vault returned an empty per-asset vector where a single underlying amount was expected. |
| 501 | `InvalidSlippageBps` | `adapter-defindex` | `set_max_slippage_bps` called with a value `> 10_000` (more than 100%). |
| 502 | `DepositSlippageExceeded` | `adapter-defindex` | df-shares minted by DeFindex `deposit` are worth less than the `max_slippage_bps` floor of the amount invested (audit H5). |
| 600 | `InsufficientLiquidity` | `vault` | A money path (`disburse` / `process_redemptions`) asked `ensure_liquidity` for more underlying than the strategies could realize; reverts rather than realize an incorrect loss. |

The `RegistryError` enum is defined in `interfaces` (so every consumer of the
generated `RegistryClient` sees the same codes) but is owned by the `registry`
contract. The `4xx` strategy band is defined by the `defindex-hodl` mock
strategy double; the production `mock-strategy` and `adapter-defindex` strategies
surface adapter-band errors instead.
