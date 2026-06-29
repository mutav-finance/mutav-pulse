import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Prefer the shadcn UI primitives over hand-rolled controls. New interactive
  // controls should come from components/ui/* (themed to brand tokens) — not a
  // raw <button>/<input>. The primitives themselves are exempt. Legit exceptions
  // with no installed primitive (e.g. a checkbox/radio) take an inline
  // `eslint-disable-next-line no-restricted-syntax` with a reason.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message:
            "Use the <Button> primitive from @/components/ui/button instead of a raw <button>.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            "Use the <Input> primitive from @/components/ui/input instead of a raw <input> (checkbox/radio with no installed primitive: add an eslint-disable with a reason).",
        },
      ],
    },
  },
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
