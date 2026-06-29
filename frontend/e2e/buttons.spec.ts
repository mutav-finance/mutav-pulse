import { test, expect } from "@playwright/test";
import {
  connectButton,
  gotoReserveHub,
  RPC_HOST_GLOB,
} from "./helpers";

/**
 * Button primitive (components/ui/button.tsx) — behavior + a11y parity.
 *
 * Covers: render, accessible role/name, enabled state, keyboard focusability,
 * click-invokes-action (the mobile hamburger toggling the nav menu), keyboard
 * activation (Enter/Space), navigation (nav links), and disabled-blocks-
 * interaction (the RefreshControl while its on-chain read is in flight).
 */

test.describe("Button — render, role, keyboard", () => {
  test("ConnectButton renders as an enabled, focusable button", async ({
    page,
  }) => {
    await page.goto("/");

    const connect = connectButton(page);
    await expect(connect).toBeVisible();
    await expect(connect).toBeEnabled();
    // It is a real <button> carrying the shadcn primitive's data-slot.
    await expect(connect).toHaveAttribute("data-slot", "button");

    // Keyboard-focusable (Tab order reaches it / it accepts focus).
    await connect.focus();
    await expect(connect).toBeFocused();
  });

  test("nav links navigate (click changes route)", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: /main navigation/i })
      .getByRole("link", { name: /^reserves$/i })
      .click();
    await expect(page).toHaveURL(/\/reserves$/);
    await expect(
      page.getByRole("heading", { name: /reserves directory/i }),
    ).toBeVisible();
  });
});

test.describe("Button — click invokes action (mobile hamburger)", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("hamburger toggles the nav menu on click and via keyboard", async ({
    page,
  }) => {
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /open menu/i });
    await expect(hamburger).toBeVisible();
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");

    // Click opens — aria-expanded flips and the mobile panel with links appears.
    await hamburger.click();
    const opened = page.getByRole("button", { name: /close menu/i });
    await expect(opened).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#nav-mobile-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: /^reserves$/i })).toBeVisible();

    // Keyboard activation — focus + Enter closes it again.
    await opened.focus();
    await expect(opened).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /open menu/i }),
    ).toHaveAttribute("aria-expanded", "false");

    // Space re-opens (the other half of native button keyboard semantics).
    await page.getByRole("button", { name: /open menu/i }).focus();
    await page.keyboard.press("Space");
    await expect(
      page.getByRole("button", { name: /close menu/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("Button — disabled blocks interaction", () => {
  test("RefreshControl is disabled while its on-chain read is in flight", async ({
    page,
  }) => {
    // Stall the Soroban RPC so the hub's read cycle stays in its loading state,
    // making the disabled refresh button deterministic regardless of network.
    await page.route(RPC_HOST_GLOB, async () => {
      // Never fulfill — the request hangs; the page still renders its shell.
    });

    await gotoReserveHub(page);

    const refresh = page.getByRole("button", {
      name: /refresh on-chain reserve data/i,
    });
    await expect(refresh).toBeVisible();
    // While loading the control is disabled and shows its loading label.
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveText(/loading/i);

    // A disabled button blocks interaction: a non-forced click is not actionable.
    const clickRejected = await refresh
      .click({ trial: true, timeout: 1500 })
      .then(() => false)
      .catch(() => true);
    expect(clickRejected).toBe(true);
  });
});
