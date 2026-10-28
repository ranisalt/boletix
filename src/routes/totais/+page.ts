import { parseTotalsQuery, totalsTarget } from "#lib/totals/index.js";

import type { PageLoad } from "./$types";

// The filters come from the query string; the other pages are prerendered.
export const prerender = false;

export const load: PageLoad = ({ url }) => {
  const query = parseTotalsQuery(url.searchParams, new Date());
  return { query, summable: Boolean(totalsTarget(query)) };
};
