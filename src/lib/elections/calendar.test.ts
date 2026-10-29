import { describe, expect, it } from "vitest";

import {
  cargoScope,
  dataUrl,
  ELECTIONS,
  findElection,
  getElection,
  latestPleito,
} from "./calendar";

it("finds the 2026 general election only for a registered pleito and turno", () => {
  expect(findElection(1219, 3220, 1)?.id).toBe("br-2026-general");
  expect(findElection(1219, 3221, 2)?.id).toBe("br-2026-general");
  expect(findElection(1219, 3220, 2)).toBeUndefined();
  expect(findElection(1219, 3221, 1)).toBeUndefined();
  expect(findElection(1219, 9999, 1)).toBeUndefined();
  expect(findElection(9999, 3220, 1)).toBeUndefined();
});

it("serves each election's TSE data from its own year", () => {
  const election = getElection("br-2026-general")!;
  expect(dataUrl(election, "SP")).toBe("/tse/2026/SP.json");
  expect(dataUrl({ ...election, year: 2028 }, "secoes")).toBe("/tse/2028/secoes.json");
});

it("tells where each cargo is contested", () => {
  const election = getElection("br-2026-general")!;
  expect(cargoScope(election, 1)).toBe("pais");
  expect(cargoScope(election, 3)).toBe("uf");
  expect(cargoScope(election, 11)).toBeUndefined();
});

it("lists elections newest first", () => {
  const firstDates = ELECTIONS.map((election) => election.pleitos[0]!.date);
  expect(firstDates).toEqual([...firstDates].sort().reverse());
});

describe("latestPleito", () => {
  const at = (iso: string) => latestPleito(new Date(iso));

  it("counts days in Brasília time, where elections are scheduled", () => {
    expect(at("2026-10-25T01:00:00Z")).toEqual({ election: "br-2026-general", turno: 1 });
    expect(at("2026-10-25T03:00:00Z")).toEqual({ election: "br-2026-general", turno: 2 });
  });

  it("picks the most recent round already held", () => {
    expect(at("2026-10-04T12:00:00Z")).toEqual({ election: "br-2026-general", turno: 1 });
    expect(at("2026-10-24T12:00:00Z")).toEqual({ election: "br-2026-general", turno: 1 });
    expect(at("2026-10-25T12:00:00Z")).toEqual({ election: "br-2026-general", turno: 2 });
    expect(at("2027-03-01T12:00:00Z")).toEqual({ election: "br-2026-general", turno: 2 });
  });

  it("falls back to the newest election's first round before any vote", () => {
    expect(at("2026-01-01T12:00:00Z")).toEqual({ election: "br-2026-general", turno: 1 });
  });
});
