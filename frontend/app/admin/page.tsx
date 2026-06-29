"use client";

/**
 * /admin — Admin multisig settings (terminal front)
 *
 * Two zones:
 *   1. Admin status (read-only): the canonical admin account, then each live
 *      reserve's on-chain vault/policy admin with a ✓/⚠ match indicator (surfaces
 *      drift between contracts).
 *   2. Signer management: the admin account's signer set + thresholds, with
 *      add-signer / remove-signer forms. The admin account is a classic multisig
 *      (threshold 1 — any signer authorizes); add/remove are classic `set_options`
 *      ops sourced from the admin account and signed by the connected signer.
 *
 * Gate: signer management is enabled only when the connected wallet IS a signer of
 * the admin account. Everyone can read the status.
 *
 * Design: Terminal front, copper accent. Precision Brutalism — no rounded
 * corners, no shadows. Mono for addresses/numbers.
 */

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/components/WalletProvider";
import { ConnectButton } from "@/components/ConnectButton";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/Mono";
import { ProtocolActionForm, FormField, FormSelect } from "@/components/ProtocolActionForm";
import { reserveReads } from "@/lib/contracts";
import { LIVE_RESERVES } from "@/lib/reserves";
import {
  readAdminAccount,
  isSigner,
  isValidPubkey,
  type AdminAccount,
} from "@/lib/admin-account";
import { addSigner, removeSigner } from "@/lib/admin-account-tx";
import { contractUrl } from "@/lib/config";
import { truncAddr, errMsg } from "@/lib/format";

interface ReserveAdminRow {
  id: string;
  currency: string;
  vaultAdmin: string;
  policyAdmin: string;
}

interface AdminData {
  rows: ReserveAdminRow[];
  account: AdminAccount | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: AdminData = {
  rows: [],
  account: null,
  loading: true,
  error: null,
};

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export default function AdminPage() {
  const { address } = useWallet();

  // Single state object updated via functional updater — mirrors the protocol
  // cockpit so the load effect stays off the set-state-in-effect path.
  const [data, setData] = useState<AdminData>(INITIAL);
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  // ── Form state ───────────────────────────────────────────────────────────
  const [newSigner, setNewSigner] = useState("");
  const [newWeight, setNewWeight] = useState("1");
  const [removeTarget, setRemoveTarget] = useState("");

  const fetchAll = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const reserveRows = await Promise.all(
        LIVE_RESERVES.map(async (r): Promise<ReserveAdminRow> => {
          const reads = reserveReads(r.contracts);
          const [vaultAdmin, policyAdmin] = await Promise.all([
            reads.vaultAdmin(),
            reads.policyAdmin(),
          ]);
          return { id: r.id, currency: r.currency, vaultAdmin, policyAdmin };
        }),
      );
      // Canonical admin = the primary (first live) reserve's vault admin. The
      // status table flags any reserve whose admins differ from it.
      const canonical = reserveRows[0]?.vaultAdmin ?? "";
      // The status table needs only the per-reserve admin reads above. The signer
      // set is a SEPARATE Horizon read — if it fails (transient), still commit the
      // status table and surface a scoped error rather than blanking the whole
      // page. (readAdminAccount returns [] for a contract-address admin; only a
      // transient error throws.)
      let acct: AdminAccount | null = null;
      let signerError: string | null = null;
      if (canonical) {
        try {
          acct = await readAdminAccount(canonical);
        } catch (e) {
          signerError = errMsg(e, "Failed to read admin signers. Signer management unavailable; retry.");
        }
      }
      setData({ rows: reserveRows, account: acct, loading: false, error: signerError });
    } catch (e) {
      setData((prev) => ({ ...prev, loading: false, error: errMsg(e, "Failed to load admin data") }));
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  const { rows, account, loading, error } = data;
  // Canonical admin account = the primary reserve's vault admin (derived, not
  // stored — it can never drift from `rows`).
  const adminAccount = rows[0]?.vaultAdmin ?? "";
  const canManage = !!account && isSigner(account.signers, address);
  // Signers that may be removed: everything except the account's own master key
  // (key === account address) — removing it here would risk a master lockout.
  const removable = (account?.signers ?? []).filter(
    (s) => !eq(s.key, adminAccount),
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
      <div style={{ width: "100%", padding: "28px var(--page-pad) 64px" }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "24px",
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
              ADMIN · MULTISIG
            </h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            {canManage && (
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-copper)",
                  border: "1px solid var(--color-copper)",
                  padding: "2px 8px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                SIGNER
              </span>
            )}
            <Button
              variant="outline"
              onClick={fetchAll}
              disabled={loading}
              className="font-mono h-auto disabled:opacity-100 disabled:pointer-events-auto"
              style={{
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-3)",
                padding: "5px 12px",
                fontSize: "11px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {loading ? "LOADING…" : "↻ REFRESH"}
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              border: "1px solid var(--color-error)",
              padding: "12px 16px",
              marginBottom: "24px",
            }}
          >
            <p className="font-mono" style={{ fontSize: "12px", color: "var(--color-error)", margin: 0, wordBreak: "break-all" }}>
              {error}
            </p>
          </div>
        )}

        {/* ── Zone 1: Admin status ───────────────────────────────────────── */}
        <SectionHeading
          label="ADMIN STATUS"
          hint="Who controls each reserve's contracts on-chain."
        />
        <div
          style={{
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
            marginBottom: "12px",
            padding: "14px 20px",
          }}
        >
          <LabelRow label="ADMIN ACCOUNT">
            {adminAccount ? (
              <a href={contractUrl(adminAccount)} target="_blank" rel="noreferrer" style={{ color: "var(--color-copper)", textDecoration: "none" }}>
                <Mono>{truncAddr(adminAccount)}</Mono>
              </a>
            ) : (
              <span style={{ color: "var(--color-text-3)" }}>—</span>
            )}
          </LabelRow>
          {account && (
            <LabelRow label="THRESHOLDS">
              <Mono style={{ color: "var(--color-text-2)" }}>
                low {account.thresholds.low} · med {account.thresholds.med} · high {account.thresholds.high}
              </Mono>
              <span className="font-body" style={{ fontSize: "10px", color: "var(--color-text-3)", marginLeft: "8px" }}>
                {account.thresholds.med <= 1 ? "any single signer authorizes" : "M-of-N: multiple signatures required"}
              </span>
            </LabelRow>
          )}
        </div>
        <div style={{ border: "1px solid var(--color-border)", marginBottom: "32px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>RESERVE</Th>
                <Th>VAULT ADMIN</Th>
                <Th>POLICY ADMIN</Th>
                <Th>MATCH</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const matches = !!adminAccount && eq(r.vaultAdmin, adminAccount) && eq(r.policyAdmin, adminAccount);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <Td><span className="font-mono" style={{ color: "var(--color-text)", letterSpacing: "0.04em" }}>{r.currency}</span></Td>
                    <Td><Mono style={{ color: "var(--color-text-2)" }}>{truncAddr(r.vaultAdmin)}</Mono></Td>
                    <Td><Mono style={{ color: "var(--color-text-2)" }}>{truncAddr(r.policyAdmin)}</Mono></Td>
                    <Td>
                      <span className="font-mono" style={{ color: matches ? "var(--color-success)" : "var(--color-error)" }}>
                        {matches ? "✓ canonical" : "⚠ drift"}
                      </span>
                    </Td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><Td colSpan={4}><span style={{ color: "var(--color-text-3)" }}>No live reserves.</span></Td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Zone 2: Signer management ──────────────────────────────────── */}
        <SectionHeading
          label="SIGNERS"
          hint="Each signer can act as admin independently (threshold 1)."
        />

        {/* Gate notice */}
        {!address ? (
          <GateNotice>
            Connect a wallet to manage signers.
            <span style={{ marginLeft: "12px", display: "inline-flex" }}><ConnectButton /></span>
          </GateNotice>
        ) : !canManage && account ? (
          <GateNotice>
            Your wallet <Mono>{truncAddr(address)}</Mono> is not a signer of the admin account.
            You can view the signer set but not change it. Ask a current signer to add you.
          </GateNotice>
        ) : null}

        {/* Signer table */}
        <div style={{ border: "1px solid var(--color-border)", marginBottom: "16px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>SIGNER</Th>
                <Th>WEIGHT</Th>
                <Th>ROLE</Th>
              </tr>
            </thead>
            <tbody>
              {(account?.signers ?? []).map((s) => (
                <tr key={s.key} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Td>
                    <a href={contractUrl(s.key)} target="_blank" rel="noreferrer" style={{ color: "var(--color-text-2)", textDecoration: "none" }}>
                      <Mono>{truncAddr(s.key)}</Mono>
                    </a>
                  </Td>
                  <Td><Mono style={{ color: "var(--color-text-2)" }}>{s.weight}</Mono></Td>
                  <Td>
                    <span className="font-mono" style={{ fontSize: "10px", letterSpacing: "0.06em", color: "var(--color-text-3)" }}>
                      {eq(s.key, adminAccount) ? "MASTER" : "SIGNER"}
                      {address && eq(s.key, address) ? " · YOU" : ""}
                    </span>
                  </Td>
                </tr>
              ))}
              {!loading && (account?.signers.length ?? 0) === 0 && (
                <tr><Td colSpan={3}><span style={{ color: "var(--color-text-3)" }}>No signers.</span></Td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add / remove forms */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          <ProtocolActionForm
            title="Add signer"
            description="grant admin to a wallet"
            txContext="add-signer"
            actionLabel="Add Signer"
            disabled={!canManage}
            onSubmit={async () => {
              const pk = newSigner.trim();
              if (!isValidPubkey(pk)) throw new Error("Invalid public key: must be a G… address.");
              if (!address) throw new Error("Connect a signer wallet first.");
              const w = Number(newWeight || "1");
              if (!Number.isInteger(w) || w < 1 || w > 255) throw new Error("Weight must be an integer 1–255.");
              return addSigner(adminAccount, pk, address, w);
            }}
            onSuccess={() => { setNewSigner(""); setNewWeight("1"); bump(); }}
          >
            <FormField
              id="new-signer"
              label="SIGNER PUBLIC KEY"
              placeholder="G…"
              value={newSigner}
              onChange={setNewSigner}
              disabled={!canManage}
              hint="The wallet's Stellar public key. They sign with their own key, no key sharing."
            />
            <FormField
              id="new-weight"
              label="WEIGHT"
              type="number"
              min="1"
              step="1"
              value={newWeight}
              onChange={setNewWeight}
              disabled={!canManage}
              hint="1 keeps the any-signer-authorizes model."
            />
          </ProtocolActionForm>

          <ProtocolActionForm
            title="Remove signer"
            description="revoke admin from a wallet"
            txContext="remove-signer"
            actionLabel="Remove Signer"
            disabled={!canManage || removable.length === 0}
            requireConfirm
            onSubmit={async () => {
              if (!removeTarget) throw new Error("Select a signer to remove.");
              if (!address) throw new Error("Connect a signer wallet first.");
              // Lockout floor: the remaining signer weight must still meet the
              // account threshold (and at least 1), or the admin account — which
              // gates every vault/policy — becomes permanently unusable. Guards
              // the hardened case (master weight 0, or thresholds raised > 1).
              if (account) {
                const removed = account.signers.find((s) => eq(s.key, removeTarget));
                const remaining = account.signers.reduce(
                  (n, s) => n + (eq(s.key, removeTarget) ? 0 : s.weight),
                  0,
                );
                const floor = Math.max(account.thresholds.med, 1);
                if (removed && remaining < floor) {
                  throw new Error(
                    `Removing this signer drops total weight to ${remaining}, below the account threshold (${floor}). It would lock the admin account out. Lower the threshold or add another signer first.`,
                  );
                }
              }
              return removeSigner(adminAccount, removeTarget, address);
            }}
            onSuccess={() => { setRemoveTarget(""); bump(); }}
          >
            <FormSelect
              id="remove-target"
              label="SIGNER"
              value={removeTarget}
              onChange={setRemoveTarget}
              placeholder={removable.length ? "Select signer…" : "No removable signers"}
              disabled={!canManage || removable.length === 0}
              options={removable.map((s) => ({
                value: s.key,
                label: `${truncAddr(s.key)}${address && eq(s.key, address) ? " (you)" : ""}`,
              }))}
            />
          </ProtocolActionForm>
        </div>
      </div>
    </main>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────────

function SectionHeading({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
      <h2 className="font-display" style={{ fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text)", margin: 0 }}>
        {label}
      </h2>
      <span className="font-body" style={{ fontSize: "11px", color: "var(--color-text-3)" }}>{hint}</span>
    </div>
  );
}

function GateNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        padding: "12px 16px",
        marginBottom: "16px",
      }}
    >
      <p className="font-body" style={{ fontSize: "12px", color: "var(--color-text-2)", margin: 0, lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="font-mono"
      style={{
        textAlign: "left",
        padding: "8px 14px",
        fontSize: "10px",
        fontWeight: 500,
        letterSpacing: "0.08em",
        color: "var(--color-text-3)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={{ padding: "9px 14px", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", padding: "3px 0", flexWrap: "wrap" }}>
      <span
        className="font-mono"
        style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--color-text-3)", textTransform: "uppercase", minWidth: "120px" }}
      >
        {label}
      </span>
      <span style={{ fontSize: "12px" }}>{children}</span>
    </div>
  );
}
