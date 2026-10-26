import { mergeConfig, defineConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: "unit",
      environment: "node",
      include: [
        "src/lib/bu/**/*.{test,spec}.{js,ts}",
        "src/lib/elections/**/*.{test,spec}.{js,ts}",
        "src/lib/client/**/*.{test,spec}.{js,ts}",
      ],
    },
  }),
);
