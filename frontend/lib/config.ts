import { Networks } from "@stellar/stellar-sdk";

/**
 * Fail-fast accessor for a REQUIRED public env var. Throws a clear,
 * named error when the value is missing/empty so a misconfigured deploy
 * surfaces immediately instead of producing silent `undefined` reads.
 *
 * NOTE: the literal `process.env.NEXT_PUBLIC_*` access must be passed in by
 * the caller — Next.js only inlines static literal accesses into the client
 * bundle, so a dynamic `process.env[name]` lookup would be `undefined` in the
 * browser. We pass `name` only for the error message.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env.local (or your deploy environment) before building.`,
    );
  }
  return value;
}

export const config = {
  rpcUrl: requireEnv("NEXT_PUBLIC_RPC_URL", process.env.NEXT_PUBLIC_RPC_URL),
  networkPassphrase: requireEnv(
    "NEXT_PUBLIC_NETWORK_PASSPHRASE",
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
  ),
  explorerBase: requireEnv(
    "NEXT_PUBLIC_EXPLORER_BASE",
    process.env.NEXT_PUBLIC_EXPLORER_BASE,
  ),
  // Horizon (classic) endpoint — used for reading trustlines/balances and
  // building the change_trust transaction. Defaults to the testnet Horizon.
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  contracts: {
    vault: requireEnv("NEXT_PUBLIC_VAULT_ID", process.env.NEXT_PUBLIC_VAULT_ID),
    policy: requireEnv(
      "NEXT_PUBLIC_POLICY_ID",
      process.env.NEXT_PUBLIC_POLICY_ID,
    ),
    registry: requireEnv(
      "NEXT_PUBLIC_REGISTRY_ID",
      process.env.NEXT_PUBLIC_REGISTRY_ID,
    ),
    usdc: requireEnv("NEXT_PUBLIC_USDC_ID", process.env.NEXT_PUBLIC_USDC_ID),
    // Testnet-only demo faucet. Empty/undefined on mainnet.
    faucet: process.env.NEXT_PUBLIC_FAUCET_ID ?? "",
    // BRL-native MBRL reserve contract set. OPTIONAL — empty until that reserve
    // is deployed (see bootstrap.sh). The MBRL reserve entry in lib/reserves.ts
    // degrades to non-live (status flips off) when these are blank, so the build
    // and pages never break on a not-yet-deployed reserve.
    mbrlVault: process.env.NEXT_PUBLIC_MBRL_VAULT_ID ?? "",
    mbrlPolicy: process.env.NEXT_PUBLIC_MBRL_POLICY_ID ?? "",
    mbrlRegistry: process.env.NEXT_PUBLIC_MBRL_REGISTRY_ID ?? "",
    // Testnet-only cBRL faucet (the BRL-native reserve's demo faucet). Empty
    // until deployed (bootstrap.sh BRL_NATIVE path). Mirrors `faucet` for USDC.
    cbrlFaucet: process.env.NEXT_PUBLIC_CBRL_FAUCET_ID ?? "",
  },
  // Classic asset behind the USDC SAC — needed to build the change_trust op and
  // to read the trustline/balance from Horizon.
  usdc: {
    code: process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC",
    issuer: process.env.NEXT_PUBLIC_USDC_ISSUER ?? "",
  },
  // Classic asset behind the TESOURO SAC — the MBRL reserve's deposit token.
  // Used to build the trustline + the USDC→TESOURO SDEX path payment ("Buy TESOURO").
  tesouro: {
    code: process.env.NEXT_PUBLIC_TESOURO_CODE ?? "TESOURO",
    issuer: process.env.NEXT_PUBLIC_TESOURO_ISSUER ?? "",
    // Indicative BRL price of one TESOURO unit, for DISPLAY-ONLY fiat conversion.
    // TESOURO is a yield-bearing Brazilian treasury token — 1 TESOURO ≠ R$1 — and
    // there is no deep on-chain TESOURO/BRL pair to derive it live, so we carry an
    // env-overridable indicative price. NEVER feeds contract logic: the vault
    // accounts purely in TESOURO units (coverage stays TESOURO/BRL-denominated, no
    // FX leak). Default ≈ accrued NAV per Etherfuse.
    priceBrl: Number(process.env.NEXT_PUBLIC_TESOURO_PRICE_BRL ?? "1.22107"),
  },
  // Classic asset behind the cBRL SAC — the BRL-native MBRL reserve's deposit
  // token (a mock BRL stablecoin on testnet). cBRL is fiat-pegged (1 cBRL ≈ R$1),
  // so unlike TESOURO it carries no indicative price. Empty issuer until the
  // cBRL asset is deployed (see bootstrap.sh).
  cbrl: {
    code: process.env.NEXT_PUBLIC_CBRL_CODE ?? "cBRL",
    issuer: process.env.NEXT_PUBLIC_CBRL_ISSUER ?? "",
  },
} as const;

/** Explorer URL for a transaction hash. */
export const txUrl = (h: string) => `${config.explorerBase}/tx/${h}`;
/** Explorer URL for a contract id. */
export const contractUrl = (id: string) => `${config.explorerBase}/contract/${id}`;

/** True on Stellar testnet. The faucet + trustline shortcut are testnet-only. */
export const isTestnet = config.networkPassphrase === Networks.TESTNET;

/**
 * Whether the TESOURO asset is fully configured (issuer present). The MBRL
 * reserve's Buy/trustline flow builds `new Asset("TESOURO", issuer)`, which
 * throws when the issuer is empty — so the UI gates that action on this flag
 * instead of letting the swap hard-throw at click time.
 */
export const tesouroConfigured = config.tesouro.issuer.length > 0;

/**
 * Whether the BRL-native MBRL reserve is deployed and configured — true only
 * when the full contract set (vault/policy/registry) is present in the env.
 * The MBRL reserve in lib/reserves.ts gates its `status: "live"` on this so a
 * not-yet-deployed reserve degrades to non-live instead of crashing pages that
 * read `.address`/`.contracts` (which the LiveReserve guard would otherwise
 * leave unset). cBRL asset config (issuer) is separate and gates only the
 * trustline/faucet UI, mirroring `tesouroConfigured`.
 */
export const mbrlConfigured =
  config.contracts.mbrlVault.length > 0 &&
  config.contracts.mbrlPolicy.length > 0 &&
  config.contracts.mbrlRegistry.length > 0;

/**
 * Whether to surface the testnet faucet (trustline + faucet). Gated to testnet
 * with a configured faucet — on mainnet users hold real USDC, so this never shows.
 */
export const faucetEnabled = isTestnet && config.contracts.faucet.length > 0;

/**
 * Whether to surface the cBRL testnet faucet (trustline + faucet) for the
 * BRL-native MBRL reserve. Needs testnet + a configured cBRL issuer + a deployed
 * cBRL faucet — so a not-yet-provisioned reserve shows no (broken) Fund affordance.
 */
export const cbrlFaucetEnabled =
  isTestnet && config.cbrl.issuer.length > 0 && config.contracts.cbrlFaucet.length > 0;
