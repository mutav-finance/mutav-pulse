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
 *       Underwriting  — sign_guarantee (two-leg), settle_guarantee
 *       Fees          — pay_fee
 *       Claims        — cover_default + cover_exit (active guarantee picker)
 *       Liquidity     — rebalance, process_redemptions
 *       Strategies    — add_strategy, remove_strategy + live alloc list
 *
 * No useSearchParams → no Suspense wrapper needed.
 * Design: Terminal front, copper accent. Dense/utilitarian.
 * Precision Brutalism — no rounded corners, no shadows.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { resolveAddress, getReserve, getReserves } from "@/lib/discovery";
import { reserveReads, type ReserveContracts } from "@/lib/contracts";
import { useWallet } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { ReserveHealthHeader } from "@/components/ReserveHealthHeader";
import { LockIcon } from "@/components/LockIcon";
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
  payFee,
  coverDefault,
  coverExit,
  settleGuarantee,
  rebalance,
  processRedemptions,
  addStrategy,
  removeStrategy,
  setMinLiquidBufferBps,
  setStrategyMaxDebtBps,
  setVaultAdmin,
  setPolicyAdmin,
  setVaultPolicy,
  setTokenMetadata,
  setCoverageRatioBps,
  setGraceSecs,
} from "@/lib/admin-tx";
import { fmtFiat, truncAddr, errMsg, parseToStroops, type Money } from "@/lib/format";
import { AllocationBar, type BarSegment } from "@/components/AllocationBar";
import { venueName, ADAPTER_CATALOG } from "@/lib/providers";
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
  /** Idle cash held by the vault (not deployed). `total_assets = availableHeld + Σ strategy balances`. */
  availableHeld: bigint;
  /** Liquid cash-buffer target, bps of total assets (0 = deploy everything). */
  bufferBps: number;
  /** Default grace window (seconds); null when the deployed policy predates set_grace_secs. */
  graceSecs: bigint | null;
  /** Live actual balance deployed per strategy, keyed by address. */
  strategyBalances: Record<string, bigint>;
  /** Per-strategy concentration cap, bps of total assets, keyed by address. */
  strategyCaps: Record<string, number>;
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
  availableHeld: 0n,
  bufferBps: 0,
  graceSecs: null,
  strategyBalances: {},
  strategyCaps: {},
  activeGuarantees: [],
  loading: true,
  error: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate a guarantee-id picker value into a number for an admin action.
 * Throws the same picker/parse messages the action forms surfaced inline.
 */
function parseGuaranteeId(raw: string | null | undefined): number {
  if (!raw) throw new Error("select a guarantee first");
  const id = parseInt(raw, 10);
  if (isNaN(id)) throw new Error("invalid guarantee ID");
  return id;
}

/** One-line "bio" describing the active section, shown above its cards. */
function SectionBio({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-body"
      style={{
        fontSize: "12px",
        color: "var(--color-text-3)",
        lineHeight: 1.5,
        margin: "0 0 14px",
        maxWidth: "760px",
      }}
    >
      {children}
    </p>
  );
}

/** Section sub-heading — a small all-caps label that groups blocks within a tab. */
function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-body"
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-text-2)",
        margin: "0 0 12px",
      }}
    >
      {children}
    </h3>
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
  return <ReserveCockpit reads={reads} contracts={reserve.contracts!} depositToken={reserve.depositToken} money={reserve} currency={reserve.currency} currentAddress={vault} />;
}

// ─── Cockpit (inner) ──────────────────────────────────────────────────────────

/**
 * The actual cockpit UI, receiving per-reserve reads + contracts.
 * Writes (admin-tx helpers) are parameterized by the reserve's contracts.
 */
function ReserveCockpit({ reads, contracts, depositToken, money, currency, currentAddress }: { reads: ReturnType<typeof reserveReads>; contracts: ReserveContracts; depositToken: string; money: Money; currency: string; currentAddress: string }) {
  const { address } = useWallet();
  const [data, setData] = useState<ProtocolData>(INITIAL);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeSection, setActiveSection] = useState("underwriting");

  // ── Refresh after any successful tx (per-form card shows the hash) ──────────
  const handleSuccess = useCallback(() => {
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
        availableHeld,
        bufferBps,
        graceSecs,
        activeIds,
      ] = await Promise.all([
        reads.vaultAdmin(),
        reads.policyAdmin(),
        reads.vaultTotalAssets(),
        reads.vaultFreeCapital(),
        reads.policyCoverageRequired(),
        reads.vaultPendingRequests(),
        reads.vaultStrategies(),
        reads.vaultAvailableHeld(),
        reads.vaultMinLiquidBufferBps(),
        // Tolerate a deployed policy that predates set_grace_secs — a single
        // missing method must not blank the whole cockpit.
        reads.policyGraceSecs().catch(() => null),
        reads.registryActiveIds(),
      ]);

      // Per-strategy live balance + concentration cap (the real allocation vs
      // target weight) — one round per strategy, all in parallel.
      const strategyBalances: Record<string, bigint> = {};
      const strategyCaps: Record<string, number> = {};
      await Promise.all(
        strategies.map(async (s) => {
          const [bal, cap] = await Promise.all([
            reads.strategyBalance(s.address),
            reads.strategyMaxDebtBps(s.address),
          ]);
          strategyBalances[s.address] = bal;
          strategyCaps[s.address] = cap;
        }),
      );

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
        availableHeld,
        bufferBps,
        graceSecs,
        strategyBalances,
        strategyCaps,
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

  // ── Form state: Pay Fee ──────────────────────────────────────────────────
  const [ppId, setPpId] = useState("");

  // ── Form state: Cover Default ────────────────────────────────────────────────
  const [cdId, setCdId] = useState("");

  // ── Form state: Cover Exit ───────────────────────────────────────────────────
  const [ceId, setCeId] = useState("");
  const [ceAmount, setCeAmount] = useState("");

  // ── Form state: Process Redemptions ─────────────────────────────────────────
  const [prMaxBatch, setPrMaxBatch] = useState("10");

  // ── Form state: Add Strategy ─────────────────────────────────────────────────
  const [asAddress, setAsAddress] = useState("");
  const [asWeightPct, setAsWeightPct] = useState("");
  const [isVolatile, setIsVolatile] = useState(false);

  // ── Form state: Remove Strategy ──────────────────────────────────────────────
  const [rsAddress, setRsAddress] = useState("");

  // ── Form state: Liquid buffer + per-strategy cap ─────────────────────────────
  const [bufferInput, setBufferInput] = useState("");
  const [capStrategy, setCapStrategy] = useState("");
  const [capInput, setCapInput] = useState("");

  // ── Form state: Manage (governance) ──────────────────────────────────────────
  const [newVaultAdmin, setNewVaultAdmin] = useState("");
  const [newPolicyAdmin, setNewPolicyAdmin] = useState("");
  const [newPolicyAddr, setNewPolicyAddr] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [ratioInput, setRatioInput] = useState("");
  const [graceInput, setGraceInput] = useState("");

  // ── Guarantee / strategy options for pickers (memoized — stable refs so the
  //    FormSelects don't re-render on unrelated form-state keystrokes) ──────────
  const guaranteeOptions = useMemo(
    () =>
      data.activeGuarantees.map((g) => ({
        value: String(g.id),
        label: `#${g.id} — ${truncAddr(g.guarantee.landlord)} · ${fmtFiat(g.guarantee.monthly_amount, money)}/mo · ${g.isCurrent ? "current" : "overdue"}`,
      })),
    [data.activeGuarantees, money],
  );

  // Overdue (non-current) subset — reused by the cover_default picker, its
  // empty-check, and the overdue list. Memoized once instead of re-filtering
  // the active book at each of those three sites.
  const overdueGuarantees = useMemo(
    () => data.activeGuarantees.filter((g) => !g.isCurrent),
    [data.activeGuarantees],
  );
  const overdueOptions = useMemo(
    () =>
      overdueGuarantees.map((g) => ({
        value: String(g.id),
        label: `#${g.id} — ${truncAddr(g.guarantee.landlord)} · ${fmtFiat(g.guarantee.monthly_amount, money)}/mo · overdue`,
      })),
    [overdueGuarantees, money],
  );

  const strategyOptions = useMemo(
    () =>
      data.strategies.map((s) => ({
        value: s.address,
        label: `${truncAddr(s.address)} · ${(s.weight_bps / 100).toFixed(0)}%${s.volatile ? " · VOL" : ""}`,
      })),
    [data.strategies],
  );

  // ── Allocation model ─────────────────────────────────────────────────────────
  // The SAME live actual-balance partition the investor overview renders (so the
  // two never disagree), plus the target each strategy is heading toward. The
  // contract normalizes weights by their SUM and keeps `bufferBps` idle, so a
  // strategy's TARGET share of total = (1 − buffer) × weight / Σweight, clamped to
  // its cap. Current share = live balance / total. Drift = current − target.
  const alloc = useMemo(() => {
    const totalNum = Number(data.totalAssets);
    const frac = (v: bigint) => (totalNum > 0 ? Number(v) / totalNum : 0);
    const weightSum = data.strategies.reduce((a, s) => a + s.weight_bps, 0);
    const bufferFrac = data.bufferBps / 10_000;
    const deployableFrac = Math.max(0, 1 - bufferFrac);
    const COLORS = ["var(--color-accent)", "var(--color-text-2)", "var(--color-copper, var(--color-text-2))"];

    const rows = data.strategies.map((s, i) => {
      const bal = data.strategyBalances[s.address] ?? 0n;
      const capFrac = (data.strategyCaps[s.address] ?? 10_000) / 10_000;
      const rawTarget = weightSum > 0 ? deployableFrac * (s.weight_bps / weightSum) : 0;
      const targetFrac = Math.min(rawTarget, capFrac);
      const currentFrac = frac(bal);
      return {
        key: s.address,
        name: venueName(s.address),
        address: s.address,
        volatile: s.volatile,
        amount: bal,
        weightBps: s.weight_bps,
        capFrac,
        capCapped: rawTarget > capFrac + 1e-9,
        targetFrac,
        currentFrac,
        driftFrac: currentFrac - targetFrac,
        color: COLORS[i % COLORS.length],
      };
    });

    const deployedTargetFrac = rows.reduce((a, r) => a + r.targetFrac, 0);
    const idleTargetFrac = Math.max(0, 1 - deployedTargetFrac);

    const segments: BarSegment[] = [
      ...rows.map((r) => ({
        label: r.name,
        display: fmtFiat(r.amount, money),
        fraction: r.currentFrac,
        color: r.color,
      })),
      {
        label: `${depositToken} · idle`,
        display: fmtFiat(data.availableHeld, money),
        fraction: frac(data.availableHeld),
        color: "var(--color-text-3)",
      },
    ];

    return { rows, weightSum, bufferFrac, idleTargetFrac, idleCurrentFrac: frac(data.availableHeld), segments };
  }, [data.strategies, data.strategyBalances, data.strategyCaps, data.availableHeld, data.bufferBps, data.totalAssets, money, depositToken]);

  // Adapter catalog rows annotated with their wired state in THIS vault.
  const catalog = useMemo(
    () =>
      ADAPTER_CATALOG.map((a) => ({
        ...a,
        wired: !!a.address && data.strategies.some((s) => s.address === a.address),
      })),
    [data.strategies],
  );

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
              MUTAV PULSE PROTOCOL
            </p>
            <h1
              className="font-display"
              style={{
                fontSize: "22px",
                color: "var(--color-text)",
                letterSpacing: "-0.01em",
                textTransform: "uppercase",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {currency} RESERVE COCKPIT
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
          </div>
        </div>

        {/* ── Reserve switcher — each reserve is its own contract deploy ──── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
          {getReserves().map((r) => {
            const live = r.status === "live" && !!r.address;
            const active = !!r.address && r.address === currentAddress;
            const base: React.CSSProperties = {
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "8px 16px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none",
            };
            if (!live) {
              return (
                <span
                  key={r.id}
                  aria-disabled="true"
                  title="Not yet deployed"
                  style={{
                    ...base,
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-3)",
                    cursor: "not-allowed",
                    opacity: 0.55,
                  }}
                >
                  {r.currency}
                  <LockIcon size={11} label="Locked" />
                </span>
              );
            }
            return (
              <Link
                key={r.id}
                href={`/protocol/${r.address}`}
                aria-current={active ? "page" : undefined}
                style={{
                  ...base,
                  border: active ? "1px solid var(--color-copper)" : "1px solid var(--color-border)",
                  backgroundColor: active ? "var(--color-copper)" : "var(--color-surface-2)",
                  color: active ? "var(--color-canvas)" : "var(--color-text-2)",
                }}
              >
                {r.currency}
              </Link>
            );
          })}
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
            money={money}
            pendingCount={data.pendingIds.length}
            strategies={data.strategies}
            loading={data.loading}
            error={data.error}
          >
            {/* ── Admin gate — connect / read-only, in the left column ── */}
            {!address ? (
          <div
            style={{
              padding: "24px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              flex: 1,
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
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flex: 1,
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
          </ReserveHealthHeader>
        </div>

        {/* ── Admin action forms ────────────────────────────────────────── */}
        {/* Only shown when wallet is connected (admin or not — forms are
            disabled when not admin; still rendered for transparency) */}
        {address && (
          <>
            {/* ══ Divider: reserve overview (above) → admin actions (below) ══ */}
            <div
              style={{
                marginTop: "28px",
                paddingTop: "22px",
                borderTop: "2px solid var(--color-border)",
                marginBottom: "18px",
              }}
            >
              <p
                className="font-display"
                style={{ fontSize: "16px", color: "var(--color-text)", letterSpacing: "-0.01em", textTransform: "uppercase", margin: 0 }}
              >
                Admin Actions
              </p>
              <p
                className="font-body"
                style={{ fontSize: "12px", color: "var(--color-text-3)", margin: "4px 0 0", lineHeight: 1.4 }}
              >
                Execute protocol operations on the {currency} reserve. Pick a category below.
              </p>
            </div>

            {/* ── Section tabs (sticky below the top NavShell) ──────── */}
            <nav
              aria-label="Cockpit sections"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "2px",
                marginBottom: "16px",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {[
                { id: "underwriting", label: "Underwriting" },
                { id: "fees", label: "Fees" },
                { id: "claims", label: "Claims" },
                { id: "liquidity", label: "Liquidity" },
                { id: "strategies", label: "Strategies" },
                { id: "manage", label: "Manage" },
              ].map((s) => {
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    aria-current={active ? "true" : undefined}
                    className="font-mono section-tab"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "10px 14px",
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      borderBottom: active
                        ? "2px solid var(--color-copper)"
                        : "2px solid transparent",
                      marginBottom: "-1px",
                      color: active ? "var(--color-text)" : undefined,
                    }}
                  >
                    {s.label}
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="square"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                );
              })}
            </nav>

            {/* ── Underwriting ─────────────────────────────────────────── */}
            {activeSection === "underwriting" && (
            <>
            <SectionBio>Open and close rental guarantees. Sign to start coverage and begin fee accrual; settle to close one out.</SectionBio>
            <ActionGrid>
              {/* Sign Guarantee */}
              <ProtocolActionForm
                currency={currency}
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
                onSuccess={() => {
                  setSgLandlord("");
                  setSgMonthly("");
                  setSgMonths("");
                  setSgFeeBps("");
                  setSgPeriodDays("30");
                  handleSuccess();
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
                    hint="Fee per period = rent × bps/10000 (1200 = 12%/period, NOT annual)"
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
                    hint="Fee cadence — fee_bps is charged once per this period"
                  />
                </div>
              </ProtocolActionForm>

              {/* Settle Guarantee */}
              <ProtocolActionForm
                currency={currency}
                title="Settle Guarantee"
                description="policy.settle_guarantee"
                actionLabel="Settle"
                disabled={!isPolicyAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const id = parseGuaranteeId(settleId);
                  return settleGuarantee(contracts, address, id);
                }}
                onSuccess={() => {
                  setSettleId("");
                  handleSuccess();
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
                    money={money}
                  />
                )}
              </ProtocolActionForm>
            </ActionGrid>
            </>
            )}

            {/* ── Fees ─────────────────────────────────────────────────── */}
            {activeSection === "fees" && (
            <>
            <SectionBio>Keep guarantees covered. Paying a fee advances its paid-until date; coverage lapses if it falls behind.</SectionBio>
            <ActionGrid>
              <ProtocolActionForm
                currency={currency}
                title="Pay Fee"
                description="policy.pay_fee"
                actionLabel="Pay"
                disabled={!isAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const id = parseGuaranteeId(ppId);
                  return payFee(contracts, address, id);
                }}
                onSuccess={() => {
                  setPpId("");
                  handleSuccess();
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
                    money={money}
                  />
                )}
              </ProtocolActionForm>

              {/* Spacer cell (fee is a 1-wide section) */}
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
                  Fee payments advance the <Mono style={{ fontSize: "11px", color: "var(--color-text-2)" }}>paid_until</Mono>{" "}
                  timestamp. Contract asserts the fee is not yet current
                  before accepting. Fee income accrues to NAV (PoC testnet only).
                </p>
              </div>
            </ActionGrid>
            </>
            )}

            {/* ── Claims ───────────────────────────────────────────────── */}
            {activeSection === "claims" && (
            <>
            <SectionBio>Pay out a guarantee&apos;s two legs. Cover Default disburses one monthly amount (rent-arrears leg); Cover Exit disburses an arbitrary amount up to the exit cap (property-recovery leg). Both reduce coverage before disbursing, so solvency holds.</SectionBio>
            <ActionGrid>
              <ProtocolActionForm
                currency={currency}
                title="Cover Default"
                description="policy.cover_default"
                actionLabel="Cover Default"
                disabled={!isPolicyAdmin}
                requireConfirm
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const id = parseGuaranteeId(cdId);
                  return coverDefault(contracts, address, id);
                }}
                onSuccess={() => {
                  setCdId("");
                  handleSuccess();
                }}
              >
                <FormSelect
                  id="cd-id"
                  label="Defaulted Guarantee"
                  value={cdId}
                  onChange={setCdId}
                  options={overdueOptions}
                  disabled={!isPolicyAdmin}
                  placeholder="Select overdue guarantee…"
                />
                {cdId && (
                  <GuaranteeDetail
                    guarantee={data.activeGuarantees.find(
                      (g) => String(g.id) === cdId,
                    )}
                    money={money}
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

              {/* Cover Exit (EXIT leg) */}
              <ProtocolActionForm
                currency={currency}
                title="Cover Exit"
                description="policy.cover_exit"
                actionLabel="Cover Exit"
                disabled={!isPolicyAdmin}
                requireConfirm
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const id = parseGuaranteeId(ceId);
                  const amount = parseToStroops(ceAmount);
                  if (amount === null)
                    throw new Error("amount must be a positive number");
                  return coverExit(contracts, address, id, amount);
                }}
                onSuccess={() => {
                  setCeId("");
                  setCeAmount("");
                  handleSuccess();
                }}
              >
                <FormSelect
                  id="ce-id"
                  label="Guarantee"
                  value={ceId}
                  onChange={setCeId}
                  options={guaranteeOptions}
                  disabled={!isPolicyAdmin}
                  placeholder="Select guarantee…"
                />
                <FormField
                  id="ce-amount"
                  label={`Exit Amount (in ${depositToken})`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500.00"
                  value={ceAmount}
                  onChange={setCeAmount}
                  disabled={!isPolicyAdmin}
                  hint="Partial draws allowed, up to monthly × exit_months (the EXIT cap)"
                />
                {ceId && (
                  <GuaranteeDetail
                    guarantee={data.activeGuarantees.find(
                      (g) => String(g.id) === ceId,
                    )}
                    money={money}
                  />
                )}
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
                ) : overdueGuarantees.length === 0 ? (
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
                    {overdueGuarantees
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
                            {fmtFiat(g.guarantee.monthly_amount, money)}/mo
                          </Mono>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </ActionGrid>
            </>
            )}

            {/* ── Liquidity ────────────────────────────────────────────── */}
            {activeSection === "liquidity" && (
            <>
            <SectionBio>Fulfill queued investor exits from surplus. Rebalancing strategy allocations now lives in the <strong>Strategies</strong> tab.</SectionBio>
            <ActionGrid>
              {/* Process Redemptions */}
              <ProtocolActionForm
                currency={currency}
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
            </>
            )}

            {/* ── Strategies ───────────────────────────────────────────── */}
            {activeSection === "strategies" && (
            <>
            <SectionBio>Where idle reserve capital earns yield. See the live allocation, point capital at venues by weight, then <strong>Apply</strong> to deploy. Weights are relative shares of the deployable pool — the contract keeps the idle buffer first, then splits the rest by weight.</SectionBio>

            {/* ── Allocation (live) — same actual-balance view as the investor overview ── */}
            <SubHeading>Allocation (live)</SubHeading>
            {data.strategies.length > 0 || data.availableHeld > 0n ? (
              <AllocationBar segments={alloc.segments} loading={data.loading} />
            ) : null}

            {/* Current vs target table */}
            {!data.loading && data.strategies.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  marginBottom: "16px",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {["Venue", "Deployed", "Current", "Target", "Drift", "Cap", "Class"].map((h, i) => (
                        <th
                          key={h}
                          className="font-body"
                          style={{
                            padding: "8px 16px",
                            textAlign: i === 0 ? "left" : "right",
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
                    {alloc.rows.map((r) => (
                      <tr key={r.key} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }} title={r.address}>
                            <span aria-hidden style={{ width: "8px", height: "8px", backgroundColor: r.color, flexShrink: 0 }} />
                            <Mono style={{ fontSize: "12px", color: "var(--color-text)" }}>{r.name}</Mono>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <Mono style={{ fontSize: "12px", color: "var(--color-text-2)" }}>{fmtFiat(r.amount, money)}</Mono>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <Mono style={{ fontSize: "13px", color: "var(--color-text)" }}>{(r.currentFrac * 100).toFixed(1)}%</Mono>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <Mono style={{ fontSize: "13px", color: "var(--color-copper)" }}>{(r.targetFrac * 100).toFixed(1)}%</Mono>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <Mono style={{ fontSize: "12px", color: Math.abs(r.driftFrac) >= 0.01 ? "var(--color-text-2)" : "var(--color-text-3)" }}>
                            {r.driftFrac >= 0 ? "+" : "−"}{(Math.abs(r.driftFrac) * 100).toFixed(1)}%
                          </Mono>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <Mono style={{ fontSize: "12px", color: r.capCapped ? "var(--color-accent)" : "var(--color-text-3)" }}>
                            {r.capFrac >= 1 ? "—" : `${(r.capFrac * 100).toFixed(0)}%`}
                          </Mono>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          <Mono style={{ fontSize: "11px", color: r.volatile ? "var(--color-copper)" : "var(--color-text-3)" }}>
                            {r.volatile ? "VOL" : "stable"}
                          </Mono>
                        </td>
                      </tr>
                    ))}
                    {/* Idle / liquid buffer row */}
                    <tr>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span aria-hidden style={{ width: "8px", height: "8px", backgroundColor: "var(--color-text-3)", flexShrink: 0 }} />
                          <Mono style={{ fontSize: "12px", color: "var(--color-text-2)" }}>Idle · liquid buffer</Mono>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <Mono style={{ fontSize: "12px", color: "var(--color-text-2)" }}>{fmtFiat(data.availableHeld, money)}</Mono>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <Mono style={{ fontSize: "13px", color: "var(--color-text)" }}>{(alloc.idleCurrentFrac * 100).toFixed(1)}%</Mono>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <Mono style={{ fontSize: "13px", color: "var(--color-copper)" }}>{(alloc.idleTargetFrac * 100).toFixed(1)}%</Mono>
                      </td>
                      <td colSpan={3} style={{ padding: "10px 16px", textAlign: "right" }}>
                        <Mono style={{ fontSize: "11px", color: "var(--color-text-3)" }}>buffer {(data.bufferBps / 100).toFixed(0)}%</Mono>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {!data.loading && data.strategies.length === 0 && (
              <p className="font-mono" style={{ fontSize: "12px", color: "var(--color-text-3)", marginBottom: "16px" }}>
                No strategies wired — all assets sit idle in the vault. Add an adapter below, then Apply.
              </p>
            )}

            {/* Apply allocations — co-located rebalance */}
            <div style={{ marginBottom: "32px" }}>
              <ProtocolActionForm
                currency={currency}
                title="Apply allocations ▸ Rebalance"
                description="vault.rebalance"
                actionLabel="Apply"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  return rebalance(contracts, address);
                }}
                onSuccess={handleSuccess}
              >
                <p className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)", margin: 0, lineHeight: 1.5 }}>
                  Deploys idle float toward the target weights above (keeping the liquid buffer), and pulls over-target venues back. Idempotent — running at target is a no-op. Run after changing weights, the buffer, or a cap.
                </p>
              </ProtocolActionForm>
            </div>

            {/* ── Available adapters (plug the vault into yield venues) ── */}
            <SubHeading>Available adapters</SubHeading>
            <p className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)", margin: "0 0 14px", lineHeight: 1.5, maxWidth: "760px" }}>
              Yield venues this reserve can plug into. Each is a strategy adapter wired against the same trait; `live` ones can be added today, `planned` ones are designed but not yet shipped.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px", marginBottom: "32px" }}>
              {catalog.map((a) => {
                const addable = a.status === "live" && !!a.address && !a.wired;
                const badge = a.wired ? "Wired" : a.status === "live" ? (a.address ? "Available" : "Deploy adapter") : "Planned";
                const badgeColor = a.wired ? "var(--color-accent)" : a.status === "live" ? "var(--color-copper)" : "var(--color-text-3)";
                return (
                  <div key={a.name} style={{ backgroundColor: "var(--color-surface)", border: `1px solid ${a.wired ? "var(--color-accent)" : "var(--color-border)"}`, padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                      <span className="font-display" style={{ fontSize: "15px", color: "var(--color-text)" }}>{a.name}</span>
                      <Mono style={{ fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: badgeColor }}>{badge}</Mono>
                    </div>
                    <span className="font-body" style={{ fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-3)" }}>{a.kind}</span>
                    <p className="font-body" style={{ fontSize: "12px", color: "var(--color-text-2)", margin: 0, lineHeight: 1.5, flexGrow: 1 }}>{a.blurb}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "4px" }}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-3)", textDecoration: "none" }}>↗ {a.url.replace(/^https?:\/\//, "")}</a>
                      {addable && isVaultAdmin && (
                        <button
                          type="button"
                          className="font-mono"
                          onClick={() => { setAsAddress(a.address!); document.getElementById("as-address")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                          style={{ fontSize: "11px", color: "var(--color-canvas)", backgroundColor: "var(--color-accent)", border: "1px solid var(--color-accent)", padding: "4px 10px", cursor: "pointer", letterSpacing: "0.02em" }}
                        >
                          Add to vault
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <SubHeading>Manage</SubHeading>

            <ActionGrid>
              {/* Add Strategy */}
              <ProtocolActionForm
                currency={currency}
                title="Add Strategy"
                description="vault.add_strategy"
                actionLabel="Add"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!asAddress) throw new Error("strategy address is required");
                  const pct = parseFloat(asWeightPct);
                  if (isNaN(pct) || pct < 0) throw new Error("weight must be a non-negative percent");
                  return addStrategy(contracts, address, asAddress, Math.round(pct * 100), isVolatile);
                }}
                onSuccess={() => {
                  setAsAddress("");
                  setAsWeightPct("");
                  setIsVolatile(false);
                  handleSuccess();
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
                  id="as-weight"
                  label="Weight (%)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="50"
                  value={asWeightPct}
                  onChange={setAsWeightPct}
                  disabled={!isVaultAdmin}
                  hint={`Relative share of the deployable pool. Strategies total ${(alloc.weightSum / 100).toFixed(0)}% now.`}
                />
                <FormCheckbox
                  id="as-volatile"
                  label="Volatile strategy (excluded from solvency coverage floor)"
                  checked={isVolatile}
                  onChange={setIsVolatile}
                  disabled={!isVaultAdmin}
                />
              </ProtocolActionForm>

              {/* Set Liquid Buffer */}
              <ProtocolActionForm
                currency={currency}
                title="Liquid Buffer"
                description="vault.set_min_liquid_buffer_bps"
                actionLabel="Set buffer"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const pct = parseFloat(bufferInput);
                  if (isNaN(pct) || pct < 0 || pct > 100) throw new Error("buffer must be 0–100%");
                  return setMinLiquidBufferBps(contracts, address, Math.round(pct * 100));
                }}
                onSuccess={() => {
                  setBufferInput("");
                  handleSuccess();
                }}
              >
                <FormField
                  id="buffer-pct"
                  label="Liquid buffer (%)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={(data.bufferBps / 100).toFixed(0)}
                  value={bufferInput}
                  onChange={setBufferInput}
                  disabled={!isVaultAdmin}
                  hint={`Idle cash kept back from deployment. Currently ${(data.bufferBps / 100).toFixed(0)}%.`}
                />
              </ProtocolActionForm>

              {/* Set Strategy Cap */}
              <ProtocolActionForm
                currency={currency}
                title="Strategy Cap"
                description="vault.set_strategy_max_debt_bps"
                actionLabel="Set cap"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!capStrategy) throw new Error("select a strategy first");
                  const pct = parseFloat(capInput);
                  if (isNaN(pct) || pct < 0 || pct > 100) throw new Error("cap must be 0–100%");
                  return setStrategyMaxDebtBps(contracts, address, capStrategy, Math.round(pct * 100));
                }}
                onSuccess={() => {
                  setCapStrategy("");
                  setCapInput("");
                  handleSuccess();
                }}
              >
                <FormSelect
                  id="cap-strategy"
                  label="Strategy"
                  value={capStrategy}
                  onChange={setCapStrategy}
                  options={strategyOptions}
                  disabled={!isVaultAdmin || data.strategies.length === 0}
                  placeholder={data.strategies.length === 0 ? "No strategies registered" : "Select strategy…"}
                />
                <FormField
                  id="cap-pct"
                  label="Concentration cap (%)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="100"
                  value={capInput}
                  onChange={setCapInput}
                  disabled={!isVaultAdmin}
                  hint="Max share of total assets rebalance will deploy here. 100% = uncapped."
                />
              </ProtocolActionForm>

              {/* Remove Strategy */}
              <ProtocolActionForm
                currency={currency}
                title="Remove Strategy"
                description="vault.remove_strategy"
                actionLabel="Remove"
                disabled={!isVaultAdmin}
                requireConfirm
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!rsAddress) throw new Error("select a strategy first");
                  return removeStrategy(contracts, address, rsAddress);
                }}
                onSuccess={() => {
                  setRsAddress("");
                  handleSuccess();
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
                  Divests the strategy and frees its weight. Apply (rebalance)
                  after to redeploy. Removing the last strategy leaves all assets
                  idle in the vault.
                </p>
              </ProtocolActionForm>
            </ActionGrid>
            </>
            )}

            {/* ── Manage (governance / lifecycle) ──────────────────────── */}
            {activeSection === "manage" && (
            <>
            <SectionBio>Governance and lifecycle. Transfer admin control, tune policy parameters, swap the underwriting model, and re-label shares. Contract <strong>upgrades</strong> are performed via the Stellar CLI / <code>bootstrap.sh</code> (the wasm must be installed on-chain first), not from this cockpit.</SectionBio>

            {/* Roles */}
            <SubHeading>Roles · admin</SubHeading>
            <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", padding: "14px 16px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Vault admin", addr: data.vaultAdmin, you: isVaultAdmin },
                { label: "Policy admin", addr: data.policyAdmin, you: isPolicyAdmin },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                  <span className="font-body" style={{ fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-3)", width: "92px", flexShrink: 0 }}>{r.label}</span>
                  <Mono style={{ fontSize: "12px", color: "var(--color-text-2)" }}>{r.addr || "—"}</Mono>
                  {r.you && <span className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-accent)" }}>you</span>}
                </div>
              ))}
            </div>
            <p className="font-body" style={{ fontSize: "11px", color: "var(--color-text-3)", margin: "0 0 14px", lineHeight: 1.5, maxWidth: "760px" }}>
              Each contract has a <strong>single</strong> admin. Transferring hands control over entirely and is <strong>irreversible</strong> unless you also control the new address — there is no multi-admin list to add to or remove from.
            </p>
            <ActionGrid>
              {/* Transfer Vault Admin */}
              <ProtocolActionForm
                currency={currency}
                title="Transfer Vault Admin"
                description="vault.set_admin"
                actionLabel="Transfer"
                disabled={!isVaultAdmin}
                requireConfirm
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!newVaultAdmin) throw new Error("new admin address is required");
                  return setVaultAdmin(contracts, address, newVaultAdmin);
                }}
                onSuccess={() => { setNewVaultAdmin(""); handleSuccess(); }}
              >
                <FormField id="new-vault-admin" label="New Vault Admin (C…/G…)" placeholder="G… or C…" value={newVaultAdmin} onChange={setNewVaultAdmin} disabled={!isVaultAdmin} hint="Hands over vault control. Double-check the address." />
              </ProtocolActionForm>

              {/* Transfer Policy Admin */}
              <ProtocolActionForm
                currency={currency}
                title="Transfer Policy Admin"
                description="policy.set_admin"
                actionLabel="Transfer"
                disabled={!isPolicyAdmin}
                requireConfirm
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!newPolicyAdmin) throw new Error("new admin address is required");
                  return setPolicyAdmin(contracts, address, newPolicyAdmin);
                }}
                onSuccess={() => { setNewPolicyAdmin(""); handleSuccess(); }}
              >
                <FormField id="new-policy-admin" label="New Policy Admin (C…/G…)" placeholder="G… or C…" value={newPolicyAdmin} onChange={setNewPolicyAdmin} disabled={!isPolicyAdmin} hint="Hands over the underwriting brain's admin." />
              </ProtocolActionForm>
            </ActionGrid>

            {/* Policy parameters */}
            <div style={{ marginTop: "24px" }}>
              <SubHeading>Policy parameters</SubHeading>
            </div>
            <ActionGrid>
              {/* Coverage ratio */}
              <ProtocolActionForm
                currency={currency}
                title="Coverage Ratio (c)"
                description="policy.set_coverage_ratio_bps"
                actionLabel="Set ratio"
                disabled={!isPolicyAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const pct = parseFloat(ratioInput);
                  if (isNaN(pct) || pct <= 0) throw new Error("ratio must be a positive percent");
                  return setCoverageRatioBps(contracts, address, Math.round(pct * 100));
                }}
                onSuccess={() => { setRatioInput(""); handleSuccess(); }}
              >
                <FormField id="ratio-pct" label="Coverage ratio (%)" type="number" min="1" step="1" placeholder="100" value={ratioInput} onChange={setRatioInput} disabled={!isPolicyAdmin} hint="Solvency multiplier on raw coverage. 100% = 1.0× (hard-solvent); >100% over-collateralizes." />
              </ProtocolActionForm>

              {/* Grace window */}
              <ProtocolActionForm
                currency={currency}
                title="Grace Window"
                description="policy.set_grace_secs"
                actionLabel="Set grace"
                disabled={!isPolicyAdmin || data.graceSecs === null}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  const days = parseFloat(graceInput);
                  if (isNaN(days) || days < 0) throw new Error("grace must be a non-negative number of days");
                  return setGraceSecs(contracts, address, BigInt(Math.round(days * 86400)));
                }}
                onSuccess={() => { setGraceInput(""); handleSuccess(); }}
              >
                <FormField
                  id="grace-days"
                  label="Grace window (days)"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={data.graceSecs === null ? "—" : (Number(data.graceSecs) / 86400).toFixed(0)}
                  value={graceInput}
                  onChange={setGraceInput}
                  disabled={!isPolicyAdmin || data.graceSecs === null}
                  hint={data.graceSecs === null
                    ? "Not available — the deployed policy predates set_grace_secs. Redeploy the policy to enable."
                    : `Window after a missed fee before default. Currently ${(Number(data.graceSecs) / 86400).toFixed(1)} days.`}
                />
              </ProtocolActionForm>
            </ActionGrid>

            {/* Wiring & token */}
            <div style={{ marginTop: "24px" }}>
              <SubHeading>Wiring &amp; share token</SubHeading>
            </div>
            <ActionGrid>
              {/* Set Policy (swap the model) */}
              <ProtocolActionForm
                currency={currency}
                title="Set Policy"
                description="vault.set_policy"
                actionLabel="Wire policy"
                disabled={!isVaultAdmin}
                requireConfirm
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!newPolicyAddr) throw new Error("policy address is required");
                  return setVaultPolicy(contracts, address, newPolicyAddr);
                }}
                onSuccess={() => { setNewPolicyAddr(""); handleSuccess(); }}
              >
                <FormField id="new-policy-addr" label="Policy Contract (C…)" placeholder="C…" value={newPolicyAddr} onChange={setNewPolicyAddr} disabled={!isVaultAdmin} hint="Swaps the underwriting model without moving funds. The new policy must be wired to this vault + registry." />
              </ProtocolActionForm>

              {/* Relabel shares */}
              <ProtocolActionForm
                currency={currency}
                title="Re-label Shares"
                description="vault.set_token_metadata"
                actionLabel="Set metadata"
                disabled={!isVaultAdmin}
                onSubmit={async () => {
                  if (!address) throw new Error("no wallet");
                  if (!tokenName.trim() || !tokenSymbol.trim()) throw new Error("name and symbol are required");
                  return setTokenMetadata(contracts, address, tokenName.trim(), tokenSymbol.trim());
                }}
                onSuccess={() => { setTokenName(""); setTokenSymbol(""); handleSuccess(); }}
              >
                <FormField id="token-name" label="Share token name" placeholder="Mutav USD Reserve" value={tokenName} onChange={setTokenName} disabled={!isVaultAdmin} />
                <FormField id="token-symbol" label="Share token symbol" placeholder="MUSD" value={tokenSymbol} onChange={setTokenSymbol} disabled={!isVaultAdmin} hint="Decimals are fixed at 7. Balances and NAV are preserved." />
              </ProtocolActionForm>
            </ActionGrid>
            </>
            )}

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
  money,
}: {
  guarantee?: { id: number; guarantee: Guarantee; isCurrent: boolean };
  money: Money;
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
          value: fmtFiat(g.monthly_amount, money),
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
          {guarantee.isCurrent ? "fees current" : "OVERDUE"}
        </Mono>
      </div>
    </div>
  );
}
