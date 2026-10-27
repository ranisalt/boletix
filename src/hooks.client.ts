import * as env from "$app/env/public";
import * as Sentry from "@sentry/sveltekit";
import type { ClientInit } from "@sveltejs/kit/hooks";

import * as config from "./sentry.config";

export const init: ClientInit = () => {
  Sentry.init({
    ...config,

    replaysSessionSampleRate: env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: env.SENTRY_REPLAYS_ERROR_SAMPLE_RATE,

    integrations: [Sentry.consoleLoggingIntegration(), Sentry.replayIntegration()],
  });
};

export const handleError = Sentry.handleErrorWithSentry();
