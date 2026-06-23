import { defineConfig } from "vitest/config";
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
  },
});
