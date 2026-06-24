/**
 * lib/wallet.ts — Stellar Wallets Kit singleton + core helpers
 *
 * Architecture:
 *   - StellarWalletsKit (v2.3.0) is a static class — no `new`, no instance.
 *   - `initKit()` must be called once (client-side) before any other method.
 *   - `connect()` opens the auth modal and returns the address.
 *   - `signAndSubmit(xdr)` signs via the kit then submits through stellar-sdk
 *     rpc.Server, returning the tx hash.
 *
 * signAndSubmit shape (documented for Tasks 4 and 7):
 *
 *   async function signAndSubmit(xdr: string): Promise<string /* txHash *\/>
 *
 *   Internally:
 *   1. StellarWalletsKit.signTransaction(xdr, { networkPassphrase, address })
 *      → { signedTxXdr: string }
 *   2. Parse signedTxXdr with stellar-base TransactionBuilder.fromXDR()
 *   3. rpc.Server.sendTransaction(tx) → { hash: string, status }
 *   4. Wait for SUCCESS via rpc.Server.getTransaction(hash)
 *   5. Return hash
 *
 * Binding client integration (Tasks 4 and 7):
 *   Construct bindings with { rpcUrl, contractId, networkPassphrase, publicKey }
 *   and pass `signTransaction` from this module as the `signTransaction` option:
 *
 *     import { makeSignTransaction } from "@/lib/wallet";
 *     const client = new Client({
 *       rpcUrl: config.rpcUrl,
 *       contractId: config.contracts.vault,
 *       networkPassphrase: config.networkPassphrase,
 *       publicKey: address,
 *       signTransaction: makeSignTransaction(),
 *     });
 *     const tx = await client.someWriteMethod(...);
 *     const sent = await tx.signAndSend();
 *     // sent.sendTransactionResponse.hash is the tx hash
 *
 *   OR use signAndSubmit(xdr) for raw XDR signing + submission outside bindings.
 */

// ⚠️ A @creit.tech/stellar-wallets-kit acessa `localStorage` na AVALIAÇÃO do módulo.
// Importá-la estaticamente quebra o prerender SSR: toda página passa pela root layout
// → WalletProvider → este módulo, e o Next avalia o módulo no servidor. Por isso a kit
// é carregada via import() dinâmico, só no cliente, dentro das funções abaixo.
// O stellar-sdk é SSR-safe (não toca localStorage no load) e segue como import estático.
import { rpc as StellarRpc, TransactionBuilder, Networks as StellarNetworks } from "@stellar/stellar-sdk";
import { config } from "./config";

// Tipo só-para-tipagem (apagado em runtime — não emite import).
type WalletsKit = typeof import("@creit.tech/stellar-wallets-kit").StellarWalletsKit;

// ─── Kit init ────────────────────────────────────────────────────────────────

let _kit: WalletsKit | null = null;
let _kitReady = false;

/** Carrega a wallets-kit sob demanda (client-side). Idempotente. */
async function getKit(): Promise<WalletsKit> {
  if (!_kit) {
    const { StellarWalletsKit } = await import("@creit.tech/stellar-wallets-kit");
    _kit = StellarWalletsKit;
  }
  return _kit;
}

/**
 * Initialize the kit singleton. Call once on the client side (e.g. in
 * WalletProvider on mount). Safe to call multiple times — idempotent.
 * Async: carrega a kit + módulos via import() dinâmico (nunca avaliados no SSR).
 */
export async function initKit(): Promise<void> {
  if (_kitReady) return;
  const [{ StellarWalletsKit, Networks }, { FreighterModule }, { AlbedoModule }, { xBullModule }] =
    await Promise.all([
      import("@creit.tech/stellar-wallets-kit"),
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    ]);
  _kit = StellarWalletsKit;
  StellarWalletsKit.init({
    network: Networks.TESTNET,
    selectedWalletId: undefined,
    modules: [new FreighterModule(), new AlbedoModule(), new xBullModule()],
  });
  _kitReady = true;
}

// ─── Address ─────────────────────────────────────────────────────────────────

/**
 * Open the auth modal and return the address the user connects with.
 * Automatically initializes the kit if not already done.
 */
export async function connect(): Promise<string> {
  await initKit();
  const kit = await getKit();
  const { address } = await kit.authModal();
  return address;
}

/**
 * Disconnect the active wallet module.
 */
export async function disconnect(): Promise<void> {
  const kit = await getKit();
  await kit.disconnect().catch((err) => {
    console.error("[wallet] disconnect error:", err);
  });
}

// ─── signTransaction (binding-compatible) ────────────────────────────────────

/**
 * Returns a SignTransaction function compatible with the stellar-sdk
 * ContractClient / AssembledTransaction `signTransaction` option.
 *
 * Usage (in Tasks 4 / 7):
 *   const sign = makeSignTransaction();
 *   const client = new VaultClient({ ..., signTransaction: sign });
 *   const tx = await client.deposit({ ... });
 *   const sent = await tx.signAndSend();  // returns SentTransaction
 *   const hash = sent.sendTransactionResponse?.hash;
 */
export function makeSignTransaction(
  address?: string | null,
): (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string },
) => Promise<{ signedTxXdr: string; signerAddress?: string }> {
  return async (xdr, opts) => {
    const kit = await getKit();
    return kit.signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase ?? config.networkPassphrase,
      address: opts?.address ?? address ?? undefined,
    });
  };
}

// ─── signAndSubmit (raw XDR path) ────────────────────────────────────────────

let _rpcServer: StellarRpc.Server | undefined;

/** Lazy getter — avoids module-scope instantiation on server-side imports. */
function rpcServer(): StellarRpc.Server {
  if (!_rpcServer) {
    _rpcServer = new StellarRpc.Server(config.rpcUrl, { allowHttp: false });
  }
  return _rpcServer;
}

/**
 * Sign an XDR transaction via the kit and submit through stellar-sdk rpc.Server.
 * Waits for the transaction to be confirmed on-ledger, then returns the tx hash.
 *
 * @param xdr       - Unsigned (or partially assembled) transaction XDR string
 * @param address   - Signer's public key; defaults to the kit's current address
 * @returns         - The confirmed transaction hash
 *
 * Downstream callers (Tasks 4 / 7): prefer using the binding's
 * `AssembledTransaction.signAndSend()` with `makeSignTransaction()` above.
 * Use `signAndSubmit()` only when working with raw XDRs outside the bindings.
 */
export async function signAndSubmit(
  xdr: string,
  address?: string | null,
): Promise<string> {
  const kit = await getKit();
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    networkPassphrase: config.networkPassphrase,
    address: address ?? undefined,
  });

  // Parse and submit
  const tx = TransactionBuilder.fromXDR(
    signedTxXdr,
    config.networkPassphrase as (typeof StellarNetworks)[keyof typeof StellarNetworks],
  );

  const sendResp = await rpcServer().sendTransaction(tx);

  if (sendResp.status === "ERROR") {
    throw new Error(
      `sendTransaction failed: ${JSON.stringify(sendResp.errorResult)}`,
    );
  }

  const hash = sendResp.hash;
  const MAX_POLLS = 30;

  // Poll until confirmed
  let getResp = await rpcServer().getTransaction(hash);
  let attempts = 0;
  while (getResp.status === StellarRpc.Api.GetTransactionStatus.NOT_FOUND && attempts < MAX_POLLS) {
    await new Promise((r) => setTimeout(r, 1500));
    getResp = await rpcServer().getTransaction(hash);
    attempts++;
  }

  if (getResp.status !== StellarRpc.Api.GetTransactionStatus.SUCCESS) {
    if (attempts >= MAX_POLLS) {
      throw new Error(
        `transaction timed out after ${MAX_POLLS} polls, last status: ${getResp.status}`,
      );
    }
    throw new Error(
      `Transaction ${hash} did not succeed. Status: ${getResp.status}`,
    );
  }

  return hash;
}
