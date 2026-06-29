/**
 * Strategy provider registry — the single source of truth for "what venue is
 * behind this strategy adapter." Keyed by on-chain adapter address so it
 * generalizes to N wired strategies; add an entry as each venue ships.
 *
 * Replaces the per-call `process.env.NEXT_PUBLIC_ADAPTER_ID` checks that were
 * scattered across the reserve hub and venue UI.
 */

import { config } from "./config";

export interface StrategyProvider {
  name: string;
  kind: string;
  blurb: string;
  url: string;
}

const DEFINDEX: StrategyProvider = {
  name: "DeFindex",
  kind: "Multi-strategy yield",
  blurb:
    "On-chain yield aggregator on Stellar. The adapter routes reserve capital into a DeFindex vault and reports its live balance back.",
  url: "https://defindex.io",
};

/** Address → provider metadata for explicitly-named adapters (env override). */
const PROVIDERS: Record<string, StrategyProvider> = {};
if (config.contracts.adapter) PROVIDERS[config.contracts.adapter] = DEFINDEX;

/**
 * Provider metadata for a strategy adapter address.
 *
 * `adapter-defindex` is the protocol's ONLY real strategy adapter (see the
 * workspace CLAUDE.md), so every wired strategy adapter is a DeFindex adapter —
 * we default to DeFindex rather than showing a raw contract address. Each reserve
 * has a DISTINCT adapter address that also rotates on redeploy, and
 * `sync-deploy.sh` doesn't emit adapter IDs, so per-reserve env wiring would be
 * both incomplete and fragile. The explicit `PROVIDERS` registry still wins when
 * a `NEXT_PUBLIC_ADAPTER_ID` is set (and is where a non-DeFindex venue would be
 * registered once one ships).
 */
export function resolveProvider(addr: string): StrategyProvider {
  return PROVIDERS[addr] ?? DEFINDEX;
}

/** Friendly venue name for a strategy adapter address. */
export function venueName(addr: string): string {
  return resolveProvider(addr).name;
}

/**
 * Catalog of strategy ADAPTERS the vault can interact with — the operator-facing
 * "what venues can this reserve plug into" list (akin to Safe modules/plugins).
 * `live` adapters can be wired today (an on-chain `address` when deployed);
 * `planned` ones are designed against the same `Strategy` trait but not shipped.
 */
export interface AdapterCatalogEntry extends StrategyProvider {
  status: "live" | "planned";
  /** Deployed adapter contract address, when it exists on-chain. */
  address?: string;
}

export const ADAPTER_CATALOG: AdapterCatalogEntry[] = [
  {
    ...DEFINDEX,
    status: "live",
    address: config.contracts.adapter || undefined,
  },
  {
    name: "Soroswap",
    kind: "AMM / DEX liquidity",
    blurb:
      "AMM and swap aggregator on Stellar. A future adapter would route idle reserve into Soroswap liquidity against the same Strategy trait.",
    url: "https://soroswap.finance",
    status: "planned",
  },
  {
    name: "Blend",
    kind: "Lending pools",
    blurb:
      "Lending protocol on Stellar. A future adapter would supply reserve capital into Blend pools for lending yield.",
    url: "https://blend.capital",
    status: "planned",
  },
];
