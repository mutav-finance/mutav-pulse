import { test, expect, type Page } from "@playwright/test";

/**
 * Input + Label primitives (components/ui/input.tsx, label.tsx) via the admin
 * FormField — behavior + a11y parity.
 *
 * The /admin signer forms always render (the inputs are merely DISABLED until a
 * signer wallet connects), so label association, aria-describedby wiring, the
 * numeric spinbutton role, and disabled-blocks-interaction are all testable
 * without a wallet. The interactive checks (typing updates value, clicking a
 * label focuses its input) need an ENABLED input and are presence-gated.
 */

async function gotoAdmin(page: Page) {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: /admin · multisig/i }),
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("Input + Label — association & ARIA (no wallet needed)", () => {
  test("label is associated with its input (htmlFor/id) and is the shadcn primitive", async ({
    page,
  }) => {
    await gotoAdmin(page);

    // getByLabel resolves only through a real <label for>/id association.
    const signerInput = page.getByLabel(/signer public key/i);
    await expect(signerInput).toBeAttached();
    await expect(signerInput).toHaveAttribute("data-slot", "input");
    await expect(signerInput).toHaveAttribute("id", "new-signer");

    // The Label rendered by the primitive carries its data-slot too.
    const label = page.locator('label[for="new-signer"]');
    await expect(label).toHaveAttribute("data-slot", "label");
  });

  test("hint text is wired via aria-describedby", async ({ page }) => {
    await gotoAdmin(page);

    const signerInput = page.getByLabel(/signer public key/i);
    const describedBy = await signerInput.getAttribute("aria-describedby");
    expect(describedBy).toBe("new-signer-hint");
    await expect(page.locator(`#${describedBy}`)).toContainText(
      /stellar public key/i,
    );
  });

  test("numeric field exposes the spinbutton role and mono styling", async ({
    page,
  }) => {
    await gotoAdmin(page);

    // A type=number input is a spinbutton; the primitive adds the mono/tabular
    // data face for numeric fields.
    const weight = page.getByRole("spinbutton", { name: /weight/i });
    await expect(weight).toBeAttached();
    await expect(weight).toHaveClass(/font-mono/);
  });

  test("disabled input blocks interaction (no signer wallet)", async ({
    page,
  }) => {
    await gotoAdmin(page);

    const signerInput = page.getByLabel(/signer public key/i);
    await expect(signerInput).toBeDisabled();

    // A disabled input is not editable — fill waits for editability and times out.
    const fillRejected = await signerInput
      .fill("GABC", { timeout: 1500 })
      .then(() => false)
      .catch(() => true);
    expect(fillRejected).toBe(true);
  });
});

test.describe("Input — interactive (presence-gated on an enabled input)", () => {
  test("typing updates the value and clicking the label focuses the input", async ({
    page,
  }) => {
    await gotoAdmin(page);

    // Find any enabled text input on the page (present only with a signer wallet).
    const enabled = page.locator(
      'input[data-slot="input"]:not([disabled])',
    );
    test.skip(
      (await enabled.count()) === 0,
      "No enabled input available without a connected signer wallet",
    );

    const input = enabled.first();
    const id = await input.getAttribute("id");

    // Typing updates the controlled value.
    await input.fill("");
    await input.type("hello-123");
    await expect(input).toHaveValue("hello-123");

    // Clicking the associated label focuses the input.
    if (id) {
      await page.locator(`label[for="${id}"]`).click();
      await expect(input).toBeFocused();
    }
  });
});
