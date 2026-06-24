import { Networks } from "@stellar/stellar-sdk";

export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  explorerBase: process.env.NEXT_PUBLIC_EXPLORER_BASE!,
  // Horizon (classic) endpoint — used for reading trustlines/balances and
  // building the change_trust transaction. Defaults to the testnet Horizon.
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  contracts: {
    vault: process.env.NEXT_PUBLIC_VAULT_ID!,
    policy: process.env.NEXT_PUBLIC_POLICY_ID!,
    registry: process.env.NEXT_PUBLIC_REGISTRY_ID!,
    usdc: process.env.NEXT_PUBLIC_USDC_ID!,
    // Testnet-only demo faucet. Empty/undefined on mainnet.
    faucet: process.env.NEXT_PUBLIC_FAUCET_ID ?? "",
    // ZK solvency attestor — read last_attestation for the ZkSolvencyBadge.
    attestor: process.env.NEXT_PUBLIC_ATTESTOR_ID!,
  },
  // Classic asset behind the USDC SAC — needed to build the change_trust op and
  // to read the trustline/balance from Horizon.
  usdc: {
    code: process.env.NEXT_PUBLIC_USDC_CODE ?? "USDC",
    issuer: process.env.NEXT_PUBLIC_USDC_ISSUER ?? "",
  },
} as const;

/** True on Stellar testnet. The faucet + trustline shortcut are testnet-only. */
export const isTestnet = config.networkPassphrase === Networks.TESTNET;

/**
 * Whether to surface the testnet on-ramp (trustline + faucet). Gated to testnet
 * with a configured faucet — on mainnet users hold real USDC, so this never shows.
 */
export const faucetEnabled = isTestnet && config.contracts.faucet.length > 0;
