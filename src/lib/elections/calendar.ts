export type ElectionDef = {
  id: string;
  proc: number;
  pleitos: { plei: number; turno: 1 | 2 }[];
  vrqr: string[];
};

export const ELECTIONS: ElectionDef[] = [
  {
    id: "br-2026-general",
    proc: 1219,
    pleitos: [
      { plei: 3220, turno: 1 },
      { plei: 3221, turno: 2 },
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
