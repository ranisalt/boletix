import * as env from "$app/env/public";

// Shared by the browser and the Worker.
export const dsn = env.SENTRY_DSN || undefined;
export const environment = env.SENTRY_ENVIRONMENT;
export const tracesSampleRate = env.SENTRY_TRACES_SAMPLE_RATE;
export const enableLogs = true;
