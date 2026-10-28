import { getRequestEvent, query } from "$app/server";
import { error } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import * as v from "valibot";

import {
  candidateName,
  dataUrl,
  sectionTotal,
  type NameFile,
  type SectionCounts,
} from "#lib/elections/index.js";
import { cachedTotals, changes } from "#lib/server/index.js";
import { TURNOS, UFS, totalsTarget } from "#lib/totals/index.js";

/** The window `cachedTotals` shares; polls land just after each one opens. */
const POLL_MS = 15_000;

const Filter = v.object({
  election: v.string(),
  turno: v.picklist(TURNOS),
  cargo: v.number(),
  uf: v.optional(v.picklist(UFS)),
});

/** The page's totals, streamed again whenever new BUs change them. */
export const getTotals = query.live(Filter, async function* (filter) {
  const target = totalsTarget(filter);
  // The page never asks for these; only a hand-made request does.
  if (!target) error(400, "These totals can't be summed");
  const { election, area } = target;

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
    () => new Promise((resolve) => setTimeout(resolve, POLL_MS - (Date.now() % POLL_MS))),
  );
});
