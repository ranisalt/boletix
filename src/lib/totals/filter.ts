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
  turno: (typeof TURNOS)[number];
  cargo: (typeof CARGOS)[number];
  /** Omitted for the whole country. */
  uf?: (typeof UFS)[number];
};

const pick = <T extends string | number>(options: readonly T[], value: string | null) =>
  options.find((option) => String(option) === value);

/** The filters from the page's query string; anything unknown falls back to the default. */
export function parseTotalsQuery(params: URLSearchParams): TotalsQuery {
  const uf = pick(UFS, params.get("uf"));
  return {
    turno: pick(TURNOS, params.get("turno")) ?? 1,
    cargo: pick(CARGOS, params.get("cargo")) ?? 1,
    ...(uf && { uf }),
  };
}
