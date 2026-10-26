import { captureMessage } from '@sentry/sveltekit';
import { error } from '@sveltejs/kit';
import { handleSubmission } from '#lib/server/submit.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, platform, getClientAddress }) => {
  if (!platform) error(503, 'Cloudflare bindings unavailable');
  return handleSubmission(request, platform.env, {
    clientAddress: getClientAddress(),
    report: (conflict) => {
      console.warn('BU conflict', conflict);
      captureMessage('Two different signed BUs for one section', { level: 'warning', extra: { ...conflict } });
    }
  });
};
