/**
 * Styling guardrails — fail the build if globals.css reintroduces either of the
 * two footguns that bit the shadcn-primitive migration. `tsc`/`next build` cannot
 * catch these (they're CSS-cascade/sizing issues), so we assert on the source.
 *
 * See frontend/AGENTS.md → "Styling conventions" for the why.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
// Strip block comments first, so the doc-notes that *mention* these footguns
// (e.g. "--spacing-10: 80px") don't trip the regex checks.
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("globals.css styling guardrails", () => {
  it("does not redefine Tailwind's numeric spacing scale (--spacing-<n>)", () => {
    // A custom 8px-grid override (e.g. `--spacing-10: 80px`) makes the shadcn
    // primitives' `h-10` resolve to 80px and blows up every button/input/tab.
    // Keep Tailwind v4's default 0.25rem multiplier (`h-10` = 40px).
    const overrides = stripped.match(/--spacing-\d+\s*:/g);
    expect(overrides, `spacing override(s) found: ${overrides?.join(", ")}`).toBeNull();
  });

  it("@theme inline never redefines/shadows --color-accent or --color-border", () => {
    // shadcn utilities must only REFERENCE brand tokens on the RHS
    // (`--color-primary: var(--color-accent)`); a left-hand `--color-accent:` here
    // would clobber amber, which hundreds of inline var(--color-accent) calls read.
    const block = stripped.match(/@theme\s+inline\s*\{([\s\S]*?)\}/);
    expect(block, "no `@theme inline` block found").not.toBeNull();
    const body = block![1];
    expect(/--color-accent\s*:/.test(body), "--color-accent redefined in @theme inline").toBe(false);
    expect(/--color-border\s*:/.test(body), "--color-border redefined in @theme inline").toBe(false);
  });

  it("keeps amber #E8A020 as the brand accent (dark fronts)", () => {
    expect(stripped).toMatch(/--color-accent:\s*#E8A020/);
  });
});
