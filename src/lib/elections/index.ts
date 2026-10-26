export interface ElectionDef {
  id: string;
  proc: number;
  pleitos: { plei: number; turno: 1 | 2 }[];
  vrqr: string[];
  trustedRoots: { name: string; sha256: string; derBase64: string; source: string }[];
}

export const ELECTIONS: ElectionDef[] = [
  {
    id: 'br-2026-general',
    proc: 1219,
    pleitos: [
      { plei: 3220, turno: 1 },
      { plei: 3221, turno: 2 }
    ],
    vrqr: ['6.0'],
    trustedRoots: []
  }
];

export function findElection(proc: number, plei: number, vrqr: string): ElectionDef | undefined {
  return ELECTIONS.find(
    (election) => election.proc === proc &&
      election.pleitos.some((pleito) => pleito.plei === plei) &&
      election.vrqr.includes(vrqr)
  );
}
