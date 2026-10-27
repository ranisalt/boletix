import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
        experimental: { async: true },
      },
      adapter: adapter(),
    }),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      emitTsDeclarations: true,
    }),
  ],

  // Where a spec runs is decided by its name or folder:
  //   *.svelte.test.ts       → component (jsdom, browser builds of Svelte)
  //   src/lib/server/**      → worker (workerd with the real D1/R2 bindings)
  //   any other *.test.ts    → unit (Node; also server-side rendering)
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.svelte.test.ts", "src/lib/server/**"],
        },
      },
      {
        extends: true,
        resolve: { conditions: ["browser"] },
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["./src/test/component.setup.ts"],
          include: ["src/**/*.svelte.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: path.resolve("./wrangler.jsonc") },
            miniflare: {
              // Behind wrangler.jsonc: the pool (0.23.0) bundles an older workerd that rejects newer dates.
              compatibilityDate: "2026-08-22",
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations(path.resolve("./migrations")),
              },
            },
          })),
        ],
        test: {
          name: "worker",
          setupFiles: ["./src/test/worker.setup.ts"],
          include: ["src/lib/server/**/*.test.ts"],
        },
      },
    ],
  },
});
