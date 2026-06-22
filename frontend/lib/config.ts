export const config = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  explorerBase: process.env.NEXT_PUBLIC_EXPLORER_BASE!,
  contracts: {
    vault: process.env.NEXT_PUBLIC_VAULT_ID!,
    policy: process.env.NEXT_PUBLIC_POLICY_ID!,
    registry: process.env.NEXT_PUBLIC_REGISTRY_ID!,
    usdc: process.env.NEXT_PUBLIC_USDC_ID!,
  },
} as const;
