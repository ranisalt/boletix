import { env } from "cloudflare:workers";

import {
  candidateName,
  cargoScope,
  dataUrl,
  getElection,
  sectionTotal,
  type NameFile,
  type SectionCounts,
} from "#lib/elections/index.js";
import { loadTotals } from "#lib/server/index.js";
import { parseTotalsQuery, totalsArea } from "#lib/totals/index.js";

import type { PageServerLoad } from "./$types";

// Reads live data on every request; the other pages are prerendered.
export const prerender = false;

export const load: PageServerLoad = async ({ url, fetch }) => {
  const query = parseTotalsQuery(url.searchParams, new Date());
  const election = getElection(query.election)!;
  const scope = cargoScope(election, query.cargo);
  const area = scope && totalsArea(scope, query.uf);
  if (!area) return { query, totals: null };

  // Static TSE files; a missing one only loses names or the coverage total.
  const json = <T>(path: string) =>
    fetch(path)
      .then((response) => (response.ok ? (response.json() as Promise<T>) : undefined))
      .catch(() => undefined);
  const [totals, names, sections] = await Promise.all([
    loadTotals(env.DB, query),
    json<NameFile>(dataUrl(election, area)),
    json<SectionCounts>(dataUrl(election, "secoes")),
  ]);
  const files = names ? [names] : [];

  return {
    query,
    totals: {
      ...totals,
      secoesTotal: sections && sectionTotal(sections, query.turno, query.uf),
      candidatos: totals.candidatos.map(({ idel, numero, votos }) => {
        const name = candidateName(files, idel, query.cargo, numero);
        return name ? { numero, nome: name[0], partido: name[1], votos } : { numero, votos };
      }),
    },
  };
};
