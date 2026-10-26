import { defineConfig } from "oxfmt";

export default defineConfig({
  associations: [{ files: ["*.svelte"], language: "svelte" }],
  // Generated or vendored: TSE references, real BU fixtures, TSE name files, Wrangler types.
  ignorePatterns: [
    "/pnpm-lock.yaml",
    "/.hermes/",
    "/photos/",
    "/docs/",
    "/fixtures/",
    "/static/tse/",
    "/worker-configuration.d.ts",
  ],
  sortImports: true,
  sortPackageJson: { sortScripts: true },
  sortTailwindcss: { stylesheet: "./src/app.css" },
  svelte: true,
});
