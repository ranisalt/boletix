import path from "node:path";

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const APP_MODULES = "scan|submission|contributions|ui|server";
// Any spelling that reaches into src/lib: relative (`../`, `../../lib/`), `$lib/` or `#lib/`.
const MODULE_PREFIX = "^(?:(?:\\.\\./)+(?:lib/)?|\\$lib/|#lib/)";
const MODULE_BOUNDARY = {
  regex: `${MODULE_PREFIX}(bu|elections|${APP_MODULES})/(?!testing/|index(?:\\.[jt]s)?$)`,
  message: "Import another module through its index.ts.",
};

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  { ignores: [".hermes/", "worker-configuration.d.ts"] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  // oxfmt owns formatting; turn off the stylistic rules it would fight with.
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "prefer-const": ["error", { destructuring: "all" }],
      // `const { omitted, ...rest } = value` is how we drop a key.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
    },
  },
  {
    // Each folder in src/lib is a module that may become its own package: other code goes
    // through its index.ts. `testing/` helpers are the exception, for specs only.
    files: ["src/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [MODULE_BOUNDARY] }] },
  },
  {
    // The protocol and election data are framework-free so they run in browser, workerd and Node alike.
    // Flat config replaces rule options per block, so the boundary pattern is repeated here.
    files: ["src/lib/bu/**", "src/lib/elections/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            MODULE_BOUNDARY,
            {
              regex: `^(svelte|\\$app|\\$env|@sveltejs/)|paraglide|${MODULE_PREFIX}(${APP_MODULES})(/|$)`,
              message: "bu/ and elections/ must not depend on Svelte, i18n or app modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
      },
    },
  },
);
