"use client";

/**
 * InvestCard — the sticky right-column action card of the 2-column reserve hub.
 *
 * Stacks: position summary (NAV / my shares / value) → on-ramp (Buy TESOURO or the
 * testnet faucet) → a Deposit | Withdraw toggle (the column is ~380px, so the two
 * widgets can't sit side-by-side). Owns the position data fetch + refresh-on-tx.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber). Surface-stacked
 * blocks, hairline borders, no shadows, amber only on the Deposit CTA + active tab.
 */

import { useEffect, useState, useCallback } from "react";
import type { Reads } from "@/lib/contracts";
import type { Reserve } from "@/lib/reserves";
import { useWallet } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { DepositWidget } from "@/components/DepositWidget";
import { RedeemPanel } from "@/components/RedeemPanel";
import { TestnetOnramp } from "@/components/TestnetOnramp";
import { BuyTesouro } from "@/components/BuyTesouro";
import { Mono } from "@/components/Mono";
import { faucetEnabled, config } from "@/lib/config";
import { fmtNav, fmtFiat, fmtAmount, fmtUnitPrice, fromStroops, errMsg, STROOP_SCALE } from "@/lib/format";
import type { RedeemRequest } from "vault";

interface EarnData {
  navPerShare: bigint;
  balance: bigint;
  pendingIds: number[];
  requests: Map<number, RedeemRequest>;
  loading: boolean;
  error: string | null;
}

const EMPTY_DATA: EarnData = {
  navPerShare: 0n,
  balance: 0n,
  pendingIds: [],
  requests: new Map(),
  loading: false,
  error: null,
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--color-text-3)",
  textTransform: "uppercase",
  margin: "0 0 4px",
};

export function InvestCard({ reads, reserve }: { reads: Reads; reserve: Reserve }) {
  const { address } = useWallet();
  const [data, setData] = useState<EarnData>({ ...EMPTY_DATA, loading: true });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const handleSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true, error: null }));
    async function fetchAll() {
      try {
        const navPerShare = await reads.vaultNavPerShare();
        if (cancelled) return;
        if (!address) {
          setData({ ...EMPTY_DATA, navPerShare, loading: false });
          return;
        }
        const [balance, pendingIds] = await Promise.all([
          reads.vaultBalance(address),
          reads.vaultPendingRequests(),
        ]);
        if (cancelled) return;
        const requestEntries = await Promise.all(
          pendingIds.map(async (id) => {
            const req = await reads.vaultRequest(BigInt(id));
            return [id, req] as [number, RedeemRequest];
          }),
        );
        if (cancelled) return;
        setData({ navPerShare, balance, pendingIds, requests: new Map(requestEntries), loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({ ...prev, loading: false, error: errMsg(err, "Failed to load position") }));
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey, reads]);

  const navStr = data.navPerShare > 0n ? fmtNav(data.navPerShare) : "—";
  const myShares = fromStroops(data.balance).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  // Position in deposit-token units (exact), then converted to indicative fiat.
  const positionTokens = data.navPerShare > 0n ? (data.balance * data.navPerShare) / STROOP_SCALE : 0n;
  const value = data.navPerShare > 0n ? fmtFiat(positionTokens, reserve) : "—";
  const valueTokens = data.navPerShare > 0n ? fmtAmount(positionTokens, reserve.depositToken) : "—";
  // Show the indicative unit price only when the deposit token isn't fiat-pegged
  // (e.g. TESOURO ≈ R$1.22 ≠ 1:1) — makes the not-1:1 reality explicit.
  const showUnitPrice = reserve.unitPriceFiat !== 1;

  return (
    <aside
      aria-label="Invest"
      style={{
        position: "sticky",
        top: "88px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* ── Position summary ───────────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: address ? "1fr 1fr" : "1fr",
            gap: "1px",
            backgroundColor: "var(--color-border)",
          }}
        >
          <div style={{ backgroundColor: "var(--color-surface)", padding: "16px 18px" }}>
            <p className="font-body" style={STAT_LABEL}>NAV / {reserve.currency}</p>
            <p className="font-display" style={{ fontSize: "26px", lineHeight: 1, color: "var(--color-text)", letterSpacing: "-0.02em", margin: 0 }}>
              <Mono>{navStr}</Mono>
            </p>
            <p className="font-mono" style={{ fontSize: "10px", color: "var(--color-text-3)", margin: "4px 0 0" }}>
              {reserve.depositToken} per {reserve.currency} share
            </p>
          </div>
          {address && (
            <div style={{ backgroundColor: "var(--color-surface)", padding: "16px 18px" }}>
              <p className="font-body" style={STAT_LABEL}>Position value</p>
              <p className="font-display" style={{ fontSize: "26px", lineHeight: 1, color: "var(--color-accent)", letterSpacing: "-0.02em", margin: 0 }}>
                <Mono>{value}</Mono>
              </p>
              <p className="font-mono" style={{ fontSize: "10px", color: "var(--color-text-3)", margin: "4px 0 0" }}>
                {myShares} {reserve.currency} · {valueTokens}
              </p>
            </div>
          )}
        </div>
        {/* Indicative unit price — only for non-fiat-pegged underlyings (TESOURO ≠ 1:1) */}
        {showUnitPrice && (
          <p
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-text-3)",
              margin: 0,
              padding: "8px 18px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            1 {reserve.depositToken} ≈ {fmtUnitPrice(reserve)} · indicative
          </p>
        )}
      </div>

      {/* ── Disconnected gate ──────────────────────────────────────────── */}
      {!address ? (
        <div style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", padding: "28px 24px", textAlign: "center" }}>
          <p className="font-display" style={{ fontSize: "17px", color: "var(--color-text)", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
            CONNECT TO INVEST
          </p>
          <p className="font-body" style={{ fontSize: "13px", color: "var(--color-text-2)", margin: "0 0 20px", lineHeight: 1.5 }}>
            Connect a Stellar testnet wallet to acquire {reserve.depositToken}, deposit, and receive {reserve.currency} shares.
          </p>
          <ConnectButton />
        </div>
      ) : (
        <>
          {data.error && (
            <div role="alert" style={{ border: "1px solid var(--color-error)", backgroundColor: "var(--color-surface)", padding: "12px 16px" }}>
              <p className="font-mono" style={{ fontSize: "11px", color: "var(--color-error)", margin: 0 }}>{data.error}</p>
            </div>
          )}

          {/* On-ramp — acquire the deposit token */}
          {reserve.depositToken === config.tesouro.code ? (
            <BuyTesouro address={address} money={reserve} onSuccess={handleSuccess} />
          ) : faucetEnabled ? (
            <TestnetOnramp address={address} onSuccess={handleSuccess} />
          ) : null}

          {/* Deposit | Withdraw toggle */}
          <div>
            <div role="tablist" style={{ display: "flex", gap: "20px", borderBottom: "1px solid var(--color-border)", marginBottom: "16px" }}>
              {(["deposit", "withdraw"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className="font-mono"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: mode === m ? "var(--color-text)" : "var(--color-text-2)",
                    borderBottom: mode === m ? "2px solid var(--color-accent)" : "2px solid transparent",
                    padding: "0 0 10px",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            {mode === "deposit" ? (
              <DepositWidget
                address={address}
                navPerShare={data.navPerShare}
                depositToken={reserve.depositToken}
                shareSymbol={reserve.currency}
                contracts={reserve.contracts!}
                onSuccess={handleSuccess}
              />
            ) : (
              <RedeemPanel
                address={address}
                balance={data.balance}
                requestIds={data.pendingIds}
                requests={data.requests}
                depositToken={reserve.depositToken}
                shareSymbol={reserve.currency}
                contracts={reserve.contracts!}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </>
      )}
    </aside>
  );
}
