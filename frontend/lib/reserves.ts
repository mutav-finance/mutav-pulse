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
  /** Fiat symbol the reserve presents values in ("$" for MUSD, "R$" for MBRL). */
  fiatSymbol: string;
  /**
   * Indicative fiat price of ONE deposit-token unit, for display-only conversion.
   * 1 for fiat-pegged tokens (USDC≈$1); for a yield-bearing underlying like TESOURO
   * (1 TESOURO ≈ R$1.22) it carries the real price so values aren't shown 1:1.
   * Never feeds contract math — see lib/format.ts `Money`.
   */
  unitPriceFiat: number;
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

/**
 * A live reserve: deployed on-chain, so `address` and `contracts` are guaranteed
 * present. Narrowed from `Reserve` via `isLiveReserve` so consumers (NavShell,
 * homepage CTAs, /protocol redirect) can read `.address`/`.contracts` unguarded.
 */
export interface LiveReserve extends Reserve {
  address: string;
  contracts: { vault: string; policy: string; registry: string };
}

/** Type guard: true when a reserve carries its deployed address + contract set. */
function isLiveReserve(r: Reserve): r is LiveReserve {
  return r.status === "live" && r.address !== undefined && r.contracts !== undefined;
}

export const RESERVES: Reserve[] = [
  {
    id: "usdc",
    currency: "MUSD",
    name: "Mutav USD Reserve",
    underlying: "USDC · stablecoin DeFi (DeFindex)",
    depositToken: "USDC",
    fiatSymbol: "$",
    unitPriceFiat: 1, // USDC ≈ $1
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
    underlying: "TESOURO · tokenized Brazilian treasury (Etherfuse)",
    depositToken: "TESOURO",
    fiatSymbol: "R$",
    // TESOURO is yield-bearing → not 1:1 with BRL; indicative price (env-overridable).
    unitPriceFiat: config.tesouro.priceBrl,
    market: "Brazil · testnet PoC",
    status: "live",
    tag: "Testnet",
    // Selic/CDI ~14%; Brazilian (South) rental delinquency.
    assumptions: { underlyingYield: 0.14, delinquency: 0.0246 },
    address: "CD6DLQKZ56DATLWPYBF32CYNRADBL722ZRWLBMTQJ23FLPDFKHK2VAHA",
    contracts: {
      vault: "CD6DLQKZ56DATLWPYBF32CYNRADBL722ZRWLBMTQJ23FLPDFKHK2VAHA",
      policy: "CCFG7UYGVAC4IXU2NNHKIPUUN4CUQKLLXIRAGMXCVFK2WP6TFXNZRXRR",
      registry: "CBMNQIOSAM5IDXFD4Y3N6U7XS57OMNBLPRKBMJLBBLMFNEWN7L3UQ4AA",
    },
  },
  {
    id: "ars",
    currency: "MARS",
    name: "Mutav ARS Reserve",
    underlying: "ARS · peso instrument",
    depositToken: "ARS",
    fiatSymbol: "AR$",
    unitPriceFiat: 1, // peso-pegged placeholder
    market: "Argentina · illustrative",
    status: "planned",
    tag: "Future",
    // Illustrative peso rate + higher local delinquency — placeholder pending data.
    assumptions: { underlyingYield: 0.35, delinquency: 0.06 },
  },
];

export const LIVE_RESERVES: LiveReserve[] = RESERVES.filter(isLiveReserve);

// Invariant: at least one live reserve with `address`/`contracts` set must exist —
// PRIMARY_RESERVE.address is consumed unguarded by NavShell, homepage CTAs, and the
// /protocol redirect. The guard above narrows the element to LiveReserve; this
// module-load assertion makes the non-null guarantee explicit (and removes the need
// for a `!` at every call site).
const _primary = LIVE_RESERVES[0];
if (!_primary) {
  throw new Error("reserves: no live reserve configured — PRIMARY_RESERVE is required");
}
export const PRIMARY_RESERVE: LiveReserve = _primary;
