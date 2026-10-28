import { defineConfig } from "oxlint";

export default defineConfig({
  // oxlint can't parse Svelte, so the app keeps eslint; oxlint covers only the published packages.
  ignorePatterns: ["/**", "!/packages/**", "**/dist/"],
  plugins: ["typescript", "unicorn", "oxc", "import", "vitest"],
  categories: { correctness: "error", suspicious: "error", perf: "warn" },
  rules: {
    "typescript/consistent-type-definitions": ["error", "type"],
    "typescript/consistent-type-imports": "error",
    "import/no-cycle": "error",
    "no-console": "error",
  },
});
