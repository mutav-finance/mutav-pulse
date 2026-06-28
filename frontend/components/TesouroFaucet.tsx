"use client";

/**
 * TesouroFaucet — demo cTSR faucet for the MTESOURO reserve. Thin preset over
 * the generic FaucetCard, wired to the cTSR trustline/balance helpers (shared
 * with the on-chain swap, in lib/buy-tesouro) plus the faucet drip. Rendered only
 * when `tesouroFaucetEnabled` (testnet + cTSR issuer + cTSR faucet). This is the
 * instant path to acquire cTSR; BuyTesouro is the AMM-swap alternative.
 */

import { getTesouroInfo, addTesouroTrustline } from "@/lib/buy-tesouro";
import { dripTesouroFaucet } from "@/lib/faucet";
import { FaucetCard } from "@/components/FaucetCard";

export function TesouroFaucet({
  address,
  onSuccess,
  refreshSignal,
}: {
  address: string;
  onSuccess(): void;
  refreshSignal?: number;
}) {
  return (
    <FaucetCard
      address={address}
      onSuccess={onSuccess}
      assetCode="cTSR"
      dripAmount="1,000"
      getInfo={getTesouroInfo}
      addTrustline={addTesouroTrustline}
      drip={dripTesouroFaucet}
      refreshSignal={refreshSignal}
    />
  );
}
