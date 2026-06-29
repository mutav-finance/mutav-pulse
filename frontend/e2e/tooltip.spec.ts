import { test, expect } from "@playwright/test";
import { gotoReserveHub } from "./helpers";

/**
 * Tooltip primitive (components/ui/tooltip.tsx) via InfoTooltip — behavior + a11y.
 *
 * The reserve hub renders InfoTooltip triggers that need no wallet: the
 * "Guarantee registry" note in the Policy section, plus MetricCard tooltips.
 * Radix Tooltip gives us: focus/hover opens, Escape closes, role=tooltip on the
 * content, and aria-describedby wiring the trigger to that content.
 */

const REGISTRY_TRIGGER = "Guarantee registry";

test.describe("Tooltip — open/close + ARIA", () => {
  test("focus opens the tooltip, wires aria-describedby, Escape closes", async ({
    page,
  }) => {
    await gotoReserveHub(page);

    const trigger = page.getByLabel(REGISTRY_TRIGGER, { exact: true });
    await trigger.scrollIntoViewIfNeeded();
    await expect(trigger).toBeVisible();

    // Closed: no aria-describedby yet.
    await expect(trigger).not.toHaveAttribute("aria-describedby", /.+/);

    // Focus opens. Radix Tooltip only opens on focus when :focus-visible matches
    // (keyboard modality), so reach the trigger via a real keyboard Tab: seed
    // focus on it, step away (Shift+Tab) and Tab back so Chromium marks it
    // :focus-visible. The content then renders with role=tooltip.
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    const tip = page.getByRole("tooltip");
    await expect(tip.first()).toBeVisible();
    await expect(tip.first()).toContainText(/registry contract/i);

    // aria-describedby on the trigger references the open content's id.
    const describedBy = await trigger.getAttribute("aria-describedby");
    expect(describedBy, "trigger should be aria-describedby the tooltip").toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toBeVisible();

    // Escape closes it and clears the association.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute("aria-describedby", /.+/);
  });

  test("hover opens the tooltip", async ({ page }) => {
    await gotoReserveHub(page);

    const trigger = page.getByLabel(REGISTRY_TRIGGER, { exact: true });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover();

    await expect(page.getByRole("tooltip").first()).toBeVisible();
    await expect(page.getByRole("tooltip").first()).toContainText(
      /active guarantees/i,
    );
  });
});
