"use client";

/**
 * CbrlFaucet — demo cBRL faucet for the BRL-native MBRL reserve. Thin preset
 * over the generic FaucetCard, wired to the cBRL trustline/faucet helpers.
 * Rendered only when `cbrlFaucetEnabled` (testnet + cBRL issuer + cBRL faucet).
 */

import { getCbrlInfo, addCbrlTrustline, dripCbrlFaucet } from "@/lib/faucet";
import { FaucetCard } from "@/components/FaucetCard";

export function CbrlFaucet({ address, onSuccess }: { address: string; onSuccess(): void }) {
  return (
    <FaucetCard
      address={address}
      onSuccess={onSuccess}
      assetCode="cBRL"
      dripAmount="1,000"
      getInfo={getCbrlInfo}
      addTrustline={addCbrlTrustline}
      drip={dripCbrlFaucet}
    />
  );
}
