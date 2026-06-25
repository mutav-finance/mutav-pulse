"use client";

/**
 * DepositWidget — deposit-token amount input with live MTVR preview and CTA.
 * The token ticker is reserve-driven via the `depositToken` prop (e.g. "USDC").
 *
 * UX flow:
 *   1. User enters a deposit-token amount (decimal input)
 *   2. Preview shows "you receive N MTVR at NAV" in real-time
 *   3. On submit: calls deposit() write helper → refreshes position on success
 *
 * Design: Precision Brutalism. Investidor front. Amber CTA — border only,
 * fills on hover. No rounding, no shadows.
 */

import { useState } from "react";
import { deposit as txDeposit } from "@/lib/tx";
import { fmtNav, STROOP_SCALE, STROOP_SCALE_NUM, errMsg } from "@/lib/format";
import { TxStatus } from "@/components/TxStatus";
import { Mono } from "@/components/Mono";

interface DepositWidgetProps {
  /** Connected wallet public key */
  address: string;
  /** Current NAV per share, scaled 1e7 */
  navPerShare: bigint;
  /** Underlying token ticker the user deposits (e.g. "USDC" for the MUSD reserve) */
  depositToken: string;
  /** Called with tx hash after a successful deposit; parent refreshes reads */
  onSuccess(hash: string): void;
}

export function DepositWidget({
  address,
  navPerShare,
  depositToken,
  onSuccess,
}: DepositWidgetProps) {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Parse USDC input to stroops (bigint)
  const usdcStroops: bigint | null = (() => {
    const parsed = parseFloat(rawInput);
    if (!rawInput || isNaN(parsed) || parsed <= 0) return null;
    // Convert to stroops: multiply by 1e7 (Stellar precision)
    return BigInt(Math.round(parsed * STROOP_SCALE_NUM));
  })();

  // Estimated shares: amount_stroops * 1e7 / nav_per_share
  const estimatedShares: bigint | null =
    usdcStroops !== null && navPerShare > 0n
      ? (usdcStroops * STROOP_SCALE) / navPerShare
      : null;

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!usdcStroops || status === "pending") return;

    setStatus("pending");
    setErrorMsg(null);
    setLastHash(null);
    try {
      const hash = await txDeposit(address, usdcStroops);
      setRawInput("");
      setStatus("idle");
      setLastHash(hash);
      onSuccess(hash);
    } catch (err) {
      setErrorMsg(errMsg(err));
      setStatus("error");
    }
  }

  const isPending = status === "pending";
  const canSubmit = usdcStroops !== null && !isPending;

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
            margin: 0,
          }}
        >
          Deposit {depositToken} — Earn MTVR
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: "13px",
            color: "var(--color-text-2)",
            marginTop: "4px",
          }}
        >
          Contribute {depositToken} to the MUTAV reserve and receive MTVR shares at current NAV.
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
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: "14px",
                padding: "10px 52px 10px 12px",
                fontFeatureSettings: '"tnum" 1',
                fontVariantNumeric: "tabular-nums",
                outline: "none",
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

        {/* MTVR preview — evidence layer */}
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
                MTVR
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
              {navPerShare > 0n ? fmtNav(navPerShare) : "—"} {depositToken}/MTVR
            </Mono>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <p
            className="font-mono"
            role="alert"
            style={{
              fontSize: "11px",
              color: "var(--color-error)",
              marginBottom: "12px",
              letterSpacing: "0.01em",
              lineHeight: 1.4,
            }}
          >
            {errorMsg}
          </p>
        )}

        {/* Primary CTA — Investidor amber outline button */}
        <button
          type="submit"
          disabled={!canSubmit}
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
            cursor: canSubmit ? "pointer" : "not-allowed",
            // Investidor primary button spec
            backgroundColor:
              canSubmit && isHovered ? "var(--color-accent)" : "transparent",
            color:
              canSubmit && isHovered
                ? "var(--color-canvas)"
                : canSubmit
                ? "var(--color-accent)"
                : "var(--color-text-3)",
            border: `1px solid ${canSubmit ? "var(--color-accent)" : "var(--color-border)"}`,
            // No border-radius
            opacity: isPending ? 0.6 : 1,
            transition: "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
          }}
          aria-busy={isPending}
        >
          {isPending && <span className="live-dot" aria-hidden="true" />}
          {isPending ? "Depositing…" : "Deposit"}
        </button>

        {/* Inline confirmation — tx state lives on the component that triggered it */}
        <TxStatus hash={lastHash} label="Deposit confirmed" />
      </form>
    </section>
  );
}
