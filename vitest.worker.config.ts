import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default defineConfig({
  plugins: [
    ...(viteConfig.plugins ?? []),
    cloudflareTest(async () => ({
      wrangler: { configPath: path.resolve("./wrangler.jsonc") },
      miniflare: {
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
    include: ["src/lib/server/**/*.{test,spec}.{js,ts}"],
  },
});
