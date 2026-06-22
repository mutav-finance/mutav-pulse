"use client";

/**
 * /earn — Deposit / Redeem screen
 *
 * Layout:
 *   - NAV/APY hero (Declaration layer)
 *   - PositionPanel (connected user's mtvR balance + USDC value)
 *   - DepositWidget (USDC → mtvR with live NAV preview)
 *   - RedeemPanel  (mtvR → queue + claim/cancel)
 *
 * Data: all reads from lib/contracts.ts reads object.
 * Refresh: `refreshKey` increments after each successful tx, triggering
 * a full re-fetch via the useEffect.
 *
 * Wallet gate: if not connected, shows ConnectButton prompt.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useEffect, useState, useCallback } from "react";
import { reads } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { PositionPanel } from "@/components/PositionPanel";
import { DepositWidget } from "@/components/DepositWidget";
import { RedeemPanel } from "@/components/RedeemPanel";
import { fmtNav } from "@/lib/format";
import type { RedeemRequest } from "vault";

/** Mono span for evidence-layer numbers */
function Mono({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{
        fontFeatureSettings: '"tnum" 1',
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

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

export default function EarnPage() {
  const { address } = useWallet();
  const [data, setData] = useState<EarnData>({ ...EMPTY_DATA, loading: true });
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Increment refreshKey to trigger re-fetch after a tx
  const handleSuccess = useCallback((hash: string) => {
    setLastTxHash(hash);
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch all on-chain reads
  useEffect(() => {
    if (!address) {
      setData({ ...EMPTY_DATA, loading: false });
      return;
    }

    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true, error: null }));

    async function fetchAll() {
      try {
        const [navPerShare, balance, pendingIds] = await Promise.all([
          reads.vaultNavPerShare(),
          reads.vaultBalance(address!),
          reads.vaultPendingRequests(),
        ]);

        if (cancelled) return;

        // Fetch each request detail
        const requestEntries = await Promise.all(
          pendingIds.map(async (id) => {
            const req = await reads.vaultRequest(BigInt(id));
            return [id, req] as [number, RedeemRequest];
          }),
        );

        if (cancelled) return;

        setData({
          navPerShare,
          balance,
          pendingIds,
          requests: new Map(requestEntries),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load data",
        }));
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  return (
    <main
      className="texture-investidor"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* Top nav bar */}
      <nav
        style={{
          height: "56px",
          backgroundColor: "var(--color-canvas)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          {/* Logo — Geist Bold amber, lowercase per STYLE.md §3.6 */}
          <a
            href="/"
            className="font-display"
            style={{
              fontSize: "16px",
              color: "var(--color-accent)",
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            tga
          </a>
          {/* Nav item — active state */}
          <a
            href="/earn"
            className="font-body"
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--color-text)",
              textDecoration: "none",
              borderBottom: "1px solid var(--color-accent)",
              paddingBottom: "1px",
              letterSpacing: "0.01em",
            }}
            aria-current="page"
          >
            earn
          </a>
        </div>

        {/* Wallet connect */}
        <ConnectButton />
      </nav>

      {/* Page content */}
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "40px 32px 64px",
        }}
      >
        {/* NAV/APY Hero — Declaration layer */}
        <div style={{ marginBottom: "40px" }}>
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
            MUTAV SGR RESERVE
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(2.25rem, 1.544rem + 1.127vw, 3rem)",
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              lineHeight: 1.083,
              marginBottom: "24px",
            }}
          >
            Earn Yield on the SGR Reserve
          </h1>

          {/* NAV stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1px",
              backgroundColor: "var(--color-border)",
              border: "1px solid var(--color-border)",
              marginBottom: "8px",
            }}
          >
            {/* NAV per share */}
            <div
              style={{
                backgroundColor: "var(--color-surface)",
                padding: "20px 24px",
              }}
            >
              <p
                className="font-body"
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-2)",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                NAV / mtvR
              </p>
              <p
                className="font-display"
                style={{
                  fontSize: "32px",
                  color: "var(--color-text)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                <Mono>
                  {data.navPerShare > 0n ? fmtNav(data.navPerShare) : "—"}
                </Mono>
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-3)",
                  marginTop: "4px",
                  fontFamily: "var(--font-mono)",
                  fontFeatureSettings: '"tnum" 1',
                }}
              >
                USDC per mtvR share
              </p>
            </div>

            {/* Live indicator */}
            <div
              style={{
                backgroundColor: "var(--color-surface)",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <p
                className="font-body"
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  color: "var(--color-text-2)",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                NETWORK
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="live-dot" aria-hidden="true" />
                <Mono style={{ fontSize: "13px", color: "var(--color-text)" }}>
                  Stellar Testnet
                </Mono>
              </div>
            </div>
          </div>

          {/* Last tx confirmation */}
          {lastTxHash && (
            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-success)",
                marginTop: "8px",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              TX confirmed: <Mono>{lastTxHash.slice(0, 12)}…{lastTxHash.slice(-8)}</Mono>
            </p>
          )}
        </div>

        {/* Wallet gate */}
        {!address ? (
          <div
            style={{
              padding: "48px 24px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              textAlign: "center",
              maxWidth: "480px",
              margin: "0 auto",
            }}
          >
            <p
              className="font-display"
              style={{
                fontSize: "20px",
                color: "var(--color-text)",
                marginBottom: "8px",
                letterSpacing: "-0.01em",
              }}
            >
              Connect your wallet to earn
            </p>
            <p
              className="font-body"
              style={{
                fontSize: "13px",
                color: "var(--color-text-2)",
                marginBottom: "24px",
                lineHeight: 1.5,
              }}
            >
              Connect a Stellar wallet to deposit USDC, receive mtvR shares,
              and manage your redemption queue.
            </p>
            <ConnectButton />
          </div>
        ) : (
          <>
            {/* Loading overlay */}
            {data.loading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "24px",
                }}
              >
                <span className="live-dot" aria-hidden="true" />
                <span
                  className="font-body"
                  style={{ fontSize: "13px", color: "var(--color-text-2)" }}
                >
                  Loading position…
                </span>
              </div>
            )}

            {/* Error state */}
            {data.error && (
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-error)",
                  marginBottom: "24px",
                }}
                role="alert"
              >
                <p
                  className="font-mono"
                  style={{ fontSize: "12px", color: "var(--color-error)" }}
                >
                  {data.error}
                </p>
              </div>
            )}

            {/* Main content grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "24px",
                alignItems: "start",
              }}
            >
              {/* Left column: Position + Deposit */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <PositionPanel
                  balance={data.balance}
                  navPerShare={data.navPerShare}
                />
                <DepositWidget
                  address={address}
                  navPerShare={data.navPerShare}
                  onSuccess={handleSuccess}
                />
              </div>

              {/* Right column: Redeem + Queue */}
              <div>
                <RedeemPanel
                  address={address}
                  balance={data.balance}
                  requestIds={data.pendingIds}
                  requests={data.requests}
                  onSuccess={handleSuccess}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
