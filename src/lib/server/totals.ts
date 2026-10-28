export type TotalsFilter = {
  election: string;
  turno: number;
  cargo: number;
  /** Omitted for the whole country. */
  uf?: string;
};

export type Totals = {
  /** Sections with a stored BU for this cargo. */
  secoes: number;
  candidatos: { idel: number; numero: string; votos: number }[];
  brancos: number;
  nulos: number;
};

export async function loadTotals(
  db: D1Database,
  { election, turno, cargo, uf }: TotalsFilter,
): Promise<Totals> {
  // `?4 IS NULL` lets one statement serve both a UF and the whole country.
  const scope = "election_id = ?1 AND turno = ?2 AND cargo = ?3 AND (?4 IS NULL OR uf = ?4)";
  const params = [election, turno, cargo, uf ?? null];
  const [sums, votes] = await db.batch<Record<string, number | string>>([
    db
      .prepare(
        `SELECT COALESCE(SUM(secoes), 0) AS secoes, COALESCE(SUM(brancos), 0) AS brancos,
                COALESCE(SUM(nulos), 0) AS nulos
           FROM totals_cargo
          WHERE ${scope}`,
      )
      .bind(...params),
    db
      .prepare(
        `SELECT idel, numero, SUM(votos) AS votos
           FROM totals_vote
          WHERE ${scope}
          GROUP BY idel, numero
          ORDER BY votos DESC, numero`,
      )
      .bind(...params),
  ]);
  const { secoes, brancos, nulos } = sums!.results[0] as Omit<Totals, "candidatos">;
  return { secoes, candidatos: votes!.results as Totals["candidatos"], brancos, nulos };
}
