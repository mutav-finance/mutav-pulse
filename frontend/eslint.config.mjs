import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Soroban contract clients (`stellar contract bindings typescript`)
    // — machine-authored, not hand-maintained source. They carry generator-emitted
    // `@ts-ignore` and class/interface declaration-merging that trip the TS rules;
    // linting them is noise we never act on. Regenerate, don't hand-edit.
    "bindings/**",
  ]),
]);

export default eslintConfig;
