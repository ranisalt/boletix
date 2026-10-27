import { env } from "cloudflare:workers";

import { candidateName, type NameFile } from "#lib/elections/index.js";
import { loadTotals } from "#lib/server/index.js";
import { parseTotalsQuery } from "#lib/totals/index.js";

import type { PageServerLoad } from "./$types";

// Reads live data on every request; the other pages are prerendered.
export const prerender = false;

const ELECTION = "br-2026-general";

export const load: PageServerLoad = async ({ url, fetch }) => {
  const query = parseTotalsQuery(url.searchParams);
  // A state role summed across every state would add up rival candidates sharing a number.
  if (query.cargo !== 1 && !query.uf) return { query, totals: null };

  const area = query.cargo === 1 ? "BR" : query.uf!;
  const [totals, names] = await Promise.all([
    loadTotals(env.DB, { election: ELECTION, ...query }),
    fetch(`/tse/2026/${area}.json`)
      .then((response) => (response.ok ? (response.json() as Promise<NameFile>) : undefined))
      .catch(() => undefined),
  ]);
  const files = names ? [names] : [];

  return {
    query,
    totals: {
      ...totals,
      candidatos: totals.candidatos.map(({ idel, numero, votos }) => {
        const name = candidateName(files, idel, query.cargo, numero);
        return name ? { numero, nome: name[0], partido: name[1], votos } : { numero, votos };
      }),
    },
  };
};
