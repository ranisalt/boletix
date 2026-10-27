import type { TseRow } from "./names";

/** Sections per round and UF from TSE open data, written by `scripts/tse-names.ts`. */
export type SectionCounts = {
  geradoEm: string;
  /** Round → UF (`ZZ` abroad) → principal sections, i.e. one BU each. */
  turnos: Record<string, Record<string, number>>;
};

/** From `detalhe_votacao_munzona_2026_BRASIL.csv`; one row per round, zone and role. */
export function buildSectionCounts(rows: TseRow[]): SectionCounts {
  const first = rows[0];
  const turnos: SectionCounts["turnos"] = {};
  // Every role is voted in the same sections, and only the president is voted abroad.
  for (const row of rows.filter((row) => row.CD_CARGO === "1")) {
    const uf = (turnos[row.NR_TURNO!] ??= {});
    uf[row.SG_UF!] = (uf[row.SG_UF!] ?? 0) + Number(row.QT_SECOES_PRINCIPAIS);
  }
  return { geradoEm: first ? `${first.DT_GERACAO} ${first.HH_GERACAO}` : "", turnos };
}

/** Sections of one UF, or of the whole country; undefined where TSE has no data. */
export function sectionTotal(
  counts: SectionCounts,
  turno: number,
  uf?: string,
): number | undefined {
  const byUf = counts.turnos[turno];
  if (!byUf) return undefined;
  if (uf) return byUf[uf];
  return Object.values(byUf).reduce((sum, count) => sum + count, 0);
}
