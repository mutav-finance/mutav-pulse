"use client";

/**
 * UsdcFaucet — demo USDC faucet. Thin preset over the generic FaucetCard,
 * wired to the USDC trustline/faucet helpers. Rendered only when `faucetEnabled`.
 */

import { getUsdcInfo, addTrustline, dripFaucet } from "@/lib/faucet";
import { FaucetCard } from "@/components/FaucetCard";

export function UsdcFaucet({ address, onSuccess }: { address: string; onSuccess(): void }) {
  return (
    <FaucetCard
      address={address}
      onSuccess={onSuccess}
      assetCode="USDC"
      dripAmount="1,000"
      getInfo={getUsdcInfo}
      addTrustline={addTrustline}
      drip={dripFaucet}
    />
  );
}
