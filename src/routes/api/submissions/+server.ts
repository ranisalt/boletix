import { captureMessage } from "@sentry/sveltekit";
import { env } from "cloudflare:workers";

import { handleSubmission } from "#lib/server/submit.js";

import type { RequestHandler } from "./$types";

// adapter-cloudflare 8 no longer sets `event.platform`; bindings come from `cloudflare:workers`.
export const POST: RequestHandler = ({ request, getClientAddress }) =>
  handleSubmission(request, env, {
    clientAddress: getClientAddress(),
    report: (conflict) => {
      console.warn("BU conflict", conflict);
      captureMessage("Two different signed BUs for one section", {
        level: "warning",
        extra: { ...conflict },
      });
    },
  });
