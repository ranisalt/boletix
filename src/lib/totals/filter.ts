import {
  ELECTIONS,
  getElection,
  latestPleito,
  nameFileArea,
  type Scope,
} from "#lib/elections/index.js";

export const TURNOS = [1, 2] as const;
/** Every UF, plus `ZZ` for votes cast abroad (president only). */
export const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
  "ZZ",
] as const;

export type TotalsQuery = {
  election: string;
  turno: (typeof TURNOS)[number];
  cargo: number;
  /** Omitted for the whole country. */
  uf?: (typeof UFS)[number];
};

const pick = <T extends string | number>(options: readonly T[], value: string | null) =>
  options.find((option) => String(option) === value);

/**
 * The filters from the page's query string; anything unknown falls back to the default: the
 * election's first cargo in the whole country, in the latest round held by `now`.
 */
export function parseTotalsQuery(params: URLSearchParams, now: Date): TotalsQuery {
  const latest = latestPleito(now);
  const election =
    pick(
      ELECTIONS.map((election) => election.id),
      params.get("eleicao"),
    ) ?? latest.election;
  const uf = pick(UFS, params.get("uf"));
  const cargos = getElection(election)!.cargos.map((entry) => entry.cargo);
  return {
    election,
    turno: pick(TURNOS, params.get("turno")) ?? (election === latest.election ? latest.turno : 1),
    cargo: pick(cargos, params.get("cargo")) ?? cargos[0]!,
    ...(uf && { uf }),
  };
}

/**
 * The name file for totals of a cargo with this scope, or undefined when they can't be summed:
 * rival candidates in different states (or cities) share numbers.
 */
export function totalsArea(scope: Scope, uf: string | undefined): string | undefined {
  if (scope === "pais") return nameFileArea(scope, uf ?? "");
  // Municipal cargos need a municipality filter, which the totals page doesn't have yet.
  if (scope === "uf" && uf) return nameFileArea(scope, uf);
  return undefined;
}
