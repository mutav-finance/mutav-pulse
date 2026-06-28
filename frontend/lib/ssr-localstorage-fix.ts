/**
 * lib/ssr-localstorage-fix.ts — server-only Web Storage neutralizer.
 *
 * Node 25 exposes a half-initialized `globalThis.localStorage`: it is a real
 * object (truthy) but its methods are absent unless the process was started
 * with `--localstorage-file <path>` (it also emits a warning to that effect).
 *
 * The Stellar Wallets Kit feature-detects storage with `localStorage?.getItem(...)`
 * at module-eval time (node_modules/@creit.tech/stellar-wallets-kit/esm/state/
 * values.js). Optional chaining only guards null/undefined — Node 25's truthy
 * stub slips through, so `getItem` resolves to `undefined` and the call throws
 * `localstorage?.getItem is not a function`, crashing SSR.
 *
 * On the server we drop the broken stub so the kit's optional chaining short-
 * circuits cleanly (the kit is browser-only; nothing on the server needs it).
 * The browser keeps its real localStorage untouched. This module MUST be the
 * first import in lib/wallet.ts so it runs before the kit module is evaluated.
 */
if (typeof window === "undefined") {
  const g = globalThis as { localStorage?: unknown };
  const ls = g.localStorage as { getItem?: unknown } | undefined;
  if (ls && typeof ls.getItem !== "function") {
    g.localStorage = undefined;
  }
}

export {};
