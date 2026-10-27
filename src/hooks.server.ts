// The Workers build of @sentry/sveltekit doesn't re-export this, despite its types.
import { consoleLoggingIntegration } from "@sentry/cloudflare";
import * as Sentry from "@sentry/sveltekit";
import { type Handle, sequence } from "@sveltejs/kit/hooks";

import { getTextDirection } from "#lib/paraglide/runtime.js";
import { paraglideMiddleware } from "#lib/paraglide/server.js";

import * as config from "./sentry.config";

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    return resolve(
      { ...event, request },
      {
        transformPageChunk: ({ html }) =>
          html
            .replace("%paraglide.lang%", locale)
            .replace("%paraglide.dir%", getTextDirection(locale)),
      },
    );
  });

export const handleError = Sentry.handleErrorWithSentry();

// On Workers there is no long-lived process to init Sentry in: the Cloudflare handle inits it per
// request and must come before sentryHandle().
export const handle = sequence(
  Sentry.initCloudflareSentryHandle({
    ...config,
    integrations: [consoleLoggingIntegration()],
  }),
  Sentry.sentryHandle(),
  handleParaglide,
);
