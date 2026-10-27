import { describe, expect, it } from "vitest";

import { parseTotalsQuery } from "./filter";

const parse = (query: string) => parseTotalsQuery(new URLSearchParams(query));

describe("parseTotalsQuery", () => {
  it("defaults to the president's first round in the whole country", () => {
    expect(parse("")).toEqual({ turno: 1, cargo: 1 });
  });

  it("reads a valid round, role and UF", () => {
    expect(parse("turno=2&cargo=3&uf=SP")).toEqual({ turno: 2, cargo: 3, uf: "SP" });
  });

  it("falls back to the defaults for values it does not know", () => {
    expect(parse("turno=3&cargo=6&uf=XX")).toEqual({ turno: 1, cargo: 1 });
  });

  it("treats an empty UF as the whole country", () => {
    expect(parse("cargo=5&uf=")).toEqual({ turno: 1, cargo: 5 });
  });
});
