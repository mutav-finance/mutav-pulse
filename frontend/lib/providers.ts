/**
 * Strategy provider registry — the single source of truth for "what venue is
 * behind this strategy adapter." Keyed by on-chain adapter address so it
 * generalizes to N wired strategies; add an entry as each venue ships.
 *
 * Replaces the per-call `process.env.NEXT_PUBLIC_ADAPTER_ID` checks that were
 * scattered across the reserve hub and venue UI.
 */

import { config } from "./config";
import { truncAddr } from "./format";

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

/** Address → provider metadata for every adapter we can name. */
const PROVIDERS: Record<string, StrategyProvider> = {};
if (config.contracts.adapter) PROVIDERS[config.contracts.adapter] = DEFINDEX;

/** Provider metadata for a strategy address, or null when unknown. */
export function resolveProvider(addr: string): StrategyProvider | null {
  return PROVIDERS[addr] ?? null;
}

/** Friendly venue name for a strategy address; truncated address when unknown. */
export function venueName(addr: string): string {
  return resolveProvider(addr)?.name ?? truncAddr(addr);
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
