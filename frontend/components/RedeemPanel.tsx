"use client";

/**
 * RedeemPanel — request redemption, list pending/claimable requests,
 * and claim or cancel them.
 *
 * UX flow:
 *   1. Enter share amount → requestRedeem() → appears in queue
 *   2. Queue list shows each request's status via classifyRequest()
 *   3. "Claim" on claimable requests → claim()
 *   4. "Cancel" on pending requests → cancelRedeem()
 *
 * Design: Precision Brutalism — Investidor dark front.
 * Status badges: 6×6px square, no fill, per STYLE.md §3.5.
 */

import { useState } from "react";
import { requestRedeem as txRequestRedeem, claim as txClaim, cancelRedeem as txCancelRedeem } from "@/lib/tx";
import { classifyRequest, type RequestStatus } from "@/lib/queue";
import { fmtNav, fromStroops, stroopsToInput, STROOP_SCALE_NUM, errMsg } from "@/lib/format";
import { TxStatus } from "@/components/TxStatus";
import { Mono } from "@/components/Mono";
import type { RedeemRequest } from "vault";

interface RedeemPanelProps {
  /** Connected wallet public key */
  address: string;
  /** User's current MTVR share balance in stroops */
  balance: bigint;
  /** All pending request IDs from vaultPendingRequests() */
  requestIds: number[];
  /** Resolved request objects, keyed by id */
  requests: Map<number, RedeemRequest>;
  /** Underlying token ticker redemptions pay out (e.g. "USDC" for the MUSD reserve) */
  depositToken: string;
  /** Called with tx hash after a successful tx; parent refreshes reads */
  onSuccess(hash: string): void;
}

/** 6×6px status square — no rounded corners, no fill per STYLE.md §3.5 */
function StatusBadge({ status }: { status: RequestStatus }) {
  const squareColor: Record<RequestStatus, string> = {
    pending: "var(--color-text-3)",
    claimable: "var(--color-accent)",
    claimed: "var(--color-success)",
  };
  const label: Record<RequestStatus, string> = {
    pending: "PENDING",
    claimable: "CLAIMABLE",
    claimed: "CLAIMED",
  };
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
      aria-label={`Status: ${label[status]}`}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "6px",
          height: "6px",
          backgroundColor: squareColor[status],
          flexShrink: 0,
          // No border-radius
        }}
      />
      <Mono style={{ fontSize: "11px", color: "var(--color-text-2)" }}>
        {label[status]}
      </Mono>
    </span>
  );
}

export function RedeemPanel({
  address,
  balance,
  requestIds,
  requests,
  depositToken,
  onSuccess,
}: RedeemPanelProps) {
  const [rawInput, setRawInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<"idle" | "pending" | "error">("idle");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  // Last confirmed tx for any action in this panel (request / claim / cancel).
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastLabel, setLastLabel] = useState("Confirmed");

  // Per-request action state: Map<requestId, "pending" | "error">
  const [actionState, setActionState] = useState<Map<number, "pending" | "error">>(new Map());
  const [actionErrors, setActionErrors] = useState<Map<number, string>>(new Map());

  // Hover state for CTA button
  const [isHovered, setIsHovered] = useState(false);

  // Parse share input to stroops
  const sharesStroops: bigint | null = (() => {
    const parsed = parseFloat(rawInput);
    if (!rawInput || isNaN(parsed) || parsed <= 0) return null;
    return BigInt(Math.round(parsed * STROOP_SCALE_NUM));
  })();

  const shareBalanceDisplay = fromStroops(balance);
  const canSubmit = sharesStroops !== null && redeemStatus !== "pending" && balance > 0n;

  async function handleRequestRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!sharesStroops || redeemStatus === "pending") return;

    setRedeemStatus("pending");
    setRedeemError(null);
    setLastHash(null);
    try {
      const hash = await txRequestRedeem(address, sharesStroops);
      setRawInput("");
      setRedeemStatus("idle");
      setLastHash(hash);
      setLastLabel("Redemption requested");
      onSuccess(hash);
    } catch (err) {
      setRedeemError(errMsg(err));
      setRedeemStatus("error");
    }
  }

  async function handleClaim(id: number) {
    setActionState((prev) => new Map(prev).set(id, "pending"));
    setActionErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    try {
      const hash = await txClaim(address, BigInt(id));
      setActionState((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setLastHash(hash);
      setLastLabel(`Claimed #${id}`);
      onSuccess(hash);
    } catch (err) {
      const msg = errMsg(err, "Failed");
      setActionState((prev) => new Map(prev).set(id, "error"));
      setActionErrors((prev) => new Map(prev).set(id, msg));
    }
  }

  async function handleCancel(id: number) {
    setActionState((prev) => new Map(prev).set(id, "pending"));
    setActionErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    try {
      const hash = await txCancelRedeem(address, BigInt(id));
      setActionState((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setLastHash(hash);
      setLastLabel(`Cancelled #${id}`);
      onSuccess(hash);
    } catch (err) {
      const msg = errMsg(err, "Failed");
      setActionState((prev) => new Map(prev).set(id, "error"));
      setActionErrors((prev) => new Map(prev).set(id, msg));
    }
  }

  // Filter requests that belong to this user
  const myRequests = requestIds
    .map((id) => requests.get(id))
    .filter((r): r is RedeemRequest => r !== undefined && r.owner === address);

  return (
    <section
      aria-label="Redeem MTVR shares"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "24px",
      }}
    >
      {/* Header */}
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
          REDEEM
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
          Redeem MTVR — Queue {depositToken}
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: "13px",
            color: "var(--color-text-2)",
            marginTop: "4px",
          }}
        >
          Submit a redemption request. Once fulfilled by the vault operator, claim your {depositToken}.
        </p>
      </div>

      {/* Request form */}
      <form onSubmit={handleRequestRedeem} noValidate style={{ marginBottom: "28px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="redeem-shares"
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
            Shares to redeem
          </label>

          {/* Balance hint */}
          <p style={{ fontSize: "11px", color: "var(--color-text-3)", marginBottom: "6px" }}>
            <Mono>
              Available: {shareBalanceDisplay.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} MTVR
            </Mono>
          </p>

          <div style={{ position: "relative" }}>
            <input
              id="redeem-shares"
              type="number"
              min="0"
              step="0.0001"
              placeholder="0.0000"
              value={rawInput}
              onChange={(e) => {
                setRawInput(e.target.value);
                if (redeemStatus === "error") setRedeemStatus("idle");
                if (lastHash) setLastHash(null);
              }}
              disabled={redeemStatus === "pending" || balance === 0n}
              className="font-mono"
              style={{
                width: "100%",
                backgroundColor: "transparent",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: "14px",
                padding: "10px 56px 10px 12px",
                fontFeatureSettings: '"tnum" 1',
                fontVariantNumeric: "tabular-nums",
                outline: "none",
              }}
              aria-label="MTVR shares to redeem"
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
              MTVR
            </span>
          </div>
        </div>

        {/* Max button — fill input with full balance */}
        {balance > 0n && (
          <button
            type="button"
            onClick={() => setRawInput(stroopsToInput(balance))}
            className="font-body"
            style={{
              fontSize: "11px",
              color: "var(--color-accent)",
              background: "none",
              border: "none",
              padding: "0",
              cursor: "pointer",
              letterSpacing: "0.01em",
              marginBottom: "16px",
              display: "block",
            }}
          >
            Use max balance
          </button>
        )}

        {/* Error message */}
        {redeemError && (
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
            {redeemError}
          </p>
        )}

        {/* Submit button */}
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
            // Neutral secondary — Deposit is the singular amber CTA (amber is precious)
            backgroundColor:
              canSubmit && isHovered ? "var(--color-surface-3)" : "transparent",
            color: canSubmit ? "var(--color-text)" : "var(--color-text-3)",
            border: `1px solid ${
              canSubmit
                ? isHovered
                  ? "var(--color-text-2)"
                  : "var(--color-text-3)"
                : "var(--color-border)"
            }`,
            opacity: redeemStatus === "pending" ? 0.6 : 1,
            transition:
              "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
          }}
          aria-busy={redeemStatus === "pending"}
        >
          {redeemStatus === "pending" && (
            <span className="live-dot" aria-hidden="true" />
          )}
          {redeemStatus === "pending" ? "Submitting…" : "Request Redemption"}
        </button>

        {/* Inline confirmation — covers request / claim / cancel for this panel */}
        <TxStatus hash={lastHash} label={lastLabel} />
      </form>

      {/* Queue list */}
      {myRequests.length > 0 && (
        <div>
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-2)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            YOUR REQUESTS
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {myRequests.map((req) => {
              const status = classifyRequest(req);
              const isPending = actionState.get(req.id) === "pending";
              const actionErr = actionErrors.get(req.id);

              return (
                <li
                  key={req.id}
                  style={{
                    padding: "14px 16px",
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    {/* Left: request details */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "6px",
                        }}
                      >
                        <Mono style={{ fontSize: "12px", color: "var(--color-text-3)" }}>
                          #{req.id}
                        </Mono>
                        <StatusBadge status={status} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <Mono style={{ fontSize: "13px", color: "var(--color-text)" }}>
                          {fmtNav(req.shares)} MTVR
                        </Mono>
                        {status === "claimable" && req.claimable > 0n && (
                          <Mono style={{ fontSize: "11px", color: "var(--color-success)" }}>
                            {(Number(req.claimable) / STROOP_SCALE_NUM).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {depositToken} claimable
                          </Mono>
                        )}
                      </div>
                    </div>

                    {/* Right: action buttons */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        alignItems: "flex-end",
                        flexShrink: 0,
                      }}
                    >
                      {status === "claimable" && (
                        <button
                          onClick={() => handleClaim(req.id)}
                          disabled={isPending}
                          className="font-body"
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "var(--color-success)",
                            border: "1px solid var(--color-success)",
                            background: "transparent",
                            padding: "5px 12px",
                            cursor: isPending ? "not-allowed" : "pointer",
                            opacity: isPending ? 0.5 : 1,
                            letterSpacing: "0.01em",
                            transition:
                              "color 150ms ease-out, background-color 150ms ease-out",
                          }}
                          aria-busy={isPending}
                        >
                          {isPending ? "…" : "Claim"}
                        </button>
                      )}
                      {status === "pending" && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          disabled={isPending}
                          className="font-body"
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            color: "var(--color-text-3)",
                            border: "1px solid var(--color-border)",
                            background: "transparent",
                            padding: "5px 12px",
                            cursor: isPending ? "not-allowed" : "pointer",
                            opacity: isPending ? 0.5 : 1,
                            letterSpacing: "0.01em",
                            transition:
                              "color 150ms ease-out, border-color 150ms ease-out",
                          }}
                          aria-busy={isPending}
                        >
                          {isPending ? "…" : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Per-request error */}
                  {actionErr && (
                    <p
                      className="font-mono"
                      role="alert"
                      style={{
                        fontSize: "11px",
                        color: "var(--color-error)",
                        marginTop: "8px",
                        letterSpacing: "0.01em",
                        lineHeight: 1.4,
                      }}
                    >
                      {actionErr}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Empty queue state */}
      {myRequests.length === 0 && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            textAlign: "center",
          }}
        >
          <p
            className="font-body"
            style={{ fontSize: "13px", color: "var(--color-text-3)" }}
          >
            No redemption requests. Submit one above.
          </p>
        </div>
      )}
    </section>
  );
}
