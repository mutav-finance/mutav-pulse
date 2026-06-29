/**
 * Central transaction-error treatment layer.
 *
 * Soroban / Stellar writes fail with cryptic, overloaded strings (bare WasmVm
 * traps, typed `Error(Type, #Code)` codes, raw RPC strings). This module is the
 * single source of truth that turns those into a `{ category, message, action }`
 * a tester can act on. `lib/format.ts` re-exports from here — `errMsg` lives here
 * so there is no circular dependency (this file imports nothing from format).
 *
 * The classifier (`treatTxError`) runs as ORDERED stages; the order is
 * load-bearing (see the comments on each stage). Call sites pass a `TxContext`
 * to disambiguate the overloaded WasmVm trap, which carries no message in the
 * diagnostic events (the panic string is never propagated by the host).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ErrorCategory =
  | "account"
  | "auth"
  | "faucet"
  | "trustline"
  | "balance"
  | "solvency"
  | "amm"
  | "deadline"
  | "storage"
  | "network"
  | "unknown";

/** Flow tag passed by call sites to disambiguate the overloaded WasmVm trap. */
export type TxContext =
  | "faucet-drip"
  | "trustline"
  | "swap"
  | "deposit"
  | "redeem-request"
  | "claim"
  | "cancel-redeem"
  | "sign-guarantee"
  | "settle"
  | "pay-fee"
  | "cover-default"
  | "cover-exit"
  | "process-redemptions"
  | "rebalance"
  | "strategy-admin"
  | "add-signer"
  | "remove-signer";

export interface TreatedError {
  /** Catalog entry id, e.g. "missing-trustline". */
  id: string;
  category: ErrorCategory;
  /** The user-facing message (catalog `userMessage`). */
  message: string;
  /** Optional next-step hint (catalog `actionHint`). */
  action?: string;
  /** Raw `errMsg(e)` — for logging / the unknown-fallback team share. */
  raw: string;
}

// ─── errMsg (moved verbatim from format.ts) ──────────────────────────────────

export function errMsg(e: unknown, fallback = "Transaction failed"): string {
  if (e instanceof Error) return e.message;
  // Soroban contracts revert with bare strings (e.g. "invalid guarantee ID"),
  // so surface those verbatim rather than the generic fallback.
  if (typeof e === "string") return e;
  return fallback;
}

// ─── Catalog (data only) ─────────────────────────────────────────────────────

interface CatalogEntry {
  category: ErrorCategory;
  message: string;
  action?: string;
}

/** The 19 catalog entries, 1:1 by id. `cause`/`affectedFlows` are runtime-irrelevant. */
const TABLE: Record<string, CatalogEntry> = {
  "account-not-found": {
    category: "account",
    message: "This wallet isn't active on Stellar yet. Fund it before doing anything else.",
    action: "Fund the address with the testnet Friendbot (needs at least 1 XLM), then retry.",
  },
  "user-rejected-in-wallet": {
    category: "auth",
    message: "You cancelled the signature, so nothing happened.",
    action: "Try again and approve the prompt in your wallet to continue.",
  },
  "faucet-cooldown": {
    category: "faucet",
    message: "You already claimed test tokens recently. The faucet has a cooldown.",
    action: "Wait for the cooldown (about 24h) before claiming again, or use an address that already has a balance.",
  },
  "missing-trustline": {
    category: "trustline",
    message: "You haven't added this token to your wallet yet, so it can't be received.",
    action: "Add the asset trustline first (the 'Add trustline' step), then retry the drip or deposit.",
  },
  "missing-allowance": {
    category: "auth",
    message: "This token spend wasn't approved first.",
    action: "Approve the token allowance before depositing, or deposit directly from your own wallet.",
  },
  "insufficient-token-balance": {
    category: "balance",
    message: "You don't have enough of this token for that amount.",
    action: "Use the faucet to top up, or enter a smaller amount.",
  },
  "insufficient-share-balance": {
    category: "balance",
    message: "You're trying to redeem more shares than you own.",
    action: "Check your share balance and request a redeem amount you actually hold.",
  },
  "vault-insufficient-liquidity": {
    category: "solvency",
    message: "The reserve can't free up enough cash for that right now.",
    action: "Try a smaller amount or try again later after a rebalance; not a wallet or balance problem.",
  },
  "solvency-gate-signguarantee": {
    category: "solvency",
    message: "The reserve doesn't have enough capital to back this guarantee.",
    action: "Add capital to the vault (deposit) or lower the guarantee amount before signing.",
  },
  "soroswap-no-liquidity": {
    category: "amm",
    message: "There's no trading pool for this pair right now.",
    action: "Pick a different token pair, or wait until liquidity is added; can't swap this route.",
  },
  "soroswap-slippage-min-out": {
    category: "amm",
    message: "The price moved and you'd get less than your minimum.",
    action: "Increase slippage tolerance or use a smaller amount, then retry the swap.",
  },
  "soroswap-deadline-expired": {
    category: "deadline",
    message: "The swap took too long and expired.",
    action: "Just retry the swap to build a fresh deadline.",
  },
  "invalid-or-disabled-call": {
    category: "unknown",
    message: "That action can't be processed as entered. Nothing was charged.",
    action: "Check the amount is above zero and the item still exists/is ready; fix inputs and retry.",
  },
  "trustline-low-reserve": {
    category: "trustline",
    message: "You need a bit more XLM to add this asset.",
    action: "Top up about 0.5 XLM (Friendbot) and try the trustline again.",
  },
  "wrong-signer-not-authorized": {
    category: "auth",
    message: "This wallet isn't allowed to do that.",
    action: "Connect the authorized account (and confirm you're on testnet), then retry.",
  },
  "network-rpc-transient": {
    category: "network",
    message: "The network was busy and your transaction didn't go through.",
    action: "Wait a moment and submit again.",
  },
  "stale-sequence-or-fee": {
    category: "network",
    message: "Your account state changed since this was prepared.",
    action: "Refresh and resubmit to rebuild with the current sequence and fee.",
  },
  "state-archived-restore": {
    category: "storage",
    message: "This contract's on-chain state expired (Soroban archives unused entries) and needs a one-time restore before it can be used.",
    action: "Ask the team to restore the contract state (stellar contract restore/extend), then retry — your wallet and balance are fine.",
  },
  "unknown-fallback": {
    category: "unknown",
    message: "Something went wrong with this transaction. Nothing was charged.",
    action: "Try again; if it keeps failing, share the details with the team.",
  },
};

// ─── Typed-code map: `${type}#${code}` → id ──────────────────────────────────

const TYPED_MAP: Record<string, string> = {
  "Contract#13": "missing-trustline",
  "Contract#9": "missing-allowance",
  "Contract#10": "insufficient-token-balance",
  "Contract#100": "insufficient-share-balance",
  "Contract#600": "vault-insufficient-liquidity",
  "Contract#507": "soroswap-slippage-min-out",
  "Contract#503": "soroswap-deadline-expired",
  "Contract#4": "wrong-signer-not-authorized",
  "Storage#MissingValue": "soroswap-no-liquidity",
};

// ─── Literal-string rules (ordered, first hit wins) ──────────────────────────

const LITERAL_RULES: Array<{ re: RegExp; id: string }> = [
  { re: /account not found/i, id: "account-not-found" },
  // Soroban state archival — the RPC sim returns a restorePreamble / the SDK
  // reports an archived/expired entry. Specific, so it precedes the generic
  // network/sendTransaction catch-alls below.
  { re: /restorePreamble|restore ?footprint|entry (is )?archived|archived entry|ExpiredEntry|has expired|needs? (to be )?restored|restoration (is )?required/i, id: "state-archived-restore" },
  { re: /User declined|rejected|denied|User closed|cancell?ed/i, id: "user-rejected-in-wallet" },
  { re: /trustline entry is missing/i, id: "missing-trustline" },
  { re: /MissingValue|get_reserves|non-existing value for contract instance|No cUSD.*liquidity available/i, id: "soroswap-no-liquidity" },
  { re: /op_low_reserve|CHANGE_TRUST_LOW_RESERVE|tx_insufficient_balance/i, id: "trustline-low-reserve" },
  { re: /Unauthorized function call|tx_bad_auth|Error\(Auth/i, id: "wrong-signer-not-authorized" },
  // MUST precede the network rule: wallet.ts throws `sendTransaction failed: {…}`
  // whose JSON blob can carry txBAD_SEQ/txINSUFFICIENT_FEE — we want the seq/fee
  // classification, not the generic network one.
  { re: /txBAD_SEQ|tx_bad_seq|txINSUFFICIENT_FEE|tx_insufficient_fee/i, id: "stale-sequence-or-fee" },
  { re: /TRY_AGAIN_LATER|transaction timed out|NOT_FOUND|sendTransaction failed|txTOO_LATE|tx_too_late|did not succeed/i, id: "network-rpc-transient" },
];

// ─── The classifier ──────────────────────────────────────────────────────────

function treated(id: string, raw: string): TreatedError {
  return { id, ...TABLE[id], raw };
}

/**
 * Classify a thrown tx error into a `TreatedError`. `ctx` disambiguates the
 * overloaded WasmVm trap (which carries no diagnostic message).
 */
export function treatTxError(e: unknown, ctx?: TxContext): TreatedError {
  const raw = errMsg(e);

  // Stage 1 — Overloaded-trap stage. MUST run before the typed-regex: a bare
  // `Error(WasmVm, InvalidAction)` would otherwise be captured by the
  // `Error(Type, #Code)` regex and mis-keyed, and `InvalidAction` is overloaded
  // between WasmVm (a trap) and Auth (unauthorized) — so split by type here.
  const isTrap =
    /UnreachableCodeReached|VM call trapped|Error\(WasmVm,\s*InvalidAction\)/i.test(raw);
  const isSolvencyTrap = /insufficient capital to cover guarantee/i.test(raw);
  if (isTrap || isSolvencyTrap) {
    if (isSolvencyTrap || ctx === "sign-guarantee") {
      return treated("solvency-gate-signguarantee", raw);
    }
    if (ctx === "faucet-drip") return treated("faucet-cooldown", raw);
    return treated("invalid-or-disabled-call", raw);
  }

  // Stage 2 — Typed-code stage. Key on `${type}#${code}`. Unmatched typed codes
  // (undecoded Contract#N, Budget, Value, …) fall through to the literal stage.
  const m = raw.match(/Error\((\w+),\s*#?(\w+)\)/);
  if (m) {
    const key = `${m[1]}#${m[2]}`;
    if (TYPED_MAP[key]) return treated(TYPED_MAP[key], raw);
    // Any Auth#* (other than the InvalidAction trap handled in Stage 1) is a
    // wrong-signer / unauthorized failure.
    if (m[1] === "Auth") return treated("wrong-signer-not-authorized", raw);
  }

  // Stage 3 — Literal-string stage (ordered, first hit wins).
  for (const { re, id } of LITERAL_RULES) {
    if (re.test(raw)) return treated(id, raw);
  }

  // Stage 4 — Fallback. Log the full diagnostic so the team gets it.
  // eslint-disable-next-line no-console
  console.error(raw);
  return treated("unknown-fallback", raw);
}

// ─── Backward-compatible wrappers ────────────────────────────────────────────

/**
 * Legacy single-string shape. Returns the treated user message, falling back to
 * `fallback` only for non-Error/non-string throwables that classify as unknown.
 */
export function friendlyTxError(e: unknown, fallback = "Transaction failed", ctx?: TxContext): string {
  const t = treatTxError(e, ctx);
  return t.id === "unknown-fallback" && !(e instanceof Error || typeof e === "string")
    ? fallback
    : t.message;
}

/** True when a faucet `drip` reverted on the contract's anti-drain cooldown. */
export function isFaucetCooldown(e: unknown): boolean {
  return treatTxError(e, "faucet-drip").id === "faucet-cooldown";
}
