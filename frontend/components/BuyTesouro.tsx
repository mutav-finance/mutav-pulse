"use client";

/**
 * BuyTesouro — acquire TESOURO for the MBRL reserve via a client-side SDEX swap.
 *
 * Two steps: (1) add the TESOURO trustline (permissionless — auth_required=false),
 * (2) swap USDC → TESOURO with a strict-send path payment on the classic SDEX.
 * No KYC, no backend; the user then deposits the TESOURO into the reserve.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useCallback, useEffect, useState } from "react";
import { getTesouroInfo, addTesouroTrustline, buyTesouro, type AssetInfo } from "@/lib/buy-tesouro";
import { config } from "@/lib/config";
import { errMsg } from "@/lib/format";
import { Mono } from "@/components/Mono";
import { TxStatus } from "@/components/TxStatus";

interface BuyTesouroProps {
  /** Connected wallet public key */
  address: string;
  /** Called after a successful trustline/swap so the parent refreshes balances */
  onSuccess(hash: string): void;
}

export function BuyTesouro({ address, onSuccess }: BuyTesouroProps) {
  const [info, setInfo] = useState<AssetInfo | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await getTesouroInfo(address));
    } catch {
      /* transient Horizon error — leave prior state */
    }
  }, [address]);

  useEffect(() => {
    // Intentional on-mount external-system read (Horizon trustline/balance), not a
    // render-driven state sync — same pattern as TestnetOnramp.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: () => Promise<string>) => {
      setStatus("pending");
      setError(null);
      setLastHash(null);
      try {
        const hash = await action();
        setLastHash(hash);
        setStatus("idle");
        await refresh();
        onSuccess(hash);
      } catch (err) {
        setError(errMsg(err, "Transaction failed"));
        setStatus("error");
      }
    },
    [refresh, onSuccess],
  );

  const code = config.tesouro.code;
  const isPending = status === "pending";
  const canBuy = !!info?.hasTrustline && parseFloat(amount) > 0 && !isPending;

  return (
    <section
      aria-label={`Buy ${code}`}
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "16px" }}>
        <p
          className="font-body"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            color: "var(--color-text-2)",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          ON-RAMP
        </p>
        <h2 className="font-display" style={{ fontSize: "18px", color: "var(--color-text)", margin: 0, letterSpacing: "-0.01em" }}>
          Buy {code} — swap USDC on-chain
        </h2>
        <p className="font-body" style={{ fontSize: "13px", color: "var(--color-text-2)", marginTop: "4px", lineHeight: 1.5 }}>
          {code} is tokenized Brazilian treasury. Acquire it with a client-signed SDEX swap (no KYC), then deposit it into the reserve.
        </p>
      </div>

      {/* Balance */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)" }}>Your {code}</span>
        <Mono style={{ fontSize: "14px", color: "var(--color-text)" }}>
          {info === null ? "…" : info.balance}
        </Mono>
      </div>

      {info && !info.hasTrustline ? (
        <button
          onClick={() => run(() => addTesouroTrustline(address))}
          disabled={isPending}
          className="font-body"
          style={{
            width: "100%",
            height: "40px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: isPending ? "not-allowed" : "pointer",
            color: "var(--color-accent)",
            backgroundColor: "transparent",
            border: "1px solid var(--color-accent)",
            opacity: isPending ? 0.6 : 1,
          }}
          aria-busy={isPending}
        >
          {isPending ? "Adding…" : `Add ${code} trustline`}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canBuy) void run(() => buyTesouro(address, amount));
          }}
          noValidate
        >
          <label htmlFor="buy-amount" className="font-body" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--color-text-2)", marginBottom: "6px" }}>
            USDC to spend
          </label>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <input
              id="buy-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              disabled={isPending}
              className="font-mono"
              style={{
                width: "100%",
                backgroundColor: "transparent",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: "14px",
                padding: "10px 52px 10px 12px",
                fontFeatureSettings: '"tnum" 1',
                fontVariantNumeric: "tabular-nums",
                outline: "none",
              }}
              aria-label="USDC amount to swap for TESOURO"
            />
            <span className="font-body" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "var(--color-text-3)", pointerEvents: "none" }}>
              USDC
            </span>
          </div>
          <button
            type="submit"
            disabled={!canBuy}
            className="font-body"
            style={{
              width: "100%",
              height: "40px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: canBuy ? "pointer" : "not-allowed",
              color: canBuy ? "var(--color-accent)" : "var(--color-text-3)",
              backgroundColor: "transparent",
              border: `1px solid ${canBuy ? "var(--color-accent)" : "var(--color-border)"}`,
              opacity: isPending ? 0.6 : 1,
            }}
            aria-busy={isPending}
          >
            {isPending ? "Swapping…" : `Buy ${code}`}
          </button>
        </form>
      )}

      {error && (
        <p className="font-mono" role="alert" style={{ fontSize: "11px", color: "var(--color-error)", marginTop: "12px", lineHeight: 1.4 }}>
          {error}
        </p>
      )}
      <TxStatus hash={lastHash} label={`${code} received`} />
    </section>
  );
}
