"use client";

/**
 * DepositWidget — deposit-token amount input with live share preview and CTA.
 * Both tickers are reserve-driven: `depositToken` (e.g. "USDC"/"TESOURO") in,
 * `shareSymbol` (the reserve's currency, e.g. "MUSD"/"MBRL") out.
 *
 * UX flow:
 *   1. User enters a deposit-token amount (decimal input)
 *   2. Preview shows "you receive N <shareSymbol> at NAV" in real-time
 *   3. On submit: calls deposit() write helper → refreshes position on success
 *
 * Design: Precision Brutalism. Investidor front. Amber CTA — border only,
 * fills on hover. No rounding, no shadows.
 */

import { useState } from "react";
import { deposit as txDeposit } from "@/lib/tx";
import type { ReserveContracts } from "@/lib/contracts";
import { fmtNav, parseToStroops, treatTxError } from "@/lib/format";
import { sharesFor } from "@/lib/economics";
import { TxStatus } from "@/components/TxStatus";
import { Mono } from "@/components/Mono";

interface DepositWidgetProps {
  /** Connected wallet public key */
  address: string;
  /** Current NAV per share, scaled 1e7 */
  navPerShare: bigint;
  /** Underlying token ticker the user deposits (e.g. "USDC" for the MUSD reserve) */
  depositToken: string;
  /** Share-token symbol the user receives — the reserve's currency (e.g. "MBRL"). */
  shareSymbol: string;
  /** The active reserve's contract triple — deposits write to this vault */
  contracts: ReserveContracts;
  /** Called with tx hash after a successful deposit; parent refreshes reads */
  onSuccess(hash: string): void;
}

export function DepositWidget({
  address,
  navPerShare,
  depositToken,
  shareSymbol,
  contracts,
  onSuccess,
}: DepositWidgetProps) {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Parse USDC input to stroops (bigint) — exact decimal-string parse, no float.
  const usdcStroops: bigint | null = parseToStroops(rawInput);

  // Estimated shares at current NAV (assets → shares).
  const estimatedShares: bigint | null =
    usdcStroops !== null && navPerShare > 0n
      ? sharesFor(usdcStroops, navPerShare)
      : null;

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "pending") return;
    if (!usdcStroops) {
      setErrorMsg(`Enter an amount of ${depositToken} to deposit.`);
      setStatus("error");
      return;
    }

    setStatus("pending");
    setErrorMsg(null);
    setLastHash(null);
    try {
      const hash = await txDeposit(contracts, address, usdcStroops);
      setRawInput("");
      setStatus("idle");
      setLastHash(hash);
      onSuccess(hash);
    } catch (err) {
      const t = treatTxError(err, "deposit");
      setErrorMsg(t.action ? `${t.message} ${t.action}` : t.message);
      setStatus("error");
    }
  }

  const isPending = status === "pending";

  return (
    <section
      aria-label={`Deposit ${depositToken}`}
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "24px",
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: "20px" }}>
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
          DEPOSIT
        </p>
        <h2
          className="font-display"
          style={{
            fontSize: "18px",
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Deposit {depositToken} / Earn {shareSymbol}
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: "13px",
            color: "var(--color-text-2)",
            marginTop: "4px",
          }}
        >
          Contribute {depositToken} to the reserve and receive {shareSymbol} shares at current NAV.
        </p>
      </div>

      <form onSubmit={handleDeposit} noValidate>
        {/* Amount input */}
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="deposit-amount"
            className="font-body"
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--color-text-2)",
              marginBottom: "6px",
              letterSpacing: "0.01em",
            }}
          >
            {depositToken} Amount
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="deposit-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                if (status === "error") setStatus("idle");
                if (lastHash) setLastHash(null);
              }}
              disabled={isPending}
              className="font-mono"
              style={{
                width: "100%",
                backgroundColor: "transparent",
                border: "1px solid var(--color-border-input)",
                color: "var(--color-text)",
                fontSize: "14px",
                padding: "10px 52px 10px 12px",
                fontFeatureSettings: '"tnum" 1',
                fontVariantNumeric: "tabular-nums",
                // focus ring comes from the global :focus-visible rule
                // Dark native controls (number spinner) instead of the light default.
                colorScheme: "dark",
                // No border-radius (Precision Brutalism)
              }}
              aria-label={`${depositToken} amount to deposit`}
            />
            <span
              className="font-body"
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "12px",
                color: "var(--color-text-3)",
                pointerEvents: "none",
                letterSpacing: "0.02em",
              }}
            >
              {depositToken}
            </span>
          </div>
        </div>

        {/* Share preview — evidence layer */}
        <div
          style={{
            padding: "12px",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              className="font-body"
              style={{ fontSize: "12px", color: "var(--color-text-2)" }}
            >
              You receive
            </span>
            <span>
              <Mono
                style={{
                  fontSize: "16px",
                  color: estimatedShares !== null ? "var(--color-text)" : "var(--color-text-3)",
                }}
              >
                {estimatedShares !== null
                  ? fmtNav(estimatedShares)
                  : "—"}
              </Mono>
              <span
                className="font-body"
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-2)",
                  marginLeft: "6px",
                }}
              >
                {shareSymbol}
              </span>
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "8px",
              paddingTop: "8px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <span
              className="font-body"
              style={{ fontSize: "12px", color: "var(--color-text-3)" }}
            >
              at NAV
            </span>
            <Mono style={{ fontSize: "12px", color: "var(--color-text-3)" }}>
              {navPerShare > 0n ? fmtNav(navPerShare) : "—"} {depositToken}/{shareSymbol}
            </Mono>
          </div>
        </div>

        {/* Primary CTA — always-clickable solid amber button */}
        <button
          type="submit"
          disabled={isPending}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="font-body"
          style={{
            width: "100%",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            fontSize: "14px",
            fontWeight: 500,
            letterSpacing: "0.01em",
            cursor: isPending ? "not-allowed" : "pointer",
            // Always-prominent, always-clickable solid amber CTA.
            backgroundColor: !isPending && isHovered ? "var(--color-amber-600)" : "var(--color-accent)",
            color: "var(--color-canvas)",
            border: "1px solid var(--color-accent)",
            // No border-radius
            opacity: isPending ? 0.6 : 1,
            transition: "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
          }}
          aria-busy={isPending}
        >
          {isPending && <span className="live-dot" aria-hidden="true" />}
          {isPending ? "Depositing…" : "Deposit"}
        </button>

        {/* Error feedback — space is always reserved so the box never shifts. */}
        <p
          className="font-mono"
          role="alert"
          style={{
            fontSize: "11px",
            color: "var(--color-error)",
            marginTop: "12px",
            minHeight: "15px",
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          {errorMsg}
        </p>

        {/* Inline confirmation — tx state lives on the component that triggered it */}
        <TxStatus hash={lastHash} label="Deposit confirmed" />
      </form>
    </section>
  );
}
