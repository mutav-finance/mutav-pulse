"use client";

/**
 * BuyTesouro — acquire cTSR for the MTESOURO reserve via a client-side Soroswap swap.
 *
 * Two steps: (1) add the cTSR trustline (permissionless — auth_required=false),
 * (2) swap cUSD → cTSR on the Soroswap AMM (cUSD→cTSR pool). No KYC, no backend;
 * the user then deposits the cTSR into the reserve.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useCallback, useEffect, useState } from "react";
import { getTesouroInfo, addTesouroTrustline, buyTesouro, type AssetInfo } from "@/lib/buy-tesouro";
import { config, tesouroSwapEnabled } from "@/lib/config";
import { treatTxError, fmtUnitPrice, parseToStroops, type Money, type TxContext } from "@/lib/format";
import { Mono } from "@/components/Mono";
import { TxStatus } from "@/components/TxStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BuyTesouroProps {
  /** Connected wallet public key */
  address: string;
  /** Reserve money context — for the indicative TESOURO unit price (≠ 1:1 fiat). */
  money: Money;
  /** Called after a successful trustline/swap so the parent refreshes balances */
  onSuccess(hash: string): void;
  /**
   * Bumped by the parent after any tx so this card re-reads its trustline/balance.
   * Needed because the cTSR Fund tab stacks this card with TesouroFaucet — both own
   * the same cTSR trustline, so an action in one must refresh the other.
   */
  refreshSignal?: number;
}

export function BuyTesouro({ address, money, onSuccess, refreshSignal }: BuyTesouroProps) {
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
    // On-mount + on refreshSignal external-system read (Horizon trustline/balance),
    // not a render-driven state sync — same pattern as the faucet card. The
    // refreshSignal dep re-reads after a sibling card (TesouroFaucet) acts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh, refreshSignal]);

  const run = useCallback(
    async (action: () => Promise<string>, ctx: TxContext) => {
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
        const t = treatTxError(err, ctx);
        setError(t.action ? `${t.message} ${t.action}` : t.message);
        setStatus("error");
      }
    },
    [refresh, onSuccess],
  );

  const code = config.tesouro.code;
  const isPending = status === "pending";
  // Validate with the SAME parser buyTesouro uses (parseToStroops), not parseFloat —
  // parseFloat accepts exponent input like "1e3" that parseToStroops rejects, which
  // would otherwise enable the button then hard-error at swap time.
  const canBuy = !!info?.hasTrustline && (parseToStroops(amount) ?? 0n) > 0n && !isPending;

  // The swap isn't available in this deploy — missing cTSR issuer or Soroswap
  // router id. The trustline/swap would throw, so surface that up front instead.
  if (!tesouroSwapEnabled) {
    return (
      <section
        aria-label={`Buy ${code}`}
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          padding: "24px",
        }}
      >
        <p
          className="font-body"
          style={{ fontSize: "13px", color: "var(--color-text-2)", margin: 0, lineHeight: 1.5 }}
        >
          The {code} swap is not configured in this environment. Set{" "}
          <Mono style={{ fontSize: "12px" }}>NEXT_PUBLIC_SOROSWAP_ROUTER_ID</Mono>{" "}
          (and the {code} issuer) to enable the on-chain swap.
        </p>
      </section>
    );
  }

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
          SWAP
        </p>
        <h2 className="font-display" style={{ fontSize: "18px", color: "var(--color-text)", margin: 0, letterSpacing: "-0.01em" }}>
          Buy {code}: swap cUSD on Soroswap
        </h2>
        <p className="font-body" style={{ fontSize: "13px", color: "var(--color-text-2)", marginTop: "4px", lineHeight: 1.5 }}>
          {code} is tokenized Brazilian treasury. Acquire it with a client-signed Soroswap AMM swap (no KYC), then deposit it into the reserve.
        </p>
        <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)", marginTop: "8px" }}>
          1 {code} ≈ {fmtUnitPrice(money)} · indicative. {code} is yield-bearing, not 1:1 with BRL
        </p>
        <p className="font-body" style={{ fontSize: "11px", color: "var(--color-text-3)", marginTop: "6px", lineHeight: 1.4 }}>
          Testnet pool: large swaps move the price; if the swap fails, try a smaller amount.
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
        <Button
          variant="outline"
          onClick={() => run(() => addTesouroTrustline(address), "trustline")}
          disabled={isPending}
          // Resting/disabled look is driven by inline style (amber outline, transparent);
          // neutralize the outline variant's amber hover-fill to preserve the original
          // no-hover behavior at parity.
          className="font-body hover:bg-transparent hover:text-[var(--color-accent)] hover:[border-color:var(--color-accent)]"
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
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canBuy) void run(() => buyTesouro(address, amount), "swap");
          }}
          noValidate
        >
          <Label htmlFor="buy-amount" className="font-body" style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--color-text-2)", marginBottom: "6px" }}>
            cUSD to spend
          </Label>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Input
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
              aria-label="cUSD amount to swap for cTSR"
            />
            <span className="font-body" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "var(--color-text-3)", pointerEvents: "none" }}>
              cUSD
            </span>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={!canBuy}
            // Inline style carries the enabled (amber) / disabled (muted) resting look;
            // hover overrides keep the enabled hover identical to rest (no amber fill).
            className="font-body hover:bg-transparent hover:text-[var(--color-accent)] hover:[border-color:var(--color-accent)]"
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
          </Button>
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
