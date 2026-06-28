/**
 * lib/admin-account-tx.ts — signer-mutating ops for the admin multisig account.
 *
 * Classic `set_options` operations that add/remove signers on the admin account.
 * Split from lib/admin-account.ts (reads + pure helpers) because these pull in
 * the wallet kit via ./wallet — mirrors the contracts.ts / admin-tx.ts split, and
 * keeps the read module importable in plain-node tests.
 */

import { TransactionBuilder, Operation, BASE_FEE } from "@stellar/stellar-sdk";
import { config } from "./config";
import { signAndSubmit, rpcServer } from "./wallet";

/**
 * Add (or update the weight of) a signer on the admin account.
 *
 * Builds a `set_options` with SOURCE = the admin account, signed by `connected`
 * (a current signer of that account). Default weight 1 keeps the threshold-1
 * "any signer authorizes" model. Returns the confirmed tx hash.
 */
export async function addSigner(
  adminAccount: string,
  signerPubkey: string,
  connected: string,
  weight = 1,
): Promise<string> {
  return submitSignerChange(adminAccount, signerPubkey, weight, connected);
}

/** Remove a signer (weight 0) from the admin account. Returns the tx hash. */
export async function removeSigner(
  adminAccount: string,
  signerPubkey: string,
  connected: string,
): Promise<string> {
  return submitSignerChange(adminAccount, signerPubkey, 0, connected);
}

async function submitSignerChange(
  adminAccount: string,
  signerPubkey: string,
  weight: number,
  connected: string,
): Promise<string> {
  // Source = the admin account (so the change applies to it); the connected
  // wallet — a current signer — provides the signature. Soroban RPC accepts
  // classic ops, so we reuse the same getAccount → build → signAndSubmit path
  // as the trustline/SDEX helpers.
  const account = await rpcServer().getAccount(adminAccount);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.setOptions({
        signer: { ed25519PublicKey: signerPubkey, weight },
      }),
    )
    .setTimeout(180)
    .build();
  return signAndSubmit(tx.toXDR(), connected);
}
