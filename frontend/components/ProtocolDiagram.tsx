"use client";

/**
 * ProtocolDiagram — the MUTAV money-cycle as a blueprint, with the gates marked.
 *
 * The RESERVE is the vault contract: it holds custody, mints reserve shares at NAV,
 * runs the surplus-gated redemption escrow queue, and its allocator deploys idle
 * float across pluggable STRATEGY ADAPTERS (DeFindex · Soroswap · Blend) for
 * yield — all inside the reserve, not an external counterparty. External parties
 * are only the Investor, the Guarantees (fianças), and the Landlord.
 *
 * Built on React Flow: nodes are brand-styled, edges are routed by the library,
 * and each gate rides on its edge label as an amber ◇N — nothing overlaps. Static
 * on the homepage (pan/zoom/drag off). The three main nodes share one horizontal
 * axis so the inflow/outflow lanes stay straight and never cross.
 *
 * Precision Brutalism: sharp corners, hairline strokes, mono labels, amber only
 * on the gate markers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  MarkerType,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const STROKE = "var(--color-text-3)";
const ACCENT = "var(--color-accent)";
const ARROW_COLOR = "#6b6b6b";
// Blueprint grid behind the diagram. Neutral cool gray (same as the node hairlines)
// so it never reads warm; the backdrop effect comes from the 30% opacity on the
// Background below, not from the colour. Hardcoded like ARROW_COLOR: Background paints
// an SVG attribute, where CSS vars don't resolve. Investidor (dark) front.
const GRID_COLOR = "#2A2D33";

const HANDLE_STYLE: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
};
function sideStyle(pos: Position, off: string): React.CSSProperties {
  if (pos === Position.Left || pos === Position.Right) return { ...HANDLE_STYLE, top: off };
  return { ...HANDLE_STYLE, left: off };
}

// ── Leaf node: a simple brand box (INVESTOR / GUARANTEES / LANDLORD) ──────────
type HandleSpec = { id: string; type: "source" | "target"; pos: Position; off: string };
type LeafData = { title: string; sub: string; w: number; h: number; handles: HandleSpec[] };

function LeafNode({ data }: NodeProps<Node<LeafData>>) {
  return (
    <div
      style={{
        width: data.w,
        height: data.h,
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        padding: "0 10px",
      }}
    >
      <span className="font-display" style={{ fontSize: "14px", letterSpacing: "0.02em", color: "var(--color-text)", lineHeight: 1 }}>
        {data.title}
      </span>
      <span className="font-mono" style={{ fontSize: "9px", color: "var(--color-text-3)", lineHeight: 1.35, textAlign: "center", whiteSpace: "pre-line" }}>
        {data.sub}
      </span>
      {data.handles.map((h) => (
        <Handle key={h.id} id={h.id} type={h.type} position={h.pos} style={sideStyle(h.pos, h.off)} />
      ))}
    </div>
  );
}

// ── Reserve node: the vault, with its internal strategy/yield compartment ─────
function ReserveNode({ data }: NodeProps<Node<{ w: number; h: number }>>) {
  return (
    <div
      style={{
        width: data.w,
        height: data.h,
        backgroundColor: "var(--color-surface)",
        // RESERVE is the protocol's core — scarce amber outline marks it as the hub.
        border: `1px solid ${ACCENT}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
          <span className="font-display" style={{ fontSize: "17px", letterSpacing: "0.02em", color: "var(--color-text)" }}>
            RESERVE
          </span>
          <span className="font-mono" style={{ fontSize: "8.5px", color: ACCENT, letterSpacing: "0.04em" }}>
            SEP-0056
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: "9px", color: "var(--color-text-3)" }}>
          OZ FungibleVault · NAV · async redeem (7540)
        </span>
      </div>

      {/* Internal strategy-adapter compartment (the yield lives here) */}
      <div style={{ padding: "11px 14px", display: "flex", flexDirection: "column", gap: "6px", flex: 1, justifyContent: "center" }}>
        <span className="font-body" style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-3)" }}>
          Strategy adapters
        </span>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {["DeFindex", "Soroswap", "Blend"].map((s) => (
            <span
              key={s}
              className="font-mono"
              style={{ fontSize: "9.5px", color: "var(--color-text-2)", border: "1px solid var(--color-border)", padding: "1px 6px" }}
            >
              {s}
            </span>
          ))}
        </div>
        <span className="font-mono" style={{ fontSize: "9px", color: "var(--color-text-3)" }}>
          idle float → yield <span style={{ color: ACCENT, fontWeight: 600 }}>◇3</span>
        </span>
      </div>

      {/* Handles */}
      <Handle id="dep" type="target" position={Position.Left} style={sideStyle(Position.Left, "42%")} />
      <Handle id="red" type="source" position={Position.Left} style={sideStyle(Position.Left, "58%")} />
      <Handle id="prem" type="target" position={Position.Right} style={sideStyle(Position.Right, "50%")} />
      <Handle id="cover" type="source" position={Position.Bottom} style={sideStyle(Position.Bottom, "50%")} />
    </div>
  );
}

// ── Custom edge: routed path + bordered mono label with amber gate mark ───────
type GateData = { label: string; gate?: string; dy?: number };

function GateEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }: EdgeProps<Edge<GateData>>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: STROKE, strokeWidth: 1.25 }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (data?.dy ?? 0)}px)`,
            backgroundColor: "var(--color-canvas)",
            border: "1px solid var(--color-border)",
            padding: "2px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--color-text-2)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            lineHeight: 1.3,
          }}
        >
          {data?.label}
          {data?.gate && <span style={{ color: ACCENT, fontWeight: 600 }}>{`  ◇${data.gate}`}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { leaf: LeafNode, reserve: ReserveNode };
const edgeTypes = { gate: GateEdge };
const arrow = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: ARROW_COLOR };

const NODES: Node[] = [
  {
    id: "investor",
    type: "leaf",
    position: { x: 70, y: 137 },
    data: {
      title: "INVESTOR",
      sub: "reserve shares\nSEP-0041",
      w: 152,
      h: 66,
      handles: [
        { id: "dep", type: "source", pos: Position.Right, off: "29%" },
        { id: "red", type: "target", pos: Position.Right, off: "71%" },
      ],
    },
  },
  { id: "reserve", type: "reserve", position: { x: 372, y: 82 }, data: { w: 288, h: 176 } },
  {
    id: "guarantees",
    type: "leaf",
    position: { x: 806, y: 137 },
    data: {
      title: "GUARANTEES",
      sub: "tenant fee · policy",
      w: 156,
      h: 66,
      handles: [
        { id: "prem", type: "source", pos: Position.Left, off: "50%" },
      ],
    },
  },
  {
    id: "landlord",
    type: "leaf",
    position: { x: 426, y: 330 },
    data: {
      title: "PARTNER AGENCY",
      sub: "default payout",
      w: 180,
      h: 64,
      handles: [{ id: "cover", type: "target", pos: Position.Top, off: "50%" }],
    },
  },
];

const EDGES: Edge<GateData>[] = [
  { id: "deposit", type: "gate", source: "investor", sourceHandle: "dep", target: "reserve", targetHandle: "dep", markerEnd: arrow, data: { label: "deposit USDC", dy: -20 } },
  { id: "redeem", type: "gate", source: "reserve", sourceHandle: "red", target: "investor", targetHandle: "red", markerEnd: arrow, data: { label: "async redeem", gate: "1", dy: 20 } },
  { id: "premium", type: "gate", source: "guarantees", sourceHandle: "prem", target: "reserve", targetHandle: "prem", markerEnd: arrow, data: { label: "fee → NAV", gate: "2", dy: -20 } },
  { id: "cover", type: "gate", source: "reserve", sourceHandle: "cover", target: "landlord", targetHandle: "cover", markerEnd: arrow, data: { label: "cover_default", gate: "2" } },
];

const GATES = [
  { n: "1", title: "Solvency gate", body: "Async redemption (EIP-7540 style): request → surplus-gated process → claim. Exits and new guarantees draw only from free_capital = stable_assets − coverage_required. stable ≥ coverage, always — no bank run." },
  { n: "2", title: "Fee gate", body: "A guarantee is covered only while its fees are current. Stop paying → coverage lapses and cover_default halts until it's caught up." },
  { n: "3", title: "Stable-backed floor", body: "Only stable strategy balances count toward coverage. Volatile adapters lift NAV but never the floor, so a price crash can't make the reserve insolvent." },
];

const TECH = [
  { label: "Soroban", href: "https://stellar.org/soroban" },
  { label: "Stellar Testnet", href: "https://stellar.org" },
  { label: "SEP-0056 Tokenized Vault", href: "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md" },
  { label: "SEP-0041 Token", href: "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md" },
  { label: "EIP-7540 Async Redeem", href: "https://eips.ethereum.org/EIPS/eip-7540" },
  { label: "OpenZeppelin", href: "https://docs.openzeppelin.com/stellar-contracts" },
  { label: "DeFindex", href: "https://defindex.io" },
  { label: "Soroswap", href: "https://soroswap.finance" },
  { label: "Blend", href: "https://blend.capital" },
];

const DIAGRAM_LABEL =
  "Protocol money-flow diagram. The Investor deposits USDC into the Reserve vault " +
  "and redeems shares through an async, solvency-gated queue. Guarantees pay fees " +
  "into the Reserve (fee to NAV); the Reserve covers defaults to the Partner Agency " +
  "via cover_default. Idle float earns yield through strategy adapters. The gates are " +
  "described in the legend below.";

export function ProtocolDiagram() {
  const boxRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  // React Flow paints the grid + arrowheads as SVG attributes, where CSS vars
  // don't resolve — so resolve the brand tokens to concrete values at runtime
  // (and stay in sync if the front/theme changes) instead of hardcoding hex.
  const [tokens, setTokens] = useState({ grid: GRID_COLOR, arrow: ARROW_COLOR });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const grid = cs.getPropertyValue("--color-border").trim() || GRID_COLOR;
    const arrow = cs.getPropertyValue("--color-text-3").trim() || ARROW_COLOR;
    setTokens({ grid, arrow });
  }, []);

  const edges = useMemo<Edge[]>(
    () =>
      EDGES.map((e) => ({
        ...e,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: tokens.arrow },
      })),
    [tokens.arrow],
  );

  const onInit = useCallback((inst: ReactFlowInstance) => {
    rfRef.current = inst;
    inst.fitView({ padding: 0.14 });
  }, []);

  // Re-fit whenever the container resizes — fitView runs once on mount, so
  // without this the end nodes get clipped when the viewport narrows (mobile).
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => rfRef.current?.fitView({ padding: 0.14 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      {/* role="img" collapses the non-interactive canvas to a single labelled
          node for AT; the readable gate semantics live in the legend below. */}
      <div
        ref={boxRef}
        role="img"
        aria-label={DIAGRAM_LABEL}
        style={{ height: "clamp(360px, 42vw, 480px)", border: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)" }}
      >
        <ReactFlow
          nodes={NODES}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.14 }}
          // Allow fitView to zoom out far enough to fit every node on a narrow
          // viewport (the default minZoom 0.5 clamped and clipped the end nodes).
          minZoom={0.2}
          onInit={onInit}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          style={{ backgroundColor: "var(--color-canvas)" }}
        >
          {/* Blueprint grid — sits behind the nodes/edges, inside the bordered box. 30% opacity → backdrop. */}
          <Background variant={BackgroundVariant.Lines} gap={28} lineWidth={1} color={tokens.grid} style={{ opacity: 0.3 }} />
        </ReactFlow>
      </div>

      {/* ── Gate legend ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1px",
          backgroundColor: "var(--color-border)",
          border: "1px solid var(--color-border)",
          borderTop: "none",
        }}
      >
        {GATES.map((g) => (
          <div key={g.n} style={{ backgroundColor: "var(--color-surface)", padding: "18px 20px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span
              className="font-mono"
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: "20px",
                height: "20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${ACCENT}`,
                color: ACCENT,
                fontSize: "10px",
                fontWeight: 600,
                transform: "rotate(45deg)",
              }}
            >
              <span style={{ transform: "rotate(-45deg)" }}>{g.n}</span>
            </span>
            <div>
              <p className="font-body" style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text)", margin: "2px 0 6px" }}>
                {g.title}
              </p>
              <p className="font-mono" style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--color-text-2)", margin: 0 }}>
                {g.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Built-on / standards strip ── */}
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderTop: "none",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span className="font-body" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-3)" }}>
          Built on
        </span>
        {TECH.map((t) => (
          <a
            key={t.label}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{
              fontSize: "10.5px",
              color: "var(--color-text-2)",
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              padding: "3px 9px",
              letterSpacing: "0.02em",
            }}
          >
            {t.label}
          </a>
        ))}
      </div>
    </div>
  );
}
