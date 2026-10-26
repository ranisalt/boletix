import path from "node:path";

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

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

      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
    },
  },
  {
    // Each folder in src/lib is a module that may become its own package: other code goes
    // through its index.ts. `testing/` helpers are the exception, for specs only.
    files: ["src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(\\.\\./)+(bu|elections|scan|submission|contributions|ui|server)/(?!testing/)",
              message: "Import another module through its index.ts.",
            },
            {
              regex: "^#lib/(bu|elections|scan|submission|contributions|ui|server)/(?!index\\.js$)",
              message: "Import another module through its index.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    // The protocol and election data are framework-free so they run in browser, workerd and Node alike.
    files: ["src/lib/bu/**", "src/lib/elections/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(svelte|\\$app|\\$env|@sveltejs/)|paraglide|^(\\.\\./)+(scan|submission|contributions|ui|server)(/|$)",
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
