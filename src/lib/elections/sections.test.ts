import { describe, expect, it } from "vitest";

import { buildSectionCounts, sectionTotal } from "./sections";

const row = (turno: string, cargo: string, uf: string, secoes: string) => ({
  DT_GERACAO: "27/10/2026",
  HH_GERACAO: "14:30:53",
  NR_TURNO: turno,
  CD_CARGO: cargo,
  SG_UF: uf,
  QT_SECOES_PRINCIPAIS: secoes,
});

describe("buildSectionCounts", () => {
  // Every role shares the same sections, so only the presidential rows are counted.
  const counts = buildSectionCounts([
    row("1", "1", "AC", "60"),
    row("1", "1", "AC", "40"),
    row("1", "3", "AC", "100"),
    row("1", "1", "ZZ", "7"),
    row("2", "1", "AC", "100"),
  ]);

  it("sums sections per round and UF", () => {
    expect(counts).toEqual({
      geradoEm: "27/10/2026 14:30:53",
      turnos: { 1: { AC: 100, ZZ: 7 }, 2: { AC: 100 } },
    });
  });

  it("totals one UF, or the whole country without one", () => {
    expect(sectionTotal(counts, 1, "AC")).toBe(100);
    expect(sectionTotal(counts, 1)).toBe(107);
  });

  it("is unknown for rounds or UFs without data", () => {
    expect(sectionTotal(counts, 2, "SP")).toBeUndefined();
    expect(sectionTotal({ ...counts, turnos: { 1: counts.turnos[1]! } }, 2)).toBeUndefined();
  });
});
