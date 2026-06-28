import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Playwright config for the mutav-pulse frontend.
 *
 * These are BEHAVIOR/a11y parity tests for the shadcn-on-MUTAV-tokens primitive
 * migration (Button / Input / Label / Tabs / Tooltip). They assert role/keyboard/
 * ARIA semantics, not pixels.
 *
 * The dev server (`next dev`) reads required `NEXT_PUBLIC_*` config via
 * `requireEnv` (see lib/config.ts) and throws at module-eval if any is missing.
 * Only `.env.example` is committed (no `.env.local`), so we parse it here and
 * inject the values into the webServer's environment — no file is created.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

/** Parse a dotenv-style file. Splits on the first `=` so values that contain
 * `=`, `;` or spaces (e.g. the Stellar network passphrase) survive intact. */
function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

const exampleEnv = parseEnvFile(resolve(__dirname, ".env.example"));

export default defineConfig({
  testDir: "./e2e",
  // Generous timeout: pages do live on-chain reads that may be slow or blocked.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Reads from Stellar testnet can dangle; don't let a hung XHR fail navigation.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ...exampleEnv,
    } as Record<string, string>,
  },
});
