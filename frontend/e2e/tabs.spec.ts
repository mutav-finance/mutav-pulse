import { test, expect } from "@playwright/test";
import { gotoReserveHub, isWalletConnected } from "./helpers";

/**
 * Tabs primitive (components/ui/tabs.tsx) — Radix roving-tabindex behavior — and
 * the DELIBERATE EXCLUSION guard for ReserveTransparency's scroll-spy SubNav.
 *
 * The two stateful Tabs widgets (InvestCard invest/withdraw/fund and the
 * protocol cockpit section tabs) only render once a wallet is connected, so the
 * full Radix behavior assertions are presence-gated. The SubNav guard, by
 * contrast, is reachable without a wallet and must ALWAYS hold: it is anchor
 * navigation (deep-linkable `#overview`…), NOT a Tabs widget.
 */

test.describe("SubNav — stays anchor navigation, not Tabs (deliberate exclusion)", () => {
  test("reserve-section nav uses in-page anchor links, no tab roles", async ({
    page,
  }) => {
    await gotoReserveHub(page);

    const subnav = page.getByRole("navigation", { name: /reserve sections/i });
    await expect(subnav).toBeVisible();

    // Each entry is a link with an in-page hash href — NOT a role=tab.
    for (const id of ["overview", "policy", "strategy", "contracts"]) {
      const link = subnav.locator(`a[href="#${id}"]`);
      await expect(link).toHaveCount(1);
    }
    await expect(subnav.getByRole("tab")).toHaveCount(0);
    await expect(subnav.getByRole("link")).toHaveCount(4);

    // Clicking an anchor deep-links via the URL hash (scroll-spy nav behavior),
    // which a Radix Tabs widget would not do.
    await subnav.locator('a[href="#policy"]').click();
    await expect(page).toHaveURL(/#policy$/);
  });
});

test.describe("Tabs — Radix roving tabindex (presence-gated on wallet)", () => {
  test("InvestCard tabs switch panels and arrow-key navigate", async ({
    page,
  }) => {
    await gotoReserveHub(page);

    const tabs = page.getByRole("tab");
    test.skip(
      (await tabs.count()) === 0,
      "Tabs require a connected wallet — not available in this environment",
    );

    const tablist = page.getByRole("tablist").first();
    const allTabs = tablist.getByRole("tab");
    const first = allTabs.nth(0);
    const second = allTabs.nth(1);

    // role=tab + a single selected tab + a matching tabpanel.
    await first.click();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(second).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("tabpanel")).toBeVisible();

    // Clicking the second tab switches the active panel.
    await second.click();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("aria-selected", "false");

    // ArrowLeft/ArrowRight move selection (Radix roving tabindex, automatic
    // activation). Focus the active tab first, then drive with the keyboard.
    await second.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Tabs — protocol cockpit sections (presence-gated on wallet)", () => {
  test("cockpit section tabs expose tablist/tab/tabpanel roles", async ({
    page,
  }) => {
    // The cockpit forms + section tabs render only when a wallet is connected.
    await page.goto("/reserves");
    const hubHref = await page
      .locator('a[href^="/earn/"]')
      .first()
      .getAttribute("href");
    const vault = hubHref?.replace("/earn/", "") ?? "";
    test.skip(!vault, "no live reserve resolved");
    await page.goto(`/protocol/${vault}`);

    const connected = await isWalletConnected(page);
    test.skip(
      !connected,
      "Cockpit section tabs require a connected admin/non-admin wallet",
    );

    const tablist = page.getByRole("tablist", { name: /cockpit sections/i });
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole("tab");
    expect(await tabs.count()).toBeGreaterThan(1);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toBeVisible();
  });
});
