"use client";

/**
 * DepositWidget — USDC amount input with live mtvR preview and deposit CTA.
 *
 * UX flow:
 *   1. User enters USDC amount (decimal input)
 *   2. Preview shows "you receive N mtvR at NAV" in real-time
 *   3. On submit: calls deposit() write helper → refreshes position on success
 *
 * Design: Precision Brutalism. Investidor front. Amber CTA — border only,
 * fills on hover. No rounding, no shadows.
 */

import { useState } from "react";
import { deposit as txDeposit } from "@/lib/tx";
import { fmtNav } from "@/lib/format";

interface DepositWidgetProps {
  /** Connected wallet public key */
  address: string;
  /** Current NAV per share, scaled 1e7 */
  navPerShare: bigint;
  /** Called with tx hash after a successful deposit; parent refreshes reads */
  onSuccess(hash: string): void;
}

function Mono({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{ fontFeatureSettings: '"tnum" 1', fontVariantNumeric: "tabular-nums", ...style }}
    >
      {children}
    </span>
  );
}

export function DepositWidget({
  address,
  navPerShare,
  onSuccess,
}: DepositWidgetProps) {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Parse USDC input to stroops (bigint)
  const usdcStroops: bigint | null = (() => {
    const parsed = parseFloat(rawInput);
    if (!rawInput || isNaN(parsed) || parsed <= 0) return null;
    // Convert to stroops: multiply by 1e7 (Stellar precision)
    return BigInt(Math.round(parsed * 1e7));
  })();

  // Estimated shares: amount_stroops * 1e7 / nav_per_share
  const estimatedShares: bigint | null =
    usdcStroops !== null && navPerShare > 0n
      ? (usdcStroops * 10_000_000n) / navPerShare
      : null;

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!usdcStroops || status === "pending") return;

    setStatus("pending");
    setErrorMsg(null);
    try {
      const hash = await txDeposit(address, usdcStroops);
      setRawInput("");
      setStatus("idle");
      onSuccess(hash);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Transaction failed");
      setStatus("error");
    }
  }

  const isPending = status === "pending";
  const canSubmit = usdcStroops !== null && !isPending;

  return (
    <section
      aria-label="Deposit USDC"
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
          Deposit USDC — Earn mtvR
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: "13px",
            color: "var(--color-text-2)",
            marginTop: "4px",
          }}
        >
          Contribute USDC to the MUTAV reserve and receive mtvR shares at current NAV.
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
            USDC Amount
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
              aria-label="USDC amount to deposit"
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
              USDC
            </span>
          </div>
        </div>

        {/* mtvR preview — evidence layer */}
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
                mtvR
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
              {navPerShare > 0n ? fmtNav(navPerShare) : "—"} USDC/mtvR
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
      </form>
    </section>
  );
}
