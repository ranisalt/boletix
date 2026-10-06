/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from 'cloudflare:test';
import { expect, it } from 'vitest';

it('executes in the configured Worker runtime with the D1 binding', async () => {
  const { results } = await env.DB.prepare('SELECT 1 AS value').all<{ value: number }>();

  expect(results[0]?.value).toBe(1);
});
