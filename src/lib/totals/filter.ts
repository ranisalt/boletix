import { ELECTIONS, latestPleito } from "#lib/elections/index.js";

export const TURNOS = [1, 2] as const;
/** Only the majoritarian roles: party-list seats can't be read off a vote count. */
export const CARGOS = [1, 3, 5] as const;
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
  cargo: (typeof CARGOS)[number];
  /** Omitted for the whole country. */
  uf?: (typeof UFS)[number];
};

const pick = <T extends string | number>(options: readonly T[], value: string | null) =>
  options.find((option) => String(option) === value);

/**
 * The filters from the page's query string; anything unknown falls back to the default: the
 * president in the whole country, in the latest round held by `now`.
 */
export function parseTotalsQuery(params: URLSearchParams, now: Date): TotalsQuery {
  const latest = latestPleito(now);
  const election =
    pick(
      ELECTIONS.map((election) => election.id),
      params.get("eleicao"),
    ) ?? latest.election;
  const uf = pick(UFS, params.get("uf"));
  return {
    election,
    turno: pick(TURNOS, params.get("turno")) ?? (election === latest.election ? latest.turno : 1),
    cargo: pick(CARGOS, params.get("cargo")) ?? 1,
    ...(uf && { uf }),
  };
}
