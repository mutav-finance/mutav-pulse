"use client";

/**
 * components/WalletProvider.tsx
 *
 * React context for wallet state + actions. Wraps the app in layout.tsx.
 *
 * useWallet() API (used by Tasks 4 and 7):
 *
 *   const { address, connecting, connect, disconnect, signAndSubmit, error } = useWallet();
 *
 *   address: string | null          — connected public key, or null
 *   connect(): Promise<void>        — opens the Stellar Wallets Kit modal
 *   disconnect(): void              — clears wallet state (async internally)
 *   signAndSubmit(xdr: string): Promise<string>
 *                                   — sign + submit XDR, returns tx hash
 *
 * signAndSubmit signature for downstream callers:
 *
 *   async signAndSubmit(xdr: string): Promise<string>
 *
 *   The xdr parameter is an unsigned (or prepared) transaction XDR string.
 *   Returns the confirmed tx hash on success; throws on error.
 *
 *   For write helpers using generated bindings (Tasks 4 / 7), prefer the
 *   makeSignTransaction() path from lib/wallet.ts so the binding's own
 *   AssembledTransaction.signAndSend() handles submission + polling.
 *   Use signAndSubmit() for raw XDR paths outside the bindings.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  initKit,
  connect as kitConnect,
  disconnect as kitDisconnect,
  signAndSubmit as kitSignAndSubmit,
} from "@/lib/wallet";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletContextValue {
  /** Connected Stellar public key, or null when not connected. */
  address: string | null;
  /** True while a connect/disconnect action is in flight. */
  connecting: boolean;
  /** Last connect error message, or null if no error / cleared on success. */
  error: string | null;
  /** Open the Stellar Wallets Kit modal and connect a wallet. */
  connect(): Promise<void>;
  /** Disconnect the active wallet. */
  disconnect(): void;
  /**
   * Sign an XDR transaction via the kit and submit via stellar-sdk rpc.Server.
   * Returns the confirmed tx hash.
   *
   * @param xdr - Unsigned (or assembled) transaction XDR string
   * @returns   - Confirmed transaction hash
   */
  signAndSubmit(xdr: string): Promise<string>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize kit once on mount (client-side only)
  useEffect(() => {
    initKit();
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const addr = await kitConnect();
      setAddress(addr);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Fire-and-forget — kit disconnect is async but we clear state immediately
    kitDisconnect().catch((err) => {
      console.error("[WalletProvider] disconnect error:", err);
    });
    setAddress(null);
  }, []);

  const signAndSubmit = useCallback(
    (xdr: string) => kitSignAndSubmit(xdr, address),
    [address],
  );

  return (
    <WalletContext.Provider
      value={{ address, connecting, error, connect, disconnect, signAndSubmit }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access wallet state and actions from any client component.
 *
 * Must be rendered inside <WalletProvider> (added to app/layout.tsx).
 *
 * @example
 * const { address, connect, disconnect, signAndSubmit } = useWallet();
 */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside <WalletProvider>");
  }
  return ctx;
}
