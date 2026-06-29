"use client";

/**
 * FaucetCard — generic testnet faucet (trustline + drip) for a demo asset.
 *
 * TESTNET ONLY. Our demo deposit tokens (USDC, cBRL) are mock classic-asset SACs
 * testers can't otherwise acquire, so this gives them the two prerequisites for
 * depositing: a trustline, then tokens from the on-chain faucet. Parameterized by
 * asset so a single component serves every reserve (USDC, cBRL, …); thin presets
 * (UsdcFaucet, CbrlFaucet) supply the per-asset config.
 *
 * Design: Precision Brutalism, investidor front. Amber CTA, mono data labels,
 * a "TESTNET" tag so it never reads as a permanent product surface.
 */

import { useCallback, useEffect, useState } from "react";
import type { AssetInfo } from "@/lib/trustline";
import { TxStatus } from "@/components/TxStatus";
import { Button } from "@/components/ui/button";

export interface FaucetCardProps {
  /** Connected wallet public key */
  address: string;
  /** Called after a successful trustline/drip so the parent refreshes balances */
  onSuccess(): void;
  /** Asset ticker shown in labels, e.g. "USDC" / "cBRL". */
  assetCode: string;
  /** Human drip-amount label, e.g. "1,000". */
  dripAmount: string;
  getInfo(address: string): Promise<AssetInfo>;
  addTrustline(address: string): Promise<string>;
  drip(address: string): Promise<string>;
  /**
   * Bumped by the parent after any tx so this card re-reads its trustline/balance.
   * Lets a sibling card sharing the same asset trustline (e.g. BuyTesouro for cTSR)
   * refresh this one after it acts. Optional — single-card reserves omit it.
   */
  refreshSignal?: number;
}

type Action = "trustline" | "drip" | null;

export function FaucetCard({
  address,
  onSuccess,
  assetCode,
  dripAmount,
  getInfo,
  addTrustline,
  drip,
  refreshSignal,
}: FaucetCardProps) {
  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
  const [balance, setBalance] = useState("0");
  const [pending, setPending] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState("Confirmed");
  const [hovered, setHovered] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const info = await getInfo(address);
      setHasTrustline(info.hasTrustline);
      setBalance(info.balance);
    } catch {
      setHasTrustline(false);
      setBalance("0");
    }
  }, [address, getInfo]);

  useEffect(() => {
    // On-mount + on refreshSignal external-system read (wallet trustline/balance),
    // not derived state. The refreshSignal dep re-reads after a sibling card acts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, refreshSignal]);

  const run = useCallback(
    async (action: Exclude<Action, null>) => {
      setError(null);
      setLastHash(null);
      setPending(action);
      try {
        const hash = action === "trustline" ? await addTrustline(address) : await drip(address);
        setLastHash(hash);
        setLastLabel(action === "trustline" ? "Trustline added" : `${dripAmount} ${assetCode} received`);
        await refresh();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(null);
      }
    },
    [address, refresh, onSuccess, addTrustline, drip, assetCode, dripAmount],
  );

  const busy = pending !== null;
  // Until the first read resolves we don't know which CTA to show.
  const ready = hasTrustline !== null;
  const isTrustlineStep = ready && !hasTrustline;
  const label = isTrustlineStep
    ? pending === "trustline"
      ? "Adding trustline…"
      : `Add ${assetCode} trustline`
    : pending === "drip"
      ? "Requesting…"
      : `Get ${dripAmount} test ${assetCode}`;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "16px 20px",
      }}
    >
      {/* Header row: label + TESTNET tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-2)",
          }}
        >
          Testnet {assetCode} faucet
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent)",
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          Testnet
        </span>
      </div>

      {/* Balance + helper line */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px" }}>
        <span
          className="font-mono"
          style={{
            fontSize: "20px",
            color: "var(--color-text)",
            fontFeatureSettings: '"tnum" 1',
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {hasTrustline ? `${balance} ${assetCode}` : `— ${assetCode}`}
        </span>
        <span className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)" }}>
          {isTrustlineStep
            ? `Add a trustline to receive demo ${assetCode}`
            : "Demo funds to test deposit and redeem"}
        </span>
      </div>

      {/* CTA */}
      <Button
        onClick={() => run(isTrustlineStep ? "trustline" : "drip")}
        disabled={busy || !ready}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="font-body h-auto disabled:pointer-events-auto"
        style={{
          gap: "8px",
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.01em",
          color: busy || !ready ? "var(--color-text-3)" : "var(--color-canvas)",
          backgroundColor: busy || !ready ? "var(--color-surface)" : "var(--color-accent)",
          border: busy || !ready ? "1px solid var(--color-border)" : "1px solid var(--color-accent)",
          padding: "7px 16px",
          cursor: busy || !ready ? "not-allowed" : "pointer",
          lineHeight: 1,
          opacity: hovered && !busy && ready ? 0.92 : 1,
        }}
      >
        {busy && <span className="live-dot" aria-hidden="true" />}
        <span>{ready ? label : "Checking wallet…"}</span>
      </Button>

      {error && (
        <p
          className="font-mono"
          role="alert"
          style={{ fontSize: "11px", color: "var(--color-error)", marginTop: "10px", lineHeight: 1.4 }}
        >
          {error}
        </p>
      )}

      <TxStatus hash={lastHash} label={lastLabel} />
    </div>
  );
}
