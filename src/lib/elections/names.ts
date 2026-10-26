import type { Bu } from '../bu/assemble';

/**
 * Display names for one area (a UF, `BR` for president, `ZZ` abroad), generated from TSE open data
 * by `scripts/tse-names.ts`. Labels only: nothing here is covered by the BU signature.
 */
export interface NameFile {
  /** `DT_GERACAO HH_GERACAO` of the TSE extract, so stale lists are visible. */
  geradoEm: string;
  /** TSE municipality code (the BU's `MUNI`) → name. */
  municipios: Record<string, string>;
  /** `IDEL` → `CARG` → candidate number → [ballot name, party acronym]. */
  candidatos: Record<string, Record<string, Record<string, [string, string]>>>;
  /** Party number → acronym, for party-only (legenda) votes. */
  partidos: Record<string, string>;
}

export type TseRow = Record<string, string>;

/** TSE open-data CSVs: `;`-separated, text fields quoted, numbers bare, header row first. Decode latin1 before calling. */
export function parseTseCsv(text: string): TseRow[] {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  if (!header) return [];
  const split = (line: string) =>
    Array.from(line.matchAll(/(?:^|;)(?:"((?:[^"]|"")*)"|([^;]*))/g), (match) => match[1]?.replaceAll('""', '"') ?? match[2]!);
  const keys = split(header);
  return lines.map((line) => Object.fromEntries(split(line).map((value, i) => [keys[i], value])));
}

/** The BU carries codes as plain numbers; the TSE CSVs zero-pad some of them (`"01007"`). */
const code = (value: string) => String(Number(value));

export function buildNameFiles(candidates: TseRow[], municipalities: TseRow[]): Record<string, NameFile> {
  const geradoEm = candidates[0] ? `${candidates[0].DT_GERACAO} ${candidates[0].HH_GERACAO}` : '';
  const files: Record<string, NameFile> = {};
  const area = (key: string) => (files[key] ??= { geradoEm, municipios: {}, candidatos: {}, partidos: {} });

  for (const row of municipalities) area(row.SG_UF!).municipios[code(row.CD_MUNICIPIO!)] = row.NM_MUNICIPIO!;

  const byNumber = new Map<string, { file: NameFile; idel: string; cargo: string; numero: string; rows: TseRow[] }>();
  for (const row of candidates) {
    const file = area(row.SG_UE!);
    file.partidos[code(row.NR_PARTIDO!)] = row.SG_PARTIDO!;
    const [idel, cargo, numero] = [code(row.CD_ELEICAO!), code(row.CD_CARGO!), code(row.NR_CANDIDATO!)];
    const key = `${row.SG_UE} ${idel} ${cargo} ${numero}`;
    const group = byNumber.get(key) ?? { file, idel, cargo, numero, rows: [] };
    group.rows.push(row);
    byNumber.set(key, group);
  }

  for (const { file, idel, cargo, numero, rows } of byNumber.values()) {
    // `#NULO` marks a replaced or withdrawn candidacy, but also every candidate of a round not yet
    // totalled, so it only loses to a live row for the same number.
    const live = rows.filter((row) => row.DS_SIT_TOT_TURNO !== '#NULO');
    const shown = live.length > 0 ? live : rows;
    // The TSE sometimes still lists two candidacies for one number; show both rather than guess.
    ((file.candidatos[idel] ??= {})[cargo] ??= {})[numero] = [shown.map((row) => row.NM_URNA_CANDIDATO).join(' / '), shown[0]!.SG_PARTIDO!];
  }
  return files;
}

/** The name files a BU needs: `BR` for the presidential race, plus its own UF (`ZZ` abroad). */
export function nameFileKeys(bu: Bu): string[] {
  return ['BR', bu.header.uf];
}

export interface CandidateRow {
  numero: string;
  nome?: string;
  partido?: string;
  votos: number;
}

export interface CargoView {
  cargo: number;
  candidatos: CandidateRow[];
  legendas: { numero: string; partido?: string; votos: number }[];
  brancos: number;
  nulos: number;
  total: number;
}

export interface ResultsView {
  municipio?: string;
  cargos: CargoView[];
}

export function resultsView(bu: Bu, files: NameFile[]): ResultsView {
  const municipio = String(bu.header.municipio);
  const find = <T>(pick: (file: NameFile) => T | undefined) => files.map(pick).find((value) => value !== undefined);

  return {
    municipio: find((file) => file.municipios[municipio]),
    cargos: bu.cargos.map((cargo) => {
      const names = (numero: string) => find((file) => file.candidatos[cargo.idel]?.[cargo.cargo]?.[numero]);
      const row = (numero: string, votos: number): CandidateRow => {
        const name = names(numero);
        return name ? { numero, nome: name[0], partido: name[1], votos } : { numero, votos };
      };
      const votes =
        cargo.tipo === 1 ? cargo.parties.flatMap((party) => Object.entries(party.candidates)) : Object.entries(cargo.candidates);
      return {
        cargo: cargo.cargo,
        candidatos: votes.map(([numero, votos]) => row(numero, votos)),
        legendas: cargo.parties.map((party) => {
          const numero = String(party.party);
          const partido = find((file) => file.partidos[numero]);
          return partido ? { numero, partido, votos: party.legenda } : { numero, votos: party.legenda };
        }),
        brancos: cargo.brancos,
        nulos: cargo.nulos,
        total: cargo.total
      };
    })
  };
}
