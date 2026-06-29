import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Shared helpers for the mutav-pulse primitive parity/behavior e2e tests.
 *
 * The app gates its interactive forms and stateful Tabs behind a CONNECTED
 * Stellar wallet (no test wallet is available in CI/sandbox), so a number of
 * assertions are presence-gated: they run their full behavior checks only when
 * the connected UI is actually rendered, and otherwise verify the disconnected
 * gate or skip with a clear reason. See each spec for which path applies.
 */

/** Host of the Soroban RPC the client reads from (see .env.example RPC_URL). */
export const RPC_HOST_GLOB = "**soroban-testnet.stellar.org**";

/**
 * Resolve the path to a live reserve hub (`/earn/<vault>`) by reading the first
 * live "view" link off the /reserves directory — resilient to address changes.
 */
export async function reserveHubPath(page: Page): Promise<string> {
  await page.goto("/reserves");
  const viewLink = page.locator('a[href^="/earn/"]').first();
  await expect(viewLink).toBeAttached({ timeout: 15_000 });
  const href = await viewLink.getAttribute("href");
  if (!href) throw new Error("no live reserve hub link found on /reserves");
  return href;
}

/** Navigate to the live reserve hub and wait for its header to render. */
export async function gotoReserveHub(page: Page): Promise<string> {
  const path = await reserveHubPath(page);
  await page.goto(path);
  // The reserve header renders independent of any on-chain read.
  await expect(
    page.getByRole("heading", { name: /reserve$/i }).first(),
  ).toBeVisible({ timeout: 20_000 });
  return path;
}

/** True when a wallet appears connected (the Disconnect control is present). */
export async function isWalletConnected(page: Page): Promise<boolean> {
  return page
    .getByRole("button", { name: /disconnect wallet/i })
    .isVisible()
    .catch(() => false);
}

/** The nav-bar Connect button (disconnected state). */
export function connectButton(page: Page): Locator {
  return page.getByRole("button", { name: /connect stellar wallet/i }).first();
}
