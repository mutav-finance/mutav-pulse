"use client";

/**
 * ZkSolvencyBadge — o selo de solvência provado por ZK (zk-SNARK Groth16).
 *
 * Acima do SolvencyChip na página de transparência. Onde o SolvencyChip prova
 * a solvência com o que está PÚBLICO na chain, este selo prova — sem expor nada —
 * que as reservas (inclusive o que é secreto) cobrem TODAS as garantias.
 *
 * Lê `reads.solvencyAttestation()` (last_attestation do attestor). O contrato só
 * grava `solvent:true` para cobertura >= 100% (piso MIN_RATIO_BPS), então o verde
 * carrega significado on-chain. A atestação expõe apenas a FAIXA (`ratio_bps`) +
 * frescor (`ts`/`ledger`) — nunca valores, carteiras ou clientes.
 *
 * UX (abstrai a blockchain): visão padrão sem hashes/endereços; "Como funciona?"
 * em 3 bullets sem jargão; detalhes técnicos + re-verificação no drawer; estado
 * vermelho honesto se a prova falhou/expirou.
 *
 * Design: Precision Brutalism / Investidor (dark + âmbar escasso). O âmbar marca
 * a identidade "provado" (barra de acento + ações); o verde/vermelho é o estado.
 */

import { useState } from "react";
import type { Attestation } from "@/lib/contracts";

/** Acima disto a prova é considerada velha demais para o selo ficar verde. */
const STALE_AFTER_S = 24 * 3600; // 24h
/** Piso de cobertura (bps) — espelha MIN_RATIO_BPS do attestor. */
const MIN_RATIO_BPS = 10_000;

interface ZkSolvencyBadgeProps {
  attestation: Attestation | null;
  loading?: boolean;
  error?: string;
  /** Re-lê a atestação on-chain (botão "Re-verificar agora"). */
  onReverify?: () => void;
  /** Link do attestor no explorador (detalhes técnicos / re-verificação independente). */
  explorerUrl?: string;
  /** "Agora" em ms (epoch) — vindo do `lastRefreshed` da página. Mantém o render
   *  puro (sem Date.now()) e o "Conferido há X" coerente com a última leitura. */
  nowMs?: number;
}

type Status = "loading" | "error" | "proven" | "stale" | "unproven";

function relTime(ageS: number): string {
  if (ageS < 90) return "há poucos instantes";
  const m = Math.floor(ageS / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(ageS / 3600);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(ageS / 86400);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

/** Mono span com tabular-nums. */
function Mono({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="font-mono"
      style={{ fontFeatureSettings: '"tnum" 1', fontVariantNumeric: "tabular-nums", ...style }}
    >
      {children}
    </span>
  );
}

export function ZkSolvencyBadge({
  attestation,
  loading = false,
  error,
  onReverify,
  explorerUrl,
  nowMs,
}: ZkSolvencyBadgeProps) {
  const [open, setOpen] = useState(false);

  // ── Deriva o estado ────────────────────────────────────────────────────────
  // `now` vem da página (nowMs); render puro, sem Date.now(). Sem nowMs (antes da
  // 1ª leitura) o selo está em loading e não usa idade — ageS fica null.
  const nowS = nowMs != null ? Math.floor(nowMs / 1000) : null;
  const ageS = attestation && nowS != null ? nowS - Number(attestation.ts) : null;
  const meetsFloor = !!attestation && attestation.solvent && attestation.ratio_bps >= MIN_RATIO_BPS;

  let status: Status;
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!meetsFloor) status = "unproven";
  else if (ageS !== null && ageS > STALE_AFTER_S) status = "stale";
  else status = "proven";

  const band = attestation ? `${(attestation.ratio_bps / 100).toFixed(0)}%` : "100%";

  // Cores por estado (âmbar = identidade "provado"; verde/vermelho = estado).
  const accent =
    status === "proven"
      ? "var(--color-success)"
      : status === "stale"
        ? "var(--color-accent)"
        : status === "unproven" || status === "error"
          ? "var(--color-error)"
          : "var(--color-border)";

  // ── Estados curtos (loading / error) ────────────────────────────────────────
  if (status === "loading") {
    return (
      <Shell accent="var(--color-border)" barColor="var(--color-border)">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }} aria-busy="true">
          <Dot color="var(--color-border)" />
          <span
            className="font-mono"
            style={{ fontSize: "12px", color: "var(--color-text-3)", letterSpacing: "0.06em" }}
          >
            VERIFICANDO PROVA…
          </span>
        </div>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell accent="var(--color-error)" barColor="var(--color-error)" role="alert">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Dot color="var(--color-error)" />
          <span
            className="font-mono"
            style={{ fontSize: "12px", color: "var(--color-error)", letterSpacing: "0.06em" }}
          >
            SELO INDISPONÍVEL
          </span>
          <span className="font-body" style={{ fontSize: "12px", color: "var(--color-text-3)" }}>
            não foi possível ler a prova on-chain
          </span>
        </div>
      </Shell>
    );
  }

  // ── Headline por estado ─────────────────────────────────────────────────────
  const headline =
    status === "proven"
      ? "RESERVA PROVADA · LASTRO VERIFICADO"
      : status === "stale"
        ? "PROVA DESATUALIZADA"
        : "LASTRO NÃO CONFIRMADO";

  const body =
    status === "proven" ? (
      <>
        As reservas do fundo cobrem no mínimo <strong style={{ color: "var(--color-text)" }}>{band}</strong>{" "}
        das garantias emitidas — provado de forma independente, sem expor carteiras nem dados de clientes.{" "}
        Suas cotas <Mono style={{ fontSize: "0.95em" }}>mtvR</Mono> estão lastreadas.
      </>
    ) : status === "stale" ? (
      <>
        A última prova de solvência foi registrada {ageS !== null ? relTime(ageS) : ""} e não foi
        reconfirmada nas últimas 24h. A cobertura pode estar desatualizada — re-verifique abaixo.
      </>
    ) : (
      <>
        Não há prova de solvência válida registrada no momento. Isto é honesto por construção: se os
        números não fechassem, o selo ficaria assim automaticamente.
      </>
    );

  return (
    <Shell accent={accent} barColor={accent} role="status" ariaLabel={`Selo ZK: ${headline}`}>
      {/* Linha de status */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Dot color={accent} />
        <span
          className="font-mono"
          style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.08em", color: accent }}
        >
          {headline}
        </span>
        {/* Tag "ZK" — identidade da prova (âmbar escasso) */}
        <span
          className="font-mono"
          style={{
            fontSize: "9.5px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent)",
            padding: "1px 5px",
            opacity: 0.9,
          }}
          title="Prova de conhecimento-zero (zk-SNARK Groth16) verificada on-chain"
        >
          ZK
        </span>
        {status === "proven" && (
          <>
            <Divider />
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                className="font-body"
                style={{
                  fontSize: "10px",
                  color: "var(--color-text-3)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                COBERTURA
              </span>
              <Mono style={{ fontSize: "13px", color: "var(--color-success)" }}>≥ {band}</Mono>
            </div>
          </>
        )}
      </div>

      {/* Corpo */}
      <p
        className="font-body"
        style={{
          fontSize: "13.5px",
          lineHeight: 1.55,
          color: "var(--color-text-2)",
          margin: "12px 0 0",
          maxWidth: "640px",
        }}
      >
        {body}
      </p>

      {/* Frescor + ações */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "14px",
        }}
      >
        {attestation && ageS !== null && (
          <span
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.02em" }}
          >
            Conferido {relTime(ageS)}
          </span>
        )}

        {onReverify && (
          <button
            onClick={onReverify}
            className="font-body"
            style={{
              border: "1px solid var(--color-accent)",
              background: "transparent",
              color: "var(--color-accent)",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.03em",
              cursor: "pointer",
            }}
          >
            ↻ Re-verificar agora
          </button>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-body"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--color-text-2)",
            padding: "6px 4px",
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.03em",
            cursor: "pointer",
          }}
        >
          Como funciona? {open ? "▴" : "▾"}
        </button>
      </div>

      {/* Drawer "Como funciona?" */}
      {open && (
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <ul
            className="font-body"
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              maxWidth: "640px",
            }}
          >
            {[
              "Provamos com matemática que as reservas cobrem todas as garantias — sem revelar valores, carteiras nem dados de clientes.",
              "A conferência roda sozinha dentro de um contrato na blockchain. Ninguém precisa confiar na nossa palavra.",
              "Se algum número não fechasse, o selo ficaria vermelho automaticamente — não dá para forjar.",
            ].map((t, i) => (
              <li key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "5px",
                    height: "5px",
                    marginTop: "7px",
                    flexShrink: 0,
                    backgroundColor: "var(--color-accent)",
                  }}
                />
                <span style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--color-text-2)" }}>
                  {t}
                </span>
              </li>
            ))}
          </ul>

          {/* Detalhes técnicos */}
          <div
            style={{
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px dashed var(--color-border)",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: "10px", color: "var(--color-text-3)", letterSpacing: "0.04em" }}
            >
              Prova zk-SNARK (Groth16 · BN254) verificada on-chain
            </span>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-accent)",
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--color-accent-dim)",
                }}
              >
                re-verificar você mesmo no explorador ↗
              </a>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── Primitivos visuais ─────────────────────────────────────────────────────────

/** Casca do selo: barra de acento à esquerda (Precision Brutalism) + superfície. */
function Shell({
  children,
  accent,
  barColor,
  role,
  ariaLabel,
}: {
  children: React.ReactNode;
  accent: string;
  barColor: string;
  role?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${barColor}`,
        padding: "16px 18px",
      }}
    >
      {children}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  // Quadrado estático colorido pelo estado (padrão do SolvencyChip / STYLE.md §3.5).
  return (
    <span
      aria-hidden="true"
      style={{ width: "7px", height: "7px", flexShrink: 0, backgroundColor: color, display: "inline-block" }}
    />
  );
}

function Divider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: "1px", height: "14px", backgroundColor: "var(--color-border)", flexShrink: 0 }}
    />
  );
}
