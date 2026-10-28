import { getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import * as v from "valibot";

import {
  candidateName,
  cargoScope,
  dataUrl,
  getElection,
  sectionTotal,
  type NameFile,
  type SectionCounts,
} from "#lib/elections/index.js";
import { cachedTotals, changes } from "#lib/server/index.js";
import { TURNOS, UFS, totalsArea } from "#lib/totals/index.js";

/** Matches the window `cachedTotals` shares, so each poll can bring new totals. */
const POLL_MS = 15_000;

const Filter = v.object({
  election: v.string(),
  turno: v.picklist(TURNOS),
  cargo: v.number(),
  uf: v.optional(v.picklist(UFS)),
});

/** The page's totals, streamed again whenever new BUs change them. */
export const getTotals = query.live(Filter, async function* (filter) {
  const election = getElection(filter.election);
  const scope = election && cargoScope(election, filter.cargo);
  const area = scope && totalsArea(scope, filter.uf);
  if (!area) error(400, "These totals can't be summed");

  // Static TSE files, read once per stream; a missing one only loses names or the coverage total.
  const { fetch } = getRequestEvent();
  const json = <T>(path: string) =>
    fetch(path)
      .then((response) => (response.ok ? (response.json() as Promise<T>) : undefined))
      .catch(() => undefined);
  const [names, sections] = await Promise.all([
    json<NameFile>(dataUrl(election, area)),
    json<SectionCounts>(dataUrl(election, "secoes")),
  ]);
  const files = names ? [names] : [];
  const secoesTotal = sections && sectionTotal(sections, filter.turno, filter.uf);

  yield* changes(
    async () => {
      const totals = await cachedTotals(env.DB, filter);
      return {
        ...totals,
        secoesTotal,
        candidatos: totals.candidatos.map(({ idel, numero, votos }) => {
          const name = candidateName(files, idel, filter.cargo, numero);
          return name ? { numero, nome: name[0], partido: name[1], votos } : { numero, votos };
        }),
      };
    },
    () => new Promise((resolve) => setTimeout(resolve, POLL_MS)),
  );
});
