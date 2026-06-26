"use client";

/**
 * /protocol/[vault] — Per-reserve Cockpit (admin-gated)
 *
 * Resolves [vault] address param:
 *   - "invalid"    → notFound()
 *   - "unverified" → <UnverifiedReserve address={vault} />
 *   - "verified"   → full admin cockpit, reads parameterized by reserve
 *
 * Layout:
 *   - Nav bar (terminal front — copper active state)
 *   - ReserveHealthHeader (total_assets, free_capital, coverage_required,
 *     pending count, strategy balances)
 *   - Admin gate: if connected wallet ≠ vault/policy admin → read-only notice
 *   - Action groups (admin-only):
 *       Underwriting  — sign_guarantee, settle_guarantee
 *       Premiums      — pay_premium
 *       Claims        — cover_default (active guarantee picker)
 *       Liquidity     — rebalance, process_redemptions
 *       Strategies    — add_strategy, remove_strategy + live alloc list
 *
 * No useSearchParams → no Suspense wrapper needed.
 * Design: Terminal front, copper accent. Dense/utilitarian.
 * Precision Brutalism — no rounded corners, no shadows.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import { resolveAddress, getReserve } from "@/lib/discovery";
import { reserveReads, type ReserveContracts } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { ReserveHealthHeader } from "@/components/ReserveHealthHeader";
import { UnverifiedReserve } from "@/components/UnverifiedReserve";
import { Mono } from "@/components/Mono";
import {
  ProtocolActionForm,
  FormField,
  FormCheckbox,
  FormSelect,
} from "@/components/ProtocolActionForm";
import {
  signGuarantee,
  payPremium,
  coverDefault,
  settleGuarantee,
  rebalance,
  processRedemptions,
  addStrategy,
  removeStrategy,
} from "@/lib/admin-tx";
import { fmtUsd, truncAddr, errMsg, parseToStroops } from "@/lib/format";
import type { StrategyAlloc } from "vault";
import type { Guarantee } from "policy";

// ─── Data shape ──────────────────────────────────────────────────────────────

interface ProtocolData {
  vaultAdmin: string;
  policyAdmin: string;
  totalAssets: bigint;
  freeCapital: bigint;
  coverageRequired: bigint;
  pendingIds: number[];
  strategies: StrategyAlloc[];
  activeGuarantees: Array<{ id: number; guarantee: Guarantee; isCurrent: boolean }>;
  loading: boolean;
  error: string | null;
}

const INITIAL: ProtocolData = {
  vaultAdmin: "",
  policyAdmin: "",
  totalAssets: 0n,
  freeCapital: 0n,
  coverageRequired: 0n,
  pendingIds: [],
  strategies: [],
  activeGuarantees: [],
  loading: true,
  error: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Section label — uppercase, terminal-dim, hairline top border */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        paddingTop: "24px",
        marginBottom: "8px",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <p
        className="font-body"
        style={{
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.12em",
          color: "var(--color-text-3)",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  );
}

/** Two-column action grid */
function ActionGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "1px",
        backgroundColor: "var(--color-border)",
        border: "1px solid var(--color-border)",
        marginBottom: "4px",
      }}
    >
      {children}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProtocolVaultPage() {
  const params = useParams<{ vault: string }>();
  const vault = String(params.vault);

  // Resolution: invalid → 404 | unverified → notice | verified → cockpit
  const resolution = resolveAddress(vault);
  const reserve = getReserve(vault); // may be undefined (unverified/unknown)
  const reads = useMemo(
    () => (reserve?.contracts ? reserveReads(reserve.contracts) : null),
    [reserve],
  );

  if (resolution === "invalid") notFound();
  if (resolution === "unverified" || !reserve || !reads) {
    return <UnverifiedReserve address={vault} />;
  }

  // Verified path — reserve and reads are narrowed to non-null
  return <ReserveCockpit reads={reads} contracts={reserve.contracts!} depositToken={reserve.depositToken} />;
}

// ─── Cockpit (inner) ──────────────────────────────────────────────────────────

/**
 * The actual cockpit UI, receiving per-reserve reads + contracts.
 * Writes (admin-tx helpers) are parameterized by the reserve's contracts.
 */
function ReserveCockpit({ reads, contracts, depositToken }: { reads: ReturnType<typeof reserveReads>; contracts: ReserveContracts; depositToken: string }) {
  const { address } = useWallet();
  const [data, setData] = useState<ProtocolData>(INITIAL);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // ── Refresh after any successful tx ─────────────────────────────────────────
  const handleSuccess = useCallback((hash: string) => {
    setLastTxHash(hash);
    setRefreshKey((k) => k + 1);
  }, []);

  // ── Fetch all protocol reads ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [
        vaultAdmin,
        policyAdmin,
        totalAssets,
        freeCapital,
        coverageRequired,
        pendingIds,
        strategies,
        activeIds,
      ] = await Promise.all([
        reads.vaultAdmin(),
        reads.policyAdmin(),
        reads.vaultTotalAssets(),
        reads.vaultFreeCapital(),
        reads.policyCoverageRequired(),
        reads.vaultPendingRequests(),
        reads.vaultStrategies(),
        reads.registryActiveIds(),
      ]);

      // Fetch guarantee details for active IDs
      const activeGuarantees = await Promise.all(
        activeIds.map(async (id) => {
          const [guarantee, isCurrent] = await Promise.all([
            reads.policyGuarantee(BigInt(id)),
            reads.policyIsCurrent(BigInt(id)),
          ]);
          return { id, guarantee, isCurrent };
        }),
      );

      setData({
        vaultAdmin,
        policyAdmin,
        totalAssets,
        freeCapital,
        coverageRequired,
        pendingIds,
        strategies,
        activeGuarantees,
        loading: false,
        error: null,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: errMsg(err, "Failed to load protocol data"),
      }));
    }
  }, [reads]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  // ── Admin gate ───────────────────────────────────────────────────────────────
  const isVaultAdmin =
    !!address &&
    !!data.vaultAdmin &&
    address.toLowerCase() === data.vaultAdmin.toLowerCase();
  const isPolicyAdmin =
    !!address &&
    !!data.policyAdmin &&
    address.toLowerCase() === data.policyAdmin.toLowerCase();
  const isAdmin = isVaultAdmin || isPolicyAdmin;

  // ── Form state: Underwriting ─────────────────────────────────────────────────
  const [sgLandlord, setSgLandlord] = useState("");
  const [sgMonthly, setSgMonthly] = useState("");
  const [sgMonths, setSgMonths] = useState("");
  const [sgFeeBps, setSgFeeBps] = useState("");
  const [sgPeriodDays, setSgPeriodDays] = useState("30");

  // ── Form state: Settle Guarantee ─────────────────────────────────────────────
  const [settleId, setSettleId] = useState("");

  // ── Form state: Pay Premium ──────────────────────────────────────────────────
  const [ppId, setPpId] = useState("");

  // ── Form state: Cover Default ────────────────────────────────────────────────
  const [cdId, setCdId] = useState("");

  // ── Form state: Process Redemptions ─────────────────────────────────────────
  const [prMaxBatch, setPrMaxBatch] = useState("10");

  // ── Form state: Add Strategy ─────────────────────────────────────────────────
  const [asAddress, setAsAddress] = useState("");
  const [asWeightBps, setAsWeightBps] = useState("");
  const [isVolatile, setIsVolatile] = useState(false);

  // ── Form state: Remove Strategy ──────────────────────────────────────────────
  const [rsAddress, setRsAddress] = useState("");

  // ── Guarantee options for pickers ────────────────────────────────────────────
  const guaranteeOptions = data.activeGuarantees.map((g) => ({
    value: String(g.id),
    label: `#${g.id} — ${truncAddr(g.guarantee.landlord)} · ${fmtUsd(g.guarantee.monthly_amount)}/mo · ${g.isCurrent ? "current" : "overdue"}`,
  }));

  const strategyOptions = data.strategies.map((s) => ({
    value: s.address,
    label: `${truncAddr(s.address)} · ${(s.weight_bps / 100).toFixed(0)}%${s.volatile ? " · VOL" : ""}`,
  }));

  return (
    <main
      data-front="terminal"
      className="texture-terminal"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      {/* Admin badge rendered inline near the page header; nav is in NavShell */}

      {/* ── Page content ────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "28px 28px 64px",
        }}
      >
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div>
            <p
              className="font-body"
              style={{
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.12em",
                color: "var(--color-text-3)",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              MUTAV PULSE PROTOCOL — RESERVE COCKPIT
            </p>
            <h1
              className="font-display"
              style={{
                fontSize: "22px",
                color: "var(--color-text)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              Protocol Cockpit
            </h1>
          </div>

          {/* Right: admin badge + refresh + last tx */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "6px",
            }}
          >
            {isAdmin && (
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-copper)",
                  border: "1px solid var(--color-copper)",
                  padding: "2px 8px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  alignSelf: "flex-end",
                }}
              >
                ADMIN
              </span>
            )}
            <button
              onClick={fetchAll}
              disabled={data.loading}
              className="font-mono"
              style={{
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-3)",
                padding: "5px 12px",
                fontSize: "11px",
                fontWeight: 500,
                cursor: data.loading ? "not-allowed" : "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {data.loading ? "LOADING…" : "↻ REFRESH"}
            </button>
            {lastTxHash && (
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-success)",
                  letterSpacing: "0.02em",
                }}
              >
                TX:{" "}
                <Mono style={{ color: "var(--color-success)" }}>
                  {lastTxHash.slice(0, 8)}…{lastTxHash.slice(-6)}
                </Mono>
              </span>
            )}
          </div>
        </div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {data.error && (
          <div
            role="alert"
            style={{
              padding: "10px 16px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-error)",
              marginBottom: "20px",
            }}
          >
            <p
              className="font-mono"
              style={{ fontSize: "11px", color: "var(--color-error)", margin: 0 }}
            >
              {data.error}
            </p>
          </div>
        )}

        {/* ── Reserve Health Header ──────────────────────────────────────── */}
        <div style={{ marginBottom: "24px" }}>
          <ReserveHealthHeader
            totalAssets={data.totalAssets}
            freeCapital={data.freeCapital}
            coverageRequired={data.coverageRequired}
            pendingCount={data.pendingIds.length}
            strategies={data.strategies}
            loading={data.loading}
            error={data.error}
          />
        </div>

        {/* ── Admin gate notice ─────────────────────────────────────────── */}
        {!address ? (
          <div
            style={{
              padding: "24px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <p
                className="font-display"
                style={{
                  fontSize: "15px",
                  color: "var(--color-text)",
                  margin: "0 0 4px",
                  letterSpacing: "-0.01em",
                }}
              >
                Connect admin wallet to execute protocol actions
              </p>
              <p
                className="font-body"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-2)",
                  margin: 0,
                }}
              >
                Reserve health metrics are visible without a wallet.
              </p>
            </div>
            <ConnectButton />
          </div>
        ) : !isAdmin && !data.loading ? (
          <div
            role="status"
            style={{
              padding: "14px 20px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                backgroundColor: "var(--color-text-3)",
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <div>
              <p
                className="font-body"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-2)",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Read-only — connected address is not admin.{" "}
                <Mono style={{ fontSize: "11px", color: "var(--color-text-3)" }}>
                  {truncAddr(address)}
                </Mono>
                {" "}· vault admin:{" "}
                <Mono style={{ fontSize: "11px", color: "var(--color-text-3)" }}>
                  {data.vaultAdmin ? truncAddr(data.vaultAdmin) : "—"}
                </Mono>
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Admin action forms ────────────────────────────────────────── */}
        {/* Only shown when wallet is connected (admin or not — forms are
            disabled when not admin; still rendered for transparency) */}
        {address && (
          <>
            {/* ── Underwriting ─────────────────────────────────────────── */}
            <SectionLabel>Underwriting</SectionLabel>
            <ActionGrid>
              {/* Sign Guarantee */}
              <ProtocolActionForm
                title="Sign Guarantee"
                description="policy.sign_guarantee"
                actionLabel="Sign"
                disabled={!isPolicyAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const monthly = parseToStroops(sgMonthly);
                  if (monthly === null)
                    throw new Error("monthly amount must be a positive number");
                  const months = parseInt(sgMonths, 10);
                  if (isNaN(months)) throw new Error("months must be a number");
                  const feeBps = parseInt(sgFeeBps, 10);
                  if (isNaN(feeBps)) throw new Error("fee bps must be a number");
                  const periodDays = parseInt(sgPeriodDays, 10);
                  if (isNaN(periodDays))
                    throw new Error("period days must be a number");
                  const periodSecs = BigInt(periodDays * 86400);
                  return signGuarantee(
                    contracts,
                    address,
                    sgLandlord,
                    monthly,
                    months,
                    feeBps,
                    periodSecs,
                  );
                }}
                onSuccess={(hash) => {
                  setSgLandlord("");
                  setSgMonthly("");
                  setSgMonths("");
                  setSgFeeBps("");
                  setSgPeriodDays("30");
                  handleSuccess(hash);
                }}
              >
                <FormField
                  id="sg-landlord"
                  label="Landlord Address"
                  placeholder="G…"
                  value={sgLandlord}
                  onChange={setSgLandlord}
                  disabled={!isPolicyAdmin}
                  hint="Stellar public key of the beneficiary landlord"
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <FormField
                    id="sg-monthly"
                    label={`Monthly Amount (in ${depositToken})`}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1000.00"
                    value={sgMonthly}
                    onChange={setSgMonthly}
                    disabled={!isPolicyAdmin}
                  />
                  <FormField
                    id="sg-months"
                    label="Months Covered"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="12"
                    value={sgMonths}
                    onChange={setSgMonths}
                    disabled={!isPolicyAdmin}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <FormField
                    id="sg-fee-bps"
                    label="Fee (bps / period)"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="1200"
                    value={sgFeeBps}
                    onChange={setSgFeeBps}
                    disabled={!isPolicyAdmin}
                    hint="Premium per period = rent × bps/10000 (1200 = 12%/period, NOT annual)"
                  />
                  <FormField
                    id="sg-period"
                    label="Period (days)"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="30"
                    value={sgPeriodDays}
                    onChange={setSgPeriodDays}
                    disabled={!isPolicyAdmin}
                    hint="Premium cadence — fee_bps is charged once per this period"
                  />
                </div>
              </ProtocolActionForm>

              {/* Settle Guarantee */}
              <ProtocolActionForm
                title="Settle Guarantee"
                description="policy.settle_guarantee"
                actionLabel="Settle"
                disabled={!isPolicyAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!settleId) throw new Error("select a guarantee first");
                  const id = parseInt(settleId, 10);
                  if (isNaN(id)) throw new Error("invalid guarantee ID");
                  return settleGuarantee(contracts, address, id);
                }}
                onSuccess={(hash) => {
                  setSettleId("");
                  handleSuccess(hash);
                }}
              >
                <FormSelect
                  id="settle-id"
                  label="Guarantee"
                  value={settleId}
                  onChange={setSettleId}
                  options={guaranteeOptions}
                  disabled={!isPolicyAdmin}
                  placeholder="Select active guarantee…"
                />
                {settleId && (
                  <GuaranteeDetail
                    guarantee={data.activeGuarantees.find(
                      (g) => String(g.id) === settleId,
                    )}
                  />
                )}
              </ProtocolActionForm>
            </ActionGrid>

            {/* ── Premiums ─────────────────────────────────────────────── */}
            <SectionLabel>Premiums</SectionLabel>
            <ActionGrid>
              <ProtocolActionForm
                title="Pay Premium"
                description="policy.pay_premium"
                actionLabel="Pay"
                disabled={!isAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!ppId) throw new Error("select a guarantee first");
                  const id = parseInt(ppId, 10);
                  if (isNaN(id)) throw new Error("invalid guarantee ID");
                  return payPremium(contracts, address, id);
                }}
                onSuccess={(hash) => {
                  setPpId("");
                  handleSuccess(hash);
                }}
              >
                <FormSelect
                  id="pp-id"
                  label="Guarantee"
                  value={ppId}
                  onChange={setPpId}
                  options={guaranteeOptions}
                  disabled={!isAdmin}
                  placeholder="Select guarantee…"
                />
                {ppId && (
                  <GuaranteeDetail
                    guarantee={data.activeGuarantees.find(
                      (g) => String(g.id) === ppId,
                    )}
                  />
                )}
              </ProtocolActionForm>

              {/* Spacer cell (premium is a 1-wide section) */}
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  padding: "20px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <p
                  className="font-body"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-3)",
                    lineHeight: 1.5,
                    margin: 0,
                    maxWidth: "280px",
                  }}
                >
                  Premium payments advance the <Mono style={{ fontSize: "11px", color: "var(--color-text-2)" }}>paid_until</Mono>{" "}
                  timestamp. Contract asserts premiums are not yet current
                  before accepting. Premium income accrues to NAV (PoC testnet only).
                </p>
              </div>
            </ActionGrid>

            {/* ── Claims ───────────────────────────────────────────────── */}
            <SectionLabel>Claims</SectionLabel>
            <ActionGrid>
              <ProtocolActionForm
                title="Cover Default"
                description="policy.cover_default"
                actionLabel="Cover Default"
                disabled={!isPolicyAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!cdId) throw new Error("select a guarantee first");
                  const id = parseInt(cdId, 10);
                  if (isNaN(id)) throw new Error("invalid guarantee ID");
                  return coverDefault(contracts, address, id);
                }}
                onSuccess={(hash) => {
                  setCdId("");
                  handleSuccess(hash);
                }}
              >
                <FormSelect
                  id="cd-id"
                  label="Defaulted Guarantee"
                  value={cdId}
                  onChange={setCdId}
                  options={data.activeGuarantees
                    .filter((g) => !g.isCurrent)
                    .map((g) => ({
                      value: String(g.id),
                      label: `#${g.id} — ${truncAddr(g.guarantee.landlord)} · ${fmtUsd(g.guarantee.monthly_amount)}/mo · overdue`,
                    }))}
                  disabled={!isPolicyAdmin}
                  placeholder="Select overdue guarantee…"
                />
                {cdId && (
                  <GuaranteeDetail
                    guarantee={data.activeGuarantees.find(
                      (g) => String(g.id) === cdId,
                    )}
                  />
                )}
                <p
                  className="font-body"
                  style={{
                    fontSize: "11px",
                    color: "var(--color-text-3)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Reduces coverage_required first, then disburses one monthly amount to the landlord. Solvency (stable_assets ≥ coverage_required) is enforced before disbursement.
                </p>
              </ProtocolActionForm>

              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  padding: "20px",
                }}
              >
                <p
                  className="font-body"
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    color: "var(--color-text-3)",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Overdue Guarantees
                </p>
                {data.loading ? (
                  <div
                    aria-hidden="true"
                    style={{
                      height: "14px",
                      width: "120px",
                      backgroundColor: "var(--color-surface-2)",
                    }}
                  />
                ) : data.activeGuarantees.filter((g) => !g.isCurrent).length ===
                  0 ? (
                  <p
                    className="font-mono"
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-3)",
                      margin: 0,
                    }}
                  >
                    No overdue guarantees
                  </p>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                  >
                    {data.activeGuarantees
                      .filter((g) => !g.isCurrent)
                      .map((g) => (
                        <div
                          key={g.id}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "var(--color-canvas)",
                            border: "1px solid var(--color-error)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Mono
                            style={{
                              fontSize: "12px",
                              color: "var(--color-error)",
                            }}
                          >
                            #{g.id}
                          </Mono>
                          <Mono
                            style={{
                              fontSize: "11px",
                              color: "var(--color-text-2)",
                            }}
                          >
                            {truncAddr(g.guarantee.landlord)}
                          </Mono>
                          <Mono
                            style={{
                              fontSize: "12px",
                              color: "var(--color-error)",
                            }}
                          >
                            {fmtUsd(g.guarantee.monthly_amount)}/mo
                          </Mono>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </ActionGrid>

            {/* ── Liquidity ────────────────────────────────────────────── */}
            <SectionLabel>Liquidity</SectionLabel>
            <ActionGrid>
              {/* Rebalance */}
              <ProtocolActionForm
                title="Rebalance"
                description="vault.rebalance"
                actionLabel="Rebalance"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  return rebalance(contracts, address);
                }}
                onSuccess={handleSuccess}
              >
                <p
                  className="font-body"
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-3)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Reallocates assets across strategies according to current
                  weight_bps. Call after adding/removing a strategy or when
                  drift exceeds tolerance.
                </p>
              </ProtocolActionForm>

              {/* Process Redemptions */}
              <ProtocolActionForm
                title="Process Redemptions"
                description="vault.process_redemptions"
                actionLabel="Process"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const maxBatch = parseInt(prMaxBatch, 10);
                  if (isNaN(maxBatch))
                    throw new Error("max batch size must be a number");
                  return processRedemptions(contracts, address, maxBatch);
                }}
                onSuccess={handleSuccess}
              >
                <FormField
                  id="pr-max-batch"
                  label="Max Batch Size"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="10"
                  value={prMaxBatch}
                  onChange={setPrMaxBatch}
                  disabled={!isVaultAdmin}
                  hint={`${data.pendingIds.length} pending requests in queue`}
                />
              </ProtocolActionForm>
            </ActionGrid>

            {/* ── Strategies ───────────────────────────────────────────── */}
            <SectionLabel>Strategies</SectionLabel>

            {/* Live strategy list */}
            {!data.loading && data.strategies.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  marginBottom: "1px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {["Address", "Weight", "Volatile"].map((h) => (
                        <th
                          key={h}
                          className="font-body"
                          style={{
                            padding: "8px 16px",
                            textAlign: "left",
                            fontSize: "10px",
                            fontWeight: 500,
                            letterSpacing: "0.08em",
                            color: "var(--color-text-3)",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.strategies.map((s) => (
                      <tr
                        key={s.address}
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <Mono
                            style={{
                              fontSize: "12px",
                              color: "var(--color-text-2)",
                            }}
                          >
                            {s.address}
                          </Mono>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <Mono
                            style={{
                              fontSize: "13px",
                              color: "var(--color-copper)",
                            }}
                          >
                            {(s.weight_bps / 100).toFixed(0)}%
                          </Mono>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <Mono
                            style={{
                              fontSize: "11px",
                              color: s.volatile
                                ? "var(--color-copper)"
                                : "var(--color-text-3)",
                            }}
                          >
                            {s.volatile ? "VOL" : "stable"}
                          </Mono>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <ActionGrid>
              {/* Add Strategy */}
              <ProtocolActionForm
                title="Add Strategy"
                description="vault.add_strategy"
                actionLabel="Add"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!asAddress) throw new Error("strategy address is required");
                  const weightBps = parseInt(asWeightBps, 10);
                  if (isNaN(weightBps)) throw new Error("weight bps must be a number");
                  return addStrategy(
                    contracts,
                    address,
                    asAddress,
                    weightBps,
                    isVolatile,
                  );
                }}
                onSuccess={(hash) => {
                  setAsAddress("");
                  setAsWeightBps("");
                  setIsVolatile(false);
                  handleSuccess(hash);
                }}
              >
                <FormField
                  id="as-address"
                  label="Strategy Contract Address"
                  placeholder="C…"
                  value={asAddress}
                  onChange={setAsAddress}
                  disabled={!isVaultAdmin}
                />
                <FormField
                  id="as-weight-bps"
                  label="Weight (bps)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="5000"
                  value={asWeightBps}
                  onChange={setAsWeightBps}
                  disabled={!isVaultAdmin}
                  hint="Total weights across all strategies must sum to 10000"
                />
                <FormCheckbox
                  id="as-volatile"
                  label="Volatile strategy (excluded from solvency coverage floor)"
                  checked={isVolatile}
                  onChange={setIsVolatile}
                  disabled={!isVaultAdmin}
                />
              </ProtocolActionForm>

              {/* Remove Strategy */}
              <ProtocolActionForm
                title="Remove Strategy"
                description="vault.remove_strategy"
                actionLabel="Remove"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!rsAddress) throw new Error("select a strategy first");
                  return removeStrategy(contracts, address, rsAddress);
                }}
                onSuccess={(hash) => {
                  setRsAddress("");
                  handleSuccess(hash);
                }}
              >
                <FormSelect
                  id="rs-address"
                  label="Strategy"
                  value={rsAddress}
                  onChange={setRsAddress}
                  options={strategyOptions}
                  disabled={!isVaultAdmin || data.strategies.length === 0}
                  placeholder={
                    data.strategies.length === 0
                      ? "No strategies registered"
                      : "Select strategy to remove…"
                  }
                />
                <p
                  className="font-body"
                  style={{
                    fontSize: "11px",
                    color: "var(--color-text-3)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Call rebalance after removing to reallocate the freed
                  weight. Removing the last strategy leaves all assets in
                  the vault&apos;s free_capital.
                </p>
              </ProtocolActionForm>
            </ActionGrid>

            {/* ── Admin addresses ──────────────────────────────────────── */}
            {!data.loading && (
              <div
                style={{
                  marginTop: "28px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "24px",
                }}
              >
                <div>
                  <p
                    className="font-body"
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      color: "var(--color-text-3)",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Vault Admin
                  </p>
                  <Mono
                    style={{ fontSize: "12px", color: "var(--color-text-2)" }}
                  >
                    {data.vaultAdmin || "—"}
                  </Mono>
                </div>
                <div>
                  <p
                    className="font-body"
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      color: "var(--color-text-3)",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Policy Admin
                  </p>
                  <Mono
                    style={{ fontSize: "12px", color: "var(--color-text-2)" }}
                  >
                    {data.policyAdmin || "—"}
                  </Mono>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: "40px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            className="live-dot"
            style={{ backgroundColor: "var(--color-copper)" }}
            aria-hidden="true"
          />
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-text-3)",
              letterSpacing: "0.04em",
            }}
          >
            Stellar Testnet · PoC · admin cockpit · read-write
          </span>
        </div>
      </div>
    </main>
  );
}

// ─── GuaranteeDetail ─────────────────────────────────────────────────────────

/**
 * Compact guarantee summary shown below a picker when a guarantee is selected.
 * Prevents blind-firing actions on the wrong ID.
 */
function GuaranteeDetail({
  guarantee,
}: {
  guarantee?: { id: number; guarantee: Guarantee; isCurrent: boolean };
}) {
  if (!guarantee) return null;
  const g = guarantee.guarantee;
  const paidUntilDate = new Date(Number(g.paid_until) * 1000);

  return (
    <div
      style={{
        padding: "10px 12px",
        backgroundColor: "var(--color-canvas)",
        border: "1px solid var(--color-border)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px 16px",
      }}
    >
      {[
        { label: "Landlord", value: truncAddr(g.landlord) },
        {
          label: "Monthly",
          value: fmtUsd(g.monthly_amount),
        },
        {
          label: "Months",
          value: `${g.months_used}/${g.months_covered}`,
        },
        {
          label: "Paid Until",
          value: paidUntilDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        },
      ].map(({ label, value }) => (
        <div key={label}>
          <p
            className="font-body"
            style={{
              fontSize: "9px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--color-text-3)",
              textTransform: "uppercase",
              margin: "0 0 2px",
            }}
          >
            {label}
          </p>
          <Mono style={{ fontSize: "12px", color: "var(--color-text-2)" }}>
            {value}
          </Mono>
        </div>
      ))}
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            backgroundColor: guarantee.isCurrent
              ? "var(--color-success)"
              : "var(--color-error)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <Mono
          style={{
            fontSize: "11px",
            color: guarantee.isCurrent
              ? "var(--color-success)"
              : "var(--color-error)",
          }}
        >
          {guarantee.isCurrent ? "premiums current" : "OVERDUE"}
        </Mono>
      </div>
    </div>
  );
}
