/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { applyD1Migrations, env } from 'cloudflare:test';
import type { D1Migration } from '@cloudflare/vitest-pool-workers';

const { TEST_MIGRATIONS } = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };
await applyD1Migrations(env.DB, TEST_MIGRATIONS);
