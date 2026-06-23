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

import { useState } from "react";

interface ProtocolActionFormProps {
  title: string;
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
  children?: React.ReactNode;
}

function Mono({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className="font-mono"
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

export function ProtocolActionForm({
  title,
  description,
  actionLabel,
  onSubmit,
  onSuccess,
  disabled = false,
  children,
}: ProtocolActionFormProps) {
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isPending = status === "pending";
  const canSubmit = !disabled && !isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("pending");
    setErrorMsg(null);
    setLastHash(null);

    try {
      const hash = await onSubmit();
      setStatus("success");
      setLastHash(hash);
      onSuccess?.(hash);
    } catch (err) {
      // Surface contract assertion strings verbatim
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Transaction failed";
      setErrorMsg(msg);
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
            {children}
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
        <div style={{ padding: "12px 20px" }}>
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
              backgroundColor:
                canSubmit && isHovered
                  ? "var(--color-copper)"
                  : "transparent",
              color:
                canSubmit && isHovered
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
            {isPending ? "Submitting…" : actionLabel}
          </button>
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
        disabled={disabled}
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
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{
          width: "14px",
          height: "14px",
          accentColor: "var(--color-copper)",
          cursor: disabled ? "not-allowed" : "pointer",
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
        disabled={disabled}
        className="font-mono"
        style={{
          backgroundColor: "var(--color-canvas)",
          border: "1px solid var(--color-border)",
          color: value ? "var(--color-text)" : "var(--color-text-3)",
          fontSize: "13px",
          padding: "7px 10px",
          outline: "none",
          width: "100%",
          cursor: disabled ? "not-allowed" : "pointer",
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
