"use client";

/**
 * TestnetOnramp — demo-only USDC on-ramp (trustline + faucet).
 *
 * TESTNET ONLY. Rendered solely when `faucetEnabled` (see lib/config.ts). Our
 * demo USDC is a mock classic-asset SAC testers can't otherwise acquire, so this
 * gives them the two prerequisites for depositing: a trustline, then USDC from
 * the on-chain faucet. On mainnet users hold real USDC and this never renders.
 *
 * Design: Precision Brutalism, investidor front. Amber CTA, mono data labels,
 * a "TESTNET" tag so it never reads as a permanent product surface.
 */

import { useCallback, useEffect, useState } from "react";
import { getUsdcInfo, addTrustline, dripFaucet } from "@/lib/onramp";
import { TxStatus } from "@/components/TxStatus";

interface TestnetOnrampProps {
  /** Connected wallet public key */
  address: string;
  /** Called after a successful trustline/drip so the parent refreshes balances */
  onSuccess(): void;
}

type Action = "trustline" | "drip" | null;

export function TestnetOnramp({ address, onSuccess }: TestnetOnrampProps) {
  const [hasTrustline, setHasTrustline] = useState<boolean | null>(null);
  const [balance, setBalance] = useState("0");
  const [pending, setPending] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState("Confirmed");
  const [hovered, setHovered] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const info = await getUsdcInfo(address);
      setHasTrustline(info.hasTrustline);
      setBalance(info.balance);
    } catch {
      setHasTrustline(false);
      setBalance("0");
    }
  }, [address]);

  useEffect(() => {
    // Intentional on-mount external-system read (wallet trustline/balance), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: Exclude<Action, null>) => {
      setError(null);
      setLastHash(null);
      setPending(action);
      try {
        const hash =
          action === "trustline"
            ? await addTrustline(address)
            : await dripFaucet(address);
        setLastHash(hash);
        setLastLabel(action === "trustline" ? "Trustline added" : "1,000 USDC received");
        await refresh();
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(null);
      }
    },
    [address, refresh, onSuccess],
  );

  const busy = pending !== null;
  // Until the first read resolves we don't know which CTA to show.
  const ready = hasTrustline !== null;
  const isTrustlineStep = ready && !hasTrustline;
  const label = isTrustlineStep
    ? pending === "trustline"
      ? "Adding trustline…"
      : "Add USDC trustline"
    : pending === "drip"
      ? "Requesting…"
      : "Get 1,000 test USDC";

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
          Testnet USDC faucet
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
          {hasTrustline ? `${balance} USDC` : "— USDC"}
        </span>
        <span className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)" }}>
          {isTrustlineStep
            ? "Add a trustline to receive demo USDC"
            : "Demo funds to test deposit and redeem"}
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={() => run(isTrustlineStep ? "trustline" : "drip")}
        disabled={busy || !ready}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="font-body"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.01em",
          color: busy || !ready ? "var(--color-text-3)" : "var(--color-canvas)",
          backgroundColor:
            busy || !ready
              ? "var(--color-surface)"
              : hovered
                ? "var(--color-accent)"
                : "var(--color-accent)",
          border:
            busy || !ready
              ? "1px solid var(--color-border)"
              : "1px solid var(--color-accent)",
          padding: "7px 16px",
          cursor: busy || !ready ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          lineHeight: 1,
          opacity: hovered && !busy && ready ? 0.92 : 1,
        }}
      >
        {busy && <span className="live-dot" aria-hidden="true" />}
        <span>{ready ? label : "Checking wallet…"}</span>
      </button>

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
