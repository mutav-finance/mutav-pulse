"use client";

/**
 * InvestCard — the sticky right-column action card of the 2-column reserve hub.
 *
 * Stacks: position summary (NAV / my shares / value) → three tabs:
 *   Invest (deposit) · Withdraw (redeem) · Fund (acquire the deposit token —
 *   a testnet faucet, and for cTSR also a cUSD→cTSR Soroswap swap; only shown
 *   when one exists).
 * Invest is the default; when the wallet holds no deposit token the Invest tab
 * shows a small link to Fund. Owns the position data fetch + refresh-on-tx.
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
import { UsdcFaucet } from "@/components/UsdcFaucet";
import { CbrlFaucet } from "@/components/CbrlFaucet";
import { TesouroFaucet } from "@/components/TesouroFaucet";
import { BuyTesouro } from "@/components/BuyTesouro";
import { Mono } from "@/components/Mono";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { faucetEnabled, cbrlFaucetEnabled, tesouroFaucetEnabled, tesouroSwapEnabled, config } from "@/lib/config";
import { getUsdcInfo, getCbrlInfo } from "@/lib/faucet";
import { getTesouroInfo } from "@/lib/buy-tesouro";
import { fmtNav, fmtFiat, fmtAmount, fmtUnitPrice, fmtShares4, errMsg } from "@/lib/format";
import { assetsFor } from "@/lib/economics";
import type { RedeemRequest } from "vault";

type Tab = "invest" | "withdraw" | "fund";

interface EarnData {
  navPerShare: bigint;
  balance: bigint;
  /** Wallet balance of the deposit token (USDC/TESOURO), decimal — gates the Fund hint. */
  depositBalance: number;
  pendingIds: number[];
  requests: Map<number, RedeemRequest>;
  loading: boolean;
  error: string | null;
}

const EMPTY_DATA: EarnData = {
  navPerShare: 0n,
  balance: 0n,
  depositBalance: 0,
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
  const [mode, setMode] = useState<Tab>("invest");

  const handleSuccess = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Whether this reserve offers a way to acquire the deposit token (Fund tab):
  // each demo token has a testnet faucet, and cTSR additionally a cUSD→cTSR
  // Soroswap swap. A reserve whose deposit token has neither (e.g. a future
  // MARS/ARS) shows no Fund tab rather than the WRONG (USDC) faucet.
  const isTesouro = reserve.depositToken === config.tesouro.code;
  const isUsdc = reserve.depositToken === config.usdc.code;
  const isCbrl = reserve.depositToken === config.cbrl.code;
  const canFaucet = faucetEnabled && isUsdc;
  const canCbrl = cbrlFaucetEnabled && isCbrl;
  // cTSR can be acquired two ways: the instant faucet, or the cUSD→cTSR AMM swap
  // on Soroswap. The MTESOURO Fund tab offers both (faucet first — instant), each
  // gated on its own config so a missing piece simply hides that one option.
  const canTesouroFaucet = tesouroFaucetEnabled && isTesouro;
  const canTesouroSwap = tesouroSwapEnabled && isTesouro;
  const hasFund = canFaucet || canCbrl || canTesouroFaucet || canTesouroSwap;

  // Dev guard: a live cTSR reserve with neither a faucet nor a swap configured
  // silently offers no way to acquire the deposit token (the Fund tab is hidden
  // when hasFund is false). Warn in dev so a partial deploy is caught early.
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      isTesouro &&
      !canTesouroFaucet &&
      !canTesouroSwap
    ) {
      console.warn(
        `[InvestCard] ${reserve.currency} reserve has no fund rail — set ` +
          `NEXT_PUBLIC_TESOURO_FAUCET_ID or NEXT_PUBLIC_SOROSWAP_ROUTER_ID so testers can acquire ${reserve.depositToken}.`,
      );
    }
  }, [isTesouro, canTesouroFaucet, canTesouroSwap, reserve.currency, reserve.depositToken]);

  useEffect(() => {
    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true, error: null }));
    async function fetchAll() {
      try {
        if (!address) {
          const navPerShare = await reads.vaultNavPerShare();
          if (cancelled) return;
          setData({ ...EMPTY_DATA, navPerShare, loading: false });
          return;
        }
        // NAV is independent of the position reads — fetch all in parallel.
        const [navPerShare, balance, pendingIds, depositInfo] = await Promise.all([
          reads.vaultNavPerShare(),
          reads.vaultBalance(address),
          reads.vaultPendingRequests(),
          // Wallet balance of the deposit token, to gate the "add funds" hint.
          // Only known deposit tokens have a balance reader; others gate to 0.
          (isTesouro
            ? getTesouroInfo(address)
            : isUsdc
              ? getUsdcInfo(address)
              : isCbrl
                ? getCbrlInfo(address)
                : Promise.resolve({ balance: "0" })
          ).catch(() => ({ balance: "0" })),
        ]);
        if (cancelled) return;
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
          depositBalance: parseFloat(depositInfo.balance) || 0,
          pendingIds,
          requests: new Map(requestEntries),
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({ ...prev, loading: false, error: errMsg(err, "Failed to load position") }));
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey, reads, isTesouro, isUsdc, isCbrl]);

  const navStr = data.navPerShare > 0n ? fmtNav(data.navPerShare) : "—";
  const myShares = fmtShares4(data.balance);
  // Position in deposit-token units (exact), then converted to indicative fiat.
  const positionTokens = data.navPerShare > 0n ? assetsFor(data.balance, data.navPerShare) : 0n;
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

          {/* Invest | Withdraw | Fund tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as Tab)}>
            <TabsList className="gap-5">
              {(["invest", "withdraw", ...(hasFund ? ["fund"] : [])] as Tab[]).map((m) => (
                <TabsTrigger
                  key={m}
                  value={m}
                  className="font-mono text-[13px] font-normal uppercase tracking-[0.04em] px-0 pt-0 pb-2.5 cursor-pointer"
                >
                  {m}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="invest">
              <DepositWidget
                address={address}
                navPerShare={data.navPerShare}
                depositToken={reserve.depositToken}
                shareSymbol={reserve.currency}
                contracts={reserve.contracts!}
                onSuccess={handleSuccess}
              />
              {/* No deposit-token balance → point to the Fund tab to acquire it */}
              {hasFund && !data.loading && data.depositBalance <= 0 && (
                <Button
                  variant="link"
                  onClick={() => setMode("fund")}
                  className="font-mono h-auto justify-start whitespace-normal text-left text-[11px] px-0 pt-3 pb-0 cursor-pointer hover:no-underline"
                >
                  No {reserve.depositToken} balance — add funds →
                </Button>
              )}
            </TabsContent>

            <TabsContent value="withdraw">
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
            </TabsContent>

            {hasFund && (
              /* Fund — acquire the deposit token */
              <TabsContent value="fund">
                {isTesouro ? (
                  /* cTSR: instant faucet + cUSD→cTSR Soroswap swap, stacked. */
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {canTesouroFaucet && (
                      <TesouroFaucet address={address} onSuccess={handleSuccess} refreshSignal={refreshKey} />
                    )}
                    {canTesouroSwap && (
                      <BuyTesouro address={address} money={reserve} onSuccess={handleSuccess} refreshSignal={refreshKey} />
                    )}
                  </div>
                ) : canFaucet ? (
                  <UsdcFaucet address={address} onSuccess={handleSuccess} />
                ) : canCbrl ? (
                  <CbrlFaucet address={address} onSuccess={handleSuccess} />
                ) : null}
              </TabsContent>
            )}
          </Tabs>
        </>
      )}
    </aside>
  );
}
