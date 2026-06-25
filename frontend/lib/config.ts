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
  },
  // Classic asset behind the USDC SAC — needed to build the change_trust op and
  // to read the trustline/balance from Horizon.
  usdc: {
    code: process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC",
    issuer: process.env.NEXT_PUBLIC_USDC_ISSUER ?? "",
  },
} as const;

/** Explorer URL for a transaction hash. */
export const txUrl = (h: string) => `${config.explorerBase}/tx/${h}`;
/** Explorer URL for a contract id. */
export const contractUrl = (id: string) => `${config.explorerBase}/contract/${id}`;

/** True on Stellar testnet. The faucet + trustline shortcut are testnet-only. */
export const isTestnet = config.networkPassphrase === Networks.TESTNET;

/**
 * Whether to surface the testnet on-ramp (trustline + faucet). Gated to testnet
 * with a configured faucet — on mainnet users hold real USDC, so this never shows.
 */
export const faucetEnabled = isTestnet && config.contracts.faucet.length > 0;
