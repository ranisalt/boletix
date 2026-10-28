/// <reference types="@cloudflare/vitest-plugin/types" />

import type { D1Migration } from "@cloudflare/vitest-plugin";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { type Bu, sealSubmission, openSubmission, TSE_ROOTS } from "../bu";
import { loadBuScan } from "../bu/testing/fixtures";
import { storeBu } from "./bu-store";
import { cachedTotals, loadTotals } from "./totals";

const ELECTION = "br-2026-general";
const PRESIDENTE = 1;
// The fixtures are second-round BUs.

function submissionFor(name: string) {
  const { parts, certs } = loadBuScan(name);
  const submission = sealSubmission(parts, certs, TSE_ROOTS).submission;
  return { submission, verified: openSubmission(submission, TSE_ROOTS) };
}

async function store(name: string): Promise<Bu> {
  const { submission, verified } = submissionFor(name);
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

const clearTotals = () =>
  env.DB.batch([
    env.DB.prepare("DELETE FROM totals_vote"),
    env.DB.prepare("DELETE FROM totals_cargo"),
  ]);

beforeEach(async () => {
  await clearTotals();
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

  it("reads the stored totals rather than summing every BU", async () => {
    await store("df-97012-11-178");
    await clearTotals();

    await expect(
      loadTotals(env.DB, { election: ELECTION, turno: 2, cargo: PRESIDENTE }),
    ).resolves.toEqual({ secoes: 0, candidatos: [], brancos: 0, nulos: 0 });
  });

  it("counts a section once however often or racily its BU arrives", async () => {
    const { submission, verified } = submissionFor("df-97012-11-178");
    await Promise.all([
      storeBu(env, submission, verified, ELECTION),
      storeBu(env, submission, verified, ELECTION),
    ]);
    await storeBu(env, submission, verified, ELECTION);
    const forged = { ...verified, hash: "F".repeat(128) };
    await storeBu(env, { ...submission, hash: forged.hash }, forged, ELECTION);

    await expect(
      loadTotals(env.DB, { election: ELECTION, turno: 2, cargo: PRESIDENTE }),
    ).resolves.toEqual({ secoes: 1, ...expected([verified.bu], PRESIDENTE) });
  });

  it("serves everyone the same totals within a 15-second window", async () => {
    const filter = { election: ELECTION, turno: 2 as const, cargo: PRESIDENTE };
    const start = Date.UTC(2026, 9, 25, 20, 0, 0);
    const df = await store("df-97012-11-178");
    const first = await cachedTotals(env.DB, filter, start);
    const sp = await store("sp-69310-102-17");

    await expect(cachedTotals(env.DB, filter, start + 14_999)).resolves.toEqual(first);
    await expect(cachedTotals(env.DB, filter, start + 15_000)).resolves.toEqual({
      secoes: 2,
      ...expected([df, sp], PRESIDENTE),
    });
  });

  it("rebuilds the stored totals from BUs stored before they existed", async () => {
    const bus = [await store("df-97012-11-178"), await store("sp-69310-102-17")];
    await clearTotals();

    const { TEST_MIGRATIONS } = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };
    const backfill = TEST_MIGRATIONS.find((m) => m.name.startsWith("0002"))!.queries.filter((q) =>
      q.includes("INSERT INTO"),
    );
    await env.DB.batch(backfill.map((q) => env.DB.prepare(q)));

    await expect(
      loadTotals(env.DB, { election: ELECTION, turno: 2, cargo: PRESIDENTE }),
    ).resolves.toEqual({ secoes: 2, ...expected(bus, PRESIDENTE) });
  });
});
