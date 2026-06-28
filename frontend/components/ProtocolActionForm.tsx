"use client";

/**
 * ProtocolActionForm — generic form shell for protocol admin actions.
 *
 * Design: Terminal front, copper accent. Dense, utilitarian.
 * No rounded corners, no shadows. JetBrains Mono inputs. Copper CTA.
 *
 * Each admin action renders its own <ProtocolActionForm> with a title,
 * description, and the action callback. Field definitions are passed as
 * children (the parent builds the specific inputs and bundles args to onSubmit).
 *
 * Error messages are surfaced VERBATIM from the contract error string —
 * callers catch and forward the raw error message.
 */

import { createContext, useContext, useState } from "react";
import { errMsg } from "@/lib/format";
import { Mono } from "@/components/Mono";

/**
 * True while a consequential action is armed (confirm pending). The shared field
 * components below read this and lock themselves, so an operator can't change the
 * selection (e.g. which guarantee to cover) between reviewing it and confirming —
 * the value executed is the one that was reviewed. To edit, Cancel and re-arm.
 */
const ConfirmLockContext = createContext(false);

interface ProtocolActionFormProps {
  title: string;
  /** Reserve currency shown in amber next to the title — reinforces which fund. */
  currency?: string;
  description?: string;
  /** Label for the submit button (e.g. "Sign Guarantee", "Rebalance") */
  actionLabel: string;
  /**
   * Called when the form is submitted. Must throw with a message on failure.
   * Returns the confirmed tx hash.
   */
  onSubmit(): Promise<string>;
  /** Called with tx hash after success; parent refreshes reads */
  onSuccess?(hash: string): void;
  /** Form is disabled (e.g. not admin, or global pending) */
  disabled?: boolean;
  /** Require a second "confirm" click before executing (consequential actions). */
  requireConfirm?: boolean;
  children?: React.ReactNode;
}

export function ProtocolActionForm({
  title,
  currency,
  description,
  actionLabel,
  onSubmit,
  onSuccess,
  disabled = false,
  requireConfirm = false,
  children,
}: ProtocolActionFormProps) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isPending = status === "pending";
  const canSubmit = !disabled && !isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // First click on a consequential action arms the confirm step.
    if (requireConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);

    setStatus("pending");
    setErrorMsg(null);
    setLastHash(null);

    try {
      const hash = await onSubmit();
      setStatus("success");
      setLastHash(hash);
      onSuccess?.(hash);
    } catch (err) {
      // Surface contract assertion strings verbatim (errMsg handles bare strings).
      setErrorMsg(errMsg(err));
      setStatus("error");
    }
  }

  return (
    <section
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Form header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0 }}>
          <h3
            className="font-display"
            style={{
              fontSize: "14px",
              color: "var(--color-text)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>
          {currency && (
            <span
              className="font-mono"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.06em",
                color: "var(--color-accent)",
                whiteSpace: "nowrap",
              }}
            >
              {currency}
            </span>
          )}
        </div>
        {description && (
          <p
            className="font-body"
            style={{
              fontSize: "11px",
              color: "var(--color-text-3)",
              margin: 0,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} noValidate>
        {children && (
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {/* Lock inputs once the confirm step is armed so the reviewed value
                is the one executed (see ConfirmLockContext). */}
            <ConfirmLockContext.Provider value={confirming && !isPending}>
              {children}
            </ConfirmLockContext.Provider>
          </div>
        )}

        {/* Error output — verbatim contract message */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: "10px 20px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-error)",
                margin: 0,
                lineHeight: 1.5,
                wordBreak: "break-all",
              }}
            >
              {errorMsg}
            </p>
          </div>
        )}

        {/* Success confirmation */}
        {status === "success" && lastHash && (
          <div
            style={{
              padding: "10px 20px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-success)",
                margin: 0,
              }}
            >
              confirmed ·{" "}
              <Mono style={{ color: "var(--color-success)" }}>
                {lastHash.slice(0, 10)}…{lastHash.slice(-8)}
              </Mono>
            </p>
          </div>
        )}

        {/* Submit row */}
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={!canSubmit}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="font-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "32px",
              padding: "0 16px",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: canSubmit ? "pointer" : "not-allowed",
              // When armed (confirming) or hovered, fill copper to signal it's primed.
              backgroundColor:
                canSubmit && (confirming || isHovered)
                  ? "var(--color-copper)"
                  : "transparent",
              color:
                canSubmit && (confirming || isHovered)
                  ? "var(--color-canvas)"
                  : canSubmit
                    ? "var(--color-copper)"
                    : "var(--color-text-3)",
              border: `1px solid ${canSubmit ? "var(--color-copper)" : "var(--color-border)"}`,
              transition:
                "color 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
              opacity: isPending ? 0.6 : 1,
            }}
            aria-busy={isPending}
          >
            {isPending && (
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  backgroundColor: "var(--color-copper)",
                  animation: "mutav-pulse 2s linear infinite",
                }}
                aria-hidden="true"
              />
            )}
            {isPending ? "Submitting…" : confirming ? `Confirm ${actionLabel}` : actionLabel}
          </button>
          {confirming && !isPending && (
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="font-mono"
                style={{
                  height: "32px",
                  padding: "0 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-3)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <span
                className="font-mono"
                style={{ fontSize: "10px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
              >
                irreversible — click confirm to execute
              </span>
            </>
          )}
        </div>
      </form>
    </section>
  );
}

// ─── Shared field components ─────────────────────────────────────────────────

/** Labeled text / number input for terminal forms */
export function FormField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
  hint,
  min,
  step,
}: {
  id: string;
  label: string;
  type?: "text" | "number";
  placeholder?: string;
  value: string;
  onChange(v: string): void;
  disabled?: boolean;
  hint?: string;
  min?: string;
  step?: string;
}) {
  const locked = useContext(ConfirmLockContext);
  const isDisabled = disabled || locked;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label
        htmlFor={id}
        className="font-body"
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--color-text-2)",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={min}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        className="font-mono"
        style={{
          backgroundColor: "var(--color-canvas)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
          fontSize: "13px",
          padding: "7px 10px",
          fontFeatureSettings: '"tnum" 1',
          fontVariantNumeric: "tabular-nums",
          outline: "none",
          width: "100%",
          // No border-radius — Precision Brutalism
        }}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p
          id={`${id}-hint`}
          className="font-body"
          style={{
            fontSize: "10px",
            color: "var(--color-text-3)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Checkbox for boolean fields (e.g. volatile) */
export function FormCheckbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange(v: boolean): void;
  disabled?: boolean;
}) {
  const locked = useContext(ConfirmLockContext);
  const isDisabled = disabled || locked;
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={isDisabled}
        style={{
          width: "14px",
          height: "14px",
          accentColor: "var(--color-copper)",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      />
      <span
        className="font-body"
        style={{
          fontSize: "12px",
          color: "var(--color-text-2)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
    </label>
  );
}

/** Select dropdown for picking an ID */
export function FormSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const locked = useContext(ConfirmLockContext);
  const isDisabled = disabled || locked;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label
        htmlFor={id}
        className="font-body"
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--color-text-2)",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isDisabled}
        className="font-mono"
        style={{
          backgroundColor: "var(--color-canvas)",
          border: "1px solid var(--color-border)",
          color: value ? "var(--color-text)" : "var(--color-text-3)",
          fontSize: "13px",
          padding: "7px 10px",
          outline: "none",
          width: "100%",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
