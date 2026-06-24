/**
 * Currency reserves registry.
 *
 * MUTAV is multi-currency: each reserve is its OWN set of contracts pegged to a
 * currency. The currency defines the underlying asset the reserve holds AND the
 * currency it pays defaults in. The MBRL reserve sits in Selic/CDI-yielding
 * instruments and pays BRL rents; the MUSD reserve sits in stablecoin DeFi; the
 * MARS reserve sits in peso instruments and serves the Argentine market. The
 * vault is named for the fiat (MUSD); the deposited stablecoin token (e.g. USDC
 * for MUSD) is a separate thing — see `depositToken`.
 *
 * Reserves never cross-subsidize — each is solvent in its own currency, so FX
 * never leaks into a solvency floor (see docs/whitepaper.md §5).
 *
 * Today only the MUSD reserve is deployed (Stellar testnet); MBRL and MARS are
 * declared here as `planned` so the UI shows the full multi-currency picture.
 * When their sub-vaults deploy, fill in `contracts` and flip `status` to "live".
 */

import { config } from "./config";
import type { ModelAssumptions } from "./economics";

export type ReserveStatus = "live" | "planned";

export interface Reserve {
  id: string; // stable key, e.g. "usdc"
  currency: string; // display ticker, e.g. "MUSD" | "MBRL" | "MARS"
  name: string; // "Mutav USD Reserve"
  /** What the reserve's float is held in (underlying asset). */
  underlying: string;
  /**
   * The stablecoin token a user deposits/redeems (e.g. "USDC" for MUSD). This is
   * the underlying token ticker, NOT the vault currency — the vault is named for
   * the fiat (MUSD) while it custodies USDC. Drives the deposit/redeem UI labels.
   */
  depositToken: string;
  /** The market whose rental defaults this reserve covers. */
  market: string;
  status: ReserveStatus;
  /** Short badge override (e.g. "PoC"). Falls back to the status label. */
  tag?: string;
  /** Currency peg: underlying yield + local delinquency. Drives modeled APY. */
  assumptions: ModelAssumptions;
  /** Vault contract address — the canonical reserve ID. Present on live reserves only. */
  address?: string;
  /** Deployed contract set — present only when status === "live". */
  contracts?: { vault: string; policy: string; registry: string };
}

export const RESERVES: Reserve[] = [
  {
    id: "usdc",
    currency: "MUSD",
    name: "Mutav USD Reserve (testnet)",
    underlying: "USDC · stablecoin DeFi (DeFindex)",
    depositToken: "USDC",
    market: "Brazil · testnet PoC",
    status: "live",
    tag: "Testnet",
    // USD stablecoin yield; Brazilian (South) rental delinquency.
    assumptions: { underlyingYield: 0.055, delinquency: 0.0246 },
    address: config.contracts.vault,
    contracts: {
      vault: config.contracts.vault,
      policy: config.contracts.policy,
      registry: config.contracts.registry,
    },
  },
  {
    id: "brl",
    currency: "MBRL",
    name: "Mutav BRL Reserve",
    underlying: "BRL · tokenized Tesouro / CDI",
    depositToken: "BRL",
    market: "Brazil · 2nd PoC · pilot Q3 2026",
    status: "planned",
    tag: "PoC · Q3 2026",
    // Selic/CDI ~14%; Brazilian (South) rental delinquency.
    assumptions: { underlyingYield: 0.14, delinquency: 0.0246 },
  },
  {
    id: "ars",
    currency: "MARS",
    name: "Mutav ARS Reserve",
    underlying: "ARS · peso instrument",
    depositToken: "ARS",
    market: "Argentina · illustrative",
    status: "planned",
    tag: "Future",
    // Illustrative peso rate + higher local delinquency — placeholder pending data.
    assumptions: { underlyingYield: 0.35, delinquency: 0.06 },
  },
];

export const LIVE_RESERVES = RESERVES.filter((r) => r.status === "live");
// Invariant: PRIMARY_RESERVE must be a live reserve with `address` set — its `.address` is consumed unguarded by NavShell, homepage CTAs, and the /protocol redirect.
export const PRIMARY_RESERVE = LIVE_RESERVES[0] ?? RESERVES[0];
