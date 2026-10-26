import { describe, expect, it } from 'vitest';
import { assembleBu, type Bu } from '../bu/assemble';
import { loadBuFixture } from '../bu/fixtures';
import { parseQr, type BuQr } from '../bu/parse';
import { buildNameFiles, parseTseCsv, resultsView, type NameFile } from './names';

const HEADER =
  '"DT_GERACAO";"HH_GERACAO";"CD_ELEICAO";"SG_UE";"CD_CARGO";"NR_CANDIDATO";"NM_URNA_CANDIDATO";"NR_PARTIDO";"SG_PARTIDO";"DS_SIT_TOT_TURNO"';
const cand = (idel: string, ue: string, cargo: string, nr: string, name: string, party: string, sit = 'NÃO ELEITO') =>
  `"25/10/2026";"12:30:51";"${idel}";"${ue}";"${cargo}";"${nr}";"${name}";"${nr.slice(0, 2)}";"${party}";"${sit}"`;
const CANDIDATES = [
  HEADER,
  // Round-2 rows are all `#NULO` until the TSE totals that round.
  cand('6258', 'BR', '1', '13', 'LULA', 'PT', '#NULO'),
  cand('6258', 'BR', '1', '22', 'FLAVIO BOLSONARO', 'PL', '#NULO'),
  cand('6260', 'DF', '3', '11', 'CELINA LEÃO', 'PP', '#NULO'),
  cand('6260', 'DF', '3', '13', 'LEANDRO GRASS', 'PT', '#NULO'),
  cand('6259', 'DF', '6', '1312', 'FULANA', 'PT'),
  // A replaced candidacy keeps its number but must not label the votes.
  cand('6259', 'DF', '6', '2222', 'OLD NAME', 'PL', '#NULO'),
  cand('6259', 'DF', '6', '2222', 'NEW NAME', 'PL', 'SUPLENTE')
].join('\n');
const MUNICIPALITIES = [
  '"SG_UF";"CD_MUNICIPIO";"NM_MUNICIPIO";"NR_ZONA"',
  '"DF";"97012";"BRASÍLIA";"1"',
  '"DF";"97012";"BRASÍLIA";"11"',
  '"ZZ";"29386";"BERLIM";"1"',
  '"AC";"01007";"BUJARI";"9"'
].join('\n');

function files() {
  return buildNameFiles(parseTseCsv(CANDIDATES), parseTseCsv(MUNICIPALITIES));
}

describe('parseTseCsv', () => {
  it('reads the quoted, semicolon-separated TSE layout', () => {
    expect(parseTseCsv('"A";"B"\r\n"1";"x;y"\r\n')).toEqual([{ A: '1', B: 'x;y' }]);
  });

  it('reads unquoted numeric fields, as in the real extract', () => {
    expect(parseTseCsv('"ANO";"DS";"NR"\n2026;"ELEIÇÃO ORDINÁRIA";13\n')).toEqual([{ ANO: '2026', DS: 'ELEIÇÃO ORDINÁRIA', NR: '13' }]);
  });
});

describe('buildNameFiles', () => {
  it('splits names by area and drops replaced candidacies', () => {
    const out = files();
    expect(Object.keys(out).sort()).toEqual(['AC', 'BR', 'DF', 'ZZ']);
    expect(out.AC!.municipios).toEqual({ '1007': 'BUJARI' });
    expect(out.BR!.candidatos).toEqual({ '6258': { '1': { '13': ['LULA', 'PT'], '22': ['FLAVIO BOLSONARO', 'PL'] } } });
    expect(out.DF!.municipios).toEqual({ '97012': 'BRASÍLIA' });
    expect(out.DF!.candidatos['6259']!['6']!['2222']).toEqual(['NEW NAME', 'PL']);
    expect(out.DF!.partidos).toMatchObject({ '11': 'PP', '13': 'PT', '22': 'PL' });
    expect(out.ZZ).toEqual({ geradoEm: '25/10/2026 12:30:51', municipios: { '29386': 'BERLIM' }, candidatos: {}, partidos: {} });
  });

  it('keeps every name when the TSE still lists two live candidacies for one number', () => {
    const out = buildNameFiles(
      parseTseCsv([HEADER, cand('6259', 'DF', '6', '4444', 'A', 'X'), cand('6259', 'DF', '6', '4444', 'B', 'X')].join('\n')),
      []
    );
    expect(out.DF!.candidatos['6259']!['6']!['4444']).toEqual(['A / B', 'X']);
  });
});

function bu(name: string): Bu {
  return assembleBu(loadBuFixture(name).qrbu.map((raw) => parseQr(raw) as BuQr));
}

describe('resultsView', () => {
  it('labels every candidate of the real DF boletim, in BU order', () => {
    const { BR, DF } = files();
    const view = resultsView(bu('df-97012-11-178'), [BR!, DF!]);
    expect(view.municipio).toBe('BRASÍLIA');
    expect(view.cargos).toEqual([
      {
        cargo: 3,
        candidatos: [
          { numero: '11', nome: 'CELINA LEÃO', partido: 'PP', votos: 122 },
          { numero: '13', nome: 'LEANDRO GRASS', partido: 'PT', votos: 99 }
        ],
        legendas: [],
        brancos: 9,
        nulos: 11,
        total: 241
      },
      {
        cargo: 1,
        candidatos: [
          { numero: '13', nome: 'LULA', partido: 'PT', votos: 121 },
          { numero: '22', nome: 'FLAVIO BOLSONARO', partido: 'PL', votos: 138 }
        ],
        legendas: [],
        brancos: 2,
        nulos: 8,
        total: 269
      }
    ]);
  });

  it('falls back to the bare number when names are missing', () => {
    const view = resultsView(bu('df-97012-11-178'), []);
    expect(view.municipio).toBeUndefined();
    expect(view.cargos[0]!.candidatos[0]).toEqual({ numero: '11', votos: 122 });
  });

  it('lists proportional candidates and party votes under their party', () => {
    const { DF } = files();
    const base = bu('df-97012-11-178');
    const proportional: Bu = {
      header: base.header,
      cargos: [
        {
          idel: 6259,
          cargo: 6,
          tipo: 1,
          verc: '',
          apta: 291,
          nominais: 7,
          legenda: 2,
          brancos: 1,
          nulos: 0,
          total: 10,
          candidates: {},
          parties: [
            { party: 13, candidates: { '1312': 4 }, legenda: 1, total: 5 },
            { party: 22, candidates: { '2222': 3 }, legenda: 1, total: 4 }
          ]
        }
      ]
    };
    expect(resultsView(proportional, [DF!]).cargos[0]).toEqual({
      cargo: 6,
      candidatos: [
        { numero: '1312', nome: 'FULANA', partido: 'PT', votos: 4 },
        { numero: '2222', nome: 'NEW NAME', partido: 'PL', votos: 3 }
      ],
      legendas: [
        { numero: '13', partido: 'PT', votos: 1 },
        { numero: '22', partido: 'PL', votos: 1 }
      ],
      brancos: 1,
      nulos: 0,
      total: 10
    });
  });
});
