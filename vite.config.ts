import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sentrySvelteKit } from "@sentry/sveltekit/vite";
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
      csp: {
        directives: {
          "default-src": ["self"],
          // zxing-wasm compiles its QR decoder at runtime.
          "script-src": ["self", "wasm-unsafe-eval"],
          "style-src": ["self", "unsafe-inline"],
          "img-src": ["self", "data:"],
          "connect-src": ["self", "https://*.sentry.io"],
          // Sentry Replay compresses recordings in a blob worker.
          "worker-src": ["self", "blob:"],
          "frame-ancestors": ["none"],
          "base-uri": ["self"],
          "form-action": ["self"],
        },
      },
    }),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      emitTsDeclarations: true,
    }),
    // Uploads source maps to Sentry (needs SENTRY_ORG and SENTRY_PROJECT too). Without a token the
    // maps would be left in the public assets, so the plugin stays off.
    process.env.SENTRY_AUTH_TOKEN && !process.env.VITEST
      ? sentrySvelteKit({
          telemetry: false,
          sourcemaps: { filesToDeleteAfterUpload: [".svelte-kit/cloudflare/**/*.map"] },
        })
      : null,
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
