import { defineConfig, configDefaults } from "vitest/config";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local for tests
try {
  const envLocal = readFileSync(join(__dirname, ".env.local"), "utf-8");
  envLocal.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=");
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
} catch {
  // .env.local not found, skip
}

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests only. The Playwright end-to-end specs live in `e2e/` and run
    // via `npm run e2e` (playwright.config.ts) — exclude them so vitest doesn't
    // try to collect them as unit tests.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
