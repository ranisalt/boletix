import { mergeConfig, defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: { conditions: ['browser'] },
    test: {
      name: 'component',
      environment: 'jsdom',
      setupFiles: ['./src/test/component.setup.ts'],
      include: ['src/lib/components/**/*.{test,spec}.{js,ts}']
    }
  })
);
