/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { type BuCargo, toSubmission, verifySubmission, type BuSubmission, TSE_ROOTS } from "../bu";
import { loadBuScan } from "../bu/testing/fixtures";
import { storeBu } from "./bu-store";

const ELECTION = "br-2026-general";

function submissionFor(name: string): BuSubmission {
  const { parts, certs } = loadBuScan(name);
  return toSubmission(parts, certs);
}

async function store(submission: BuSubmission) {
  return storeBu(env, submission, verifySubmission(submission, TSE_ROOTS), ELECTION);
}

async function originalKeys(): Promise<string[]> {
  return (await env.ORIGINALS.list()).objects.map((object) => object.key);
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM bu_vote"),
    env.DB.prepare("DELETE FROM bu_cargo"),
    env.DB.prepare("DELETE FROM bu"),
  ]);
  const keys = await originalKeys();
  if (keys.length > 0) await env.ORIGINALS.delete(keys);
});

describe("storeBu", () => {
  it("stores the section, its per-cargo totals and every vote", async () => {
    const submission = submissionFor("df-97012-11-178");
    const { bu, hash } = verifySubmission(submission, TSE_ROOTS);

    await expect(store(submission)).resolves.toEqual({ status: "new", hash });

    const row = await env.DB.prepare("SELECT * FROM bu").first();
    expect(row).toMatchObject({
      election_id: ELECTION,
      plei: bu.header.plei,
      turno: bu.header.turno,
      uf: bu.header.uf,
      municipio: bu.header.municipio,
      zona: bu.header.zona,
      secao: bu.header.secao,
      urna: bu.header.urna,
      hash,
    });

    const cargos = await env.DB.prepare(
      "SELECT idel, cargo, nominais, legenda, brancos, nulos FROM bu_cargo ORDER BY idel, cargo",
    ).all();
    expect(cargos.results).toEqual(
      bu.cargos
        .map(({ idel, cargo, nominais, legenda, brancos, nulos }) => ({
          idel,
          cargo,
          nominais,
          legenda,
          brancos,
          nulos,
        }))
        .sort((a, b) => a.idel - b.idel || a.cargo - b.cargo),
    );

    // Every nominal and party vote is stored: per cargo they add up to the BU's own totals.
    const sums = await env.DB.prepare(
      `SELECT c.cargo, c.idel, c.nominais, c.legenda,
              COALESCE(SUM(v.votes) FILTER (WHERE v.kind = 'nominal'), 0) AS nominal_votes,
              COALESCE(SUM(v.votes) FILTER (WHERE v.kind = 'legenda'), 0) AS legenda_votes
         FROM bu_cargo c LEFT JOIN bu_vote v USING (bu_id, idel, cargo)
        GROUP BY c.bu_id, c.idel, c.cargo`,
    ).all<{ nominais: number; legenda: number; nominal_votes: number; legenda_votes: number }>();
    expect(sums.results.length).toBe(bu.cargos.length);
    for (const sum of sums.results) {
      expect(sum.nominal_votes).toBe(sum.nominais);
      expect(sum.legenda_votes).toBe(sum.legenda);
    }
  });

  it("keeps the submitted original as a file", async () => {
    const submission = submissionFor("df-97012-11-178");
    await store(submission);

    const { original_key: key } = (await env.DB.prepare("SELECT original_key FROM bu").first<{
      original_key: string;
    }>())!;
    expect(await originalKeys()).toEqual([key]);
    await expect(env.ORIGINALS.get(key).then((object) => object?.json())).resolves.toEqual(
      submission,
    );
  });

  it("stores the nominal and party votes of a proportional cargo", async () => {
    // No real fixture has a proportional cargo yet, so inject one past verification.
    const submission = submissionFor("zz-29386-1-1709");
    const verified = verifySubmission(submission, TSE_ROOTS);
    const proportional: BuCargo = {
      ...verified.bu.cargos[0]!,
      cargo: 6,
      tipo: 1,
      candidates: {},
      parties: [
        { party: 13, candidates: { "1301": 4, "1302": 1 }, legenda: 2, total: 7 },
        { party: 22, candidates: { "2201": 3 }, legenda: 0, total: 3 },
      ],
    };
    await storeBu(
      env,
      submission,
      { ...verified, bu: { ...verified.bu, cargos: [proportional] } },
      ELECTION,
    );

    const votes = await env.DB.prepare(
      "SELECT kind, code, votes FROM bu_vote WHERE cargo = 6 ORDER BY kind, code",
    ).all();
    expect(votes.results).toEqual([
      { kind: "legenda", code: "13", votes: 2 },
      { kind: "nominal", code: "1301", votes: 4 },
      { kind: "nominal", code: "1302", votes: 1 },
      { kind: "nominal", code: "2201", votes: 3 },
    ]);
  });

  it("discards a resubmission of the same BU", async () => {
    const submission = submissionFor("zz-29386-1-1709");
    const first = await store(submission);

    await expect(store(submission)).resolves.toEqual({ status: "duplicate", hash: first.hash });
    await expect(env.DB.prepare("SELECT COUNT(*) AS n FROM bu").first("n")).resolves.toBe(1);
    expect(await originalKeys()).toHaveLength(1);
  });

  it("keeps the first BU when the same section arrives with different content", async () => {
    const submission = submissionFor("zz-29386-1-1709");
    const verified = verifySubmission(submission, TSE_ROOTS);
    await storeBu(env, submission, verified, ELECTION);

    // Impossible with genuine urna output, so simulate it past verification.
    const forged = { ...verified, hash: "F".repeat(128) };
    await expect(
      storeBu(env, { ...submission, hash: forged.hash }, forged, ELECTION),
    ).resolves.toEqual({
      status: "conflict",
      hash: forged.hash,
      existingHash: verified.hash,
    });

    await expect(
      env.DB.prepare("SELECT hash FROM bu")
        .all()
        .then((r) => r.results),
    ).resolves.toEqual([{ hash: verified.hash }]);
    // The conflicting original is kept as evidence, next to the accepted one.
    expect(await originalKeys()).toHaveLength(2);
  });

  it("stores a BU once when two copies race", async () => {
    const submission = submissionFor("zz-29386-1-1709");
    const outcomes = await Promise.all([store(submission), store(submission)]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(["duplicate", "new"]);
    await expect(env.DB.prepare("SELECT COUNT(*) AS n FROM bu").first("n")).resolves.toBe(1);
  });
});
