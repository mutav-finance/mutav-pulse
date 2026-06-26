"use client";

/**
 * InvestPanel — Deposit / Redeem surface for a single reserve.
 *
 * Layout:
 *   - NAV/APY hero (Declaration layer)
 *   - PositionPanel (connected user's mtvR balance + USDC value)
 *   - DepositWidget (underlying → mtvR with live NAV preview)
 *   - RedeemPanel  (mtvR → queue + claim/cancel)
 *
 * Props:
 *   - reads: Reads — contract reads bound to the specific reserve
 *   - reserve: Reserve — reserve metadata (currency, name, etc.)
 *
 * Data: all reads from the passed `reads` object (parameterized by reserve).
 * Refresh: `refreshKey` increments after each successful tx, triggering
 * a full re-fetch via the useEffect.
 *
 * Wallet gate: if not connected, shows ConnectButton prompt.
 *
 * Design: Precision Brutalism, Investidor front (dark/amber).
 */

import { useEffect, useState, useCallback } from "react";
import type { Reads } from "@/lib/contracts";
import type { Reserve } from "@/lib/reserves";
import { useWallet } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { DepositWidget } from "@/components/DepositWidget";
import { RedeemPanel } from "@/components/RedeemPanel";
import { TestnetOnramp } from "@/components/TestnetOnramp";
import { Mono } from "@/components/Mono";
import { faucetEnabled } from "@/lib/config";
import { fmtNav, fmtUsd, fromStroops, errMsg, STROOP_SCALE } from "@/lib/format";
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

export function InvestPanel({
  reads,
  reserve,
}: {
  reads: Reads;
  reserve: Reserve;
}) {
  const { address } = useWallet();
  const [data, setData] = useState<EarnData>({ ...EMPTY_DATA, loading: true });
  const [refreshKey, setRefreshKey] = useState(0);

  // Bump to re-fetch reads after any tx. Per-component <TxStatus> owns the
  // confirmation UI now, so this is a pure data-refresh trigger.
  const handleSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch on-chain reads. NAV is public (loads even when disconnected so the
  // overview always shows it); the position reads run only when connected.
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
          error: errMsg(err, "Failed to load data"),
        }));
      }
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey, reads]);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative brand mark — flush right, behind content */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/earn-bg.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: "auto",
          opacity: 0.1,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />
      {/* Page content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "40px 32px 64px",
        }}
      >
        {/* NAV/APY Hero — Declaration layer */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "12px",
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
                margin: 0,
              }}
            >
              MUTAV PULSE PROTOCOL
            </p>
            <p
              className="font-body"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--color-accent)",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Testnet PoC
            </p>
          </div>
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
            MUTAV PULSE PROTOCOL — {reserve.currency} RESERVE
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
                NAV / MTVR
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
                {reserve.currency} per MTVR share
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

            {/* My position — appears once connected, so the overview reads as
                NAV + my position in one band. */}
            {address && (
              <>
                <div style={{ backgroundColor: "var(--color-surface)", padding: "20px 24px" }}>
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
                    MY MTVR
                  </p>
                  <p
                    className="font-display"
                    style={{ fontSize: "32px", color: "var(--color-text)", letterSpacing: "-0.02em", lineHeight: 1 }}
                  >
                    <Mono>
                      {fromStroops(data.balance).toLocaleString("en-US", {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })}
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
                    shares held
                  </p>
                </div>

                <div style={{ backgroundColor: "var(--color-surface)", padding: "20px 24px" }}>
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
                    POSITION VALUE
                  </p>
                  <p
                    className="font-display"
                    style={{ fontSize: "32px", color: "var(--color-text)", letterSpacing: "-0.02em", lineHeight: 1 }}
                  >
                    <Mono>
                      {data.navPerShare > 0n
                        ? fmtUsd((data.balance * data.navPerShare) / STROOP_SCALE)
                        : "—"}
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
                    at current NAV
                  </p>
                </div>
              </>
            )}
          </div>
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
              CONNECT YOUR WALLET TO EXPLORE THE POC
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
              Connect a Stellar testnet wallet to deposit demo {reserve.depositToken}, receive MTVR shares, and explore the redemption queue on the testnet PoC.
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

            {/* Testnet on-ramp — full-width section (trustline + faucet).
                Never renders on mainnet (faucetEnabled is false off testnet). */}
            {faucetEnabled && (
              <div style={{ marginBottom: "24px" }}>
                <TestnetOnramp address={address} onSuccess={handleSuccess} />
              </div>
            )}

            {/* Deposit | Withdraw — side by side; stacks below 720px */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: "24px",
                alignItems: "start",
              }}
            >
              <DepositWidget
                address={address}
                navPerShare={data.navPerShare}
                depositToken={reserve.depositToken}
                contracts={reserve.contracts!}
                onSuccess={handleSuccess}
              />
              <RedeemPanel
                address={address}
                balance={data.balance}
                requestIds={data.pendingIds}
                requests={data.requests}
                depositToken={reserve.depositToken}
                contracts={reserve.contracts!}
                onSuccess={handleSuccess}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
