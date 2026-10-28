import { cargoScope, getElection } from "#lib/elections/index.js";
import { parseTotalsQuery, totalsArea } from "#lib/totals/index.js";

import type { PageLoad } from "./$types";

// The filters come from the query string; the other pages are prerendered.
export const prerender = false;

export const load: PageLoad = ({ url }) => {
  const query = parseTotalsQuery(url.searchParams, new Date());
  const scope = cargoScope(getElection(query.election)!, query.cargo);
  return { query, summable: Boolean(scope && totalsArea(scope, query.uf)) };
};
