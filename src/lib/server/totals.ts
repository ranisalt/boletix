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
  const scope =
    "b.election_id = ?1 AND b.turno = ?2 AND c.cargo = ?3 AND (?4 IS NULL OR b.uf = ?4)";
  const params = [election, turno, cargo, uf ?? null];
  const [sums, votes] = await db.batch<Record<string, number | string>>([
    db
      .prepare(
        `SELECT COUNT(DISTINCT b.id) AS secoes, COALESCE(SUM(c.brancos), 0) AS brancos,
                COALESCE(SUM(c.nulos), 0) AS nulos
           FROM bu b JOIN bu_cargo c ON c.bu_id = b.id
          WHERE ${scope}`,
      )
      .bind(...params),
    db
      .prepare(
        `SELECT c.idel, v.code AS numero, SUM(v.votes) AS votos
           FROM bu b JOIN bu_cargo c ON c.bu_id = b.id
           JOIN bu_vote v ON v.bu_id = c.bu_id AND v.idel = c.idel AND v.cargo = c.cargo
          WHERE ${scope} AND v.kind = 'nominal'
          GROUP BY c.idel, v.code
          ORDER BY votos DESC, numero`,
      )
      .bind(...params),
  ]);
  const { secoes, brancos, nulos } = sums!.results[0] as Omit<Totals, "candidatos">;
  return { secoes, candidatos: votes!.results as Totals["candidatos"], brancos, nulos };
}
