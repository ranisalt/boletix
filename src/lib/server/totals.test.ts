/// <reference types="@cloudflare/vitest-plugin/types" />

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { type Bu, toSubmission, verifySubmission, TSE_ROOTS } from "../bu";
import { loadBuScan } from "../bu/testing/fixtures";
import { storeBu } from "./bu-store";
import { loadTotals } from "./totals";

const ELECTION = "br-2026-general";
const PRESIDENTE = 1;
// The fixtures are second-round BUs.

async function store(name: string): Promise<Bu> {
  const { parts, certs } = loadBuScan(name);
  const submission = toSubmission(parts, certs);
  const verified = verifySubmission(submission, TSE_ROOTS);
  await storeBu(env, submission, verified, ELECTION);
  return verified.bu;
}

/** What the totals should be, summed straight from the parsed BUs. */
function expected(bus: Bu[], cargo: number) {
  const votes = new Map<string, number>();
  let brancos = 0;
  let nulos = 0;
  for (const bu of bus)
    for (const c of bu.cargos.filter((c) => c.cargo === cargo)) {
      for (const [numero, count] of Object.entries(c.candidates))
        votes.set(`${c.idel} ${numero}`, (votes.get(`${c.idel} ${numero}`) ?? 0) + count);
      brancos += c.brancos;
      nulos += c.nulos;
    }
  const candidatos = [...votes]
    .map(([key, votos]) => {
      const [idel, numero] = key.split(" ");
      return { idel: Number(idel), numero: numero!, votos };
    })
    .sort((a, b) => b.votos - a.votos || a.numero.localeCompare(b.numero));
  return { candidatos, brancos, nulos };
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM bu_vote"),
    env.DB.prepare("DELETE FROM bu_cargo"),
    env.DB.prepare("DELETE FROM bu"),
  ]);
});

describe("loadTotals", () => {
  it("sums one cargo across every stored section of a UF", async () => {
    const df = await store("df-97012-11-178");
    await store("sp-69310-102-17");

    await expect(
      loadTotals(env.DB, { election: ELECTION, turno: 2, cargo: PRESIDENTE, uf: "DF" }),
    ).resolves.toEqual({ secoes: 1, ...expected([df], PRESIDENTE) });
  });

  it("sums the whole country when no UF is given", async () => {
    const bus = [await store("df-97012-11-178"), await store("sp-69310-102-17")];

    await expect(
      loadTotals(env.DB, { election: ELECTION, turno: 2, cargo: PRESIDENTE }),
    ).resolves.toEqual({ secoes: 2, ...expected(bus, PRESIDENTE) });
  });

  it("counts nothing for a round without BUs", async () => {
    await store("df-97012-11-178");

    await expect(
      loadTotals(env.DB, { election: ELECTION, turno: 1, cargo: PRESIDENTE }),
    ).resolves.toEqual({ secoes: 0, candidatos: [], brancos: 0, nulos: 0 });
  });
});
