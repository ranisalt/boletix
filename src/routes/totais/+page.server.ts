import { env } from "cloudflare:workers";

import {
  candidateName,
  sectionTotal,
  type NameFile,
  type SectionCounts,
} from "#lib/elections/index.js";
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
  // Static TSE files; a missing one only loses names or the coverage total.
  const json = <T>(path: string) =>
    fetch(path)
      .then((response) => (response.ok ? (response.json() as Promise<T>) : undefined))
      .catch(() => undefined);
  const [totals, names, sections] = await Promise.all([
    loadTotals(env.DB, { election: ELECTION, ...query }),
    json<NameFile>(`/tse/2026/${area}.json`),
    json<SectionCounts>("/tse/2026/secoes.json"),
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
