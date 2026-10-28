export type ElectionDef = {
  id: string;
  /** Display name; election names are proper nouns, so they are not translated. */
  name: string;
  proc: number;
  /** In order; `date` is the voting day (YYYY-MM-DD). */
  pleitos: { plei: number; turno: 1 | 2; date: string }[];
  vrqr: string[];
};

/** Newest first, so the latest election tops any list. */
export const ELECTIONS: ElectionDef[] = [
  {
    id: "br-2026-general",
    name: "Eleições Gerais 2026",
    proc: 1219,
    pleitos: [
      { plei: 3220, turno: 1, date: "2026-10-04" },
      { plei: 3221, turno: 2, date: "2026-10-25" },
    ],
    vrqr: ["6.0"],
  },
];

export function findElection(
  proc: number,
  plei: number,
  turno: number,
  vrqr: string,
): ElectionDef | undefined {
  return ELECTIONS.find(
    (election) =>
      election.proc === proc &&
      election.pleitos.some((pleito) => pleito.plei === plei && pleito.turno === turno) &&
      election.vrqr.includes(vrqr),
  );
}

// Election days follow Brasília time; in UTC the next day starts at 21:00 there.
const BRASILIA_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** The latest round voted by `now`, or the newest election's first round if none was yet. */
export function latestPleito(now: Date): { election: string; turno: 1 | 2 } {
  const today = BRASILIA_DATE.format(now);
  for (const election of ELECTIONS) {
    const held = election.pleitos.findLast((pleito) => pleito.date <= today);
    if (held) return { election: election.id, turno: held.turno };
  }
  return { election: ELECTIONS[0]!.id, turno: 1 };
}
