import { dev } from "$app/env";
import { defineEnvVars } from "@sveltejs/kit/env";
import * as v from "valibot";

// Static: read at build time and inlined, so the Worker needs no runtime configuration for Sentry.
const sentry = <T>(schema: v.GenericSchema<string | undefined, T>) =>
  ({ public: true, static: true, schema }) as const;

const sampleRate = (fallback: number) =>
  v.pipe(
    v.optional(v.string(), String(fallback)),
    v.transform(Number),
    v.number(),
    v.minValue(0),
    v.maxValue(1),
  );

export const variables = defineEnvVars({
  // Without a DSN the SDK sends nothing, as in local development and tests.
  SENTRY_DSN: sentry(v.optional(v.union([v.literal(""), v.pipe(v.string(), v.url())]))),
  SENTRY_ENVIRONMENT: sentry(v.optional(v.string(), dev ? "development" : "production")),

  SENTRY_TRACES_SAMPLE_RATE: sentry(sampleRate(dev ? 1 : 0.25)),
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE: sentry(sampleRate(dev ? 1 : 0.1)),
  SENTRY_REPLAYS_ERROR_SAMPLE_RATE: sentry(sampleRate(1)),
});
