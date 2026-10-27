import { describe, expect, it } from "vitest";

import { ELECTIONS, findElection, latestPleito } from "./calendar";

it("finds the 2026 general election only for a registered pleito, turno and QR version", () => {
  expect(findElection(1219, 3220, 1, "6.0")).toMatchObject({
    id: "br-2026-general",
    name: "Eleições Gerais 2026",
    proc: 1219,
    pleitos: [
      { plei: 3220, turno: 1, date: "2026-10-04" },
      { plei: 3221, turno: 2, date: "2026-10-25" },
    ],
    vrqr: ["6.0"],
  });
  expect(findElection(1219, 3221, 2, "6.0")?.id).toBe("br-2026-general");
  expect(findElection(1219, 3220, 2, "6.0")).toBeUndefined();
  expect(findElection(1219, 3221, 1, "6.0")).toBeUndefined();
  expect(findElection(1219, 9999, 1, "6.0")).toBeUndefined();
  expect(findElection(9999, 3220, 1, "6.0")).toBeUndefined();
});

it("lists elections newest first", () => {
  const firstDates = ELECTIONS.map((election) => election.pleitos[0]!.date);
  expect(firstDates).toEqual([...firstDates].sort().reverse());
});

describe("latestPleito", () => {
  const at = (iso: string) => latestPleito(new Date(iso));

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
