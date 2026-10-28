import { describe, expect, it } from "vitest";

import { parseTotalsQuery, totalsArea, totalsTarget } from "./filter";

// Between the 2026 rounds: the first is the latest one held.
const NOW = new Date("2026-10-10T12:00:00Z");
const parse = (query: string, now = NOW) => parseTotalsQuery(new URLSearchParams(query), now);

describe("parseTotalsQuery", () => {
  it("defaults to the president in the whole country, in the latest round held", () => {
    expect(parse("")).toEqual({ election: "br-2026-general", turno: 1, cargo: 1 });
    expect(parse("", new Date("2026-10-26T12:00:00Z"))).toEqual({
      election: "br-2026-general",
      turno: 2,
      cargo: 1,
    });
  });

  it("reads a valid election, round, role and UF", () => {
    expect(parse("eleicao=br-2026-general&turno=2&cargo=3&uf=SP")).toEqual({
      election: "br-2026-general",
      turno: 2,
      cargo: 3,
      uf: "SP",
    });
  });

  it("falls back to the defaults for values it does not know", () => {
    expect(parse("eleicao=br-1989&turno=3&cargo=6&uf=XX")).toEqual({
      election: "br-2026-general",
      turno: 1,
      cargo: 1,
    });
  });

  it("treats an empty UF as the whole country", () => {
    expect(parse("cargo=5&uf=")).toEqual({ election: "br-2026-general", turno: 1, cargo: 5 });
  });
});

describe("totalsArea", () => {
  it("totals a national cargo over the country or one UF, named from the national file", () => {
    expect(totalsArea("pais", undefined)).toBe("BR");
    expect(totalsArea("pais", "SP")).toBe("BR");
  });

  it("totals a state cargo only within one UF, since rivals in other states share numbers", () => {
    expect(totalsArea("uf", undefined)).toBeUndefined();
    expect(totalsArea("uf", "SP")).toBe("SP");
  });

  it("cannot total a municipal cargo without a municipality filter", () => {
    expect(totalsArea("municipio", "SP")).toBeUndefined();
  });
});

describe("totalsTarget", () => {
  const base = { election: "br-2026-general", turno: 1 as const };

  it("finds the election and name file of a choice that can be summed", () => {
    expect(totalsTarget({ ...base, cargo: 3, uf: "SP" })).toMatchObject({
      election: { id: "br-2026-general" },
      area: "SP",
    });
  });

  it("rejects an unknown election, a cargo outside it, or a state cargo with no UF", () => {
    expect(totalsTarget({ ...base, election: "br-1998-general", cargo: 1 })).toBeUndefined();
    expect(totalsTarget({ ...base, cargo: 99 })).toBeUndefined();
    expect(totalsTarget({ ...base, cargo: 3 })).toBeUndefined();
  });
});
