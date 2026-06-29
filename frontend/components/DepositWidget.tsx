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
import { fmtNav, parseToStroops, errMsg } from "@/lib/format";
import { sharesFor } from "@/lib/economics";
import { TxStatus } from "@/components/TxStatus";
import { Mono } from "@/components/Mono";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      setErrorMsg(errMsg(err));
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
          <Label
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
          </Label>
          <div style={{ position: "relative" }}>
            <Input
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
              style={{
                // Override the primitive's h-9 / px-3 py-1 to preserve the
                // original natural-height + suffix-room padding (52px right).
                height: "auto",
                padding: "10px 52px 10px 12px",
                fontFeatureSettings: '"tnum" 1',
                // focus ring comes from the global :focus-visible rule.
                // Native control scheme (number spinner) comes from the front's
                // `color-scheme` in globals.css — no per-input override needed.
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

        {/* Primary CTA — always-clickable solid amber button.
            `default` variant = amber fill + canvas text; override to the original
            full-width 40px size, 8px gap, amber border, and the darker amber-600
            hover (vs the variant's default bg-primary/90). */}
        <Button
          type="submit"
          variant="default"
          disabled={isPending}
          className="font-body w-full h-10 gap-2 border-[var(--color-accent)] hover:bg-[var(--color-amber-600)]"
          style={{
            letterSpacing: "0.01em",
            cursor: isPending ? "not-allowed" : "pointer",
            // Preserve the original 0.6 pending opacity over the primitive's
            // disabled:opacity-40.
            opacity: isPending ? 0.6 : 1,
            transition: "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
          }}
          aria-busy={isPending}
        >
          {isPending && <span className="live-dot" aria-hidden="true" />}
          {isPending ? "Depositing…" : "Deposit"}
        </Button>

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
