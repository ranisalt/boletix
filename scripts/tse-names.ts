/**
 * Regenerates static/tse/2026/*.json (display names for municipalities, candidates and parties)
 * from TSE open data. Re-run before each round: candidacies change until election day.
 *
 *   node scripts/tse-names.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildNameFiles, parseTseCsv } from '../src/lib/elections/names.ts';

const BASE = 'https://cdn.tse.jus.br/estatistica/sead/odsele';
const OUT = 'static/tse/2026';

async function csv(dir: string, path: string, file: string): Promise<string> {
  const response = await fetch(`${BASE}/${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const zip = join(dir, 'data.zip');
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, file, '-d', dir]);
  return new TextDecoder('latin1').decode(readFileSync(join(dir, file)));
}

const dir = mkdtempSync(join(tmpdir(), 'tse-names-'));
try {
  const candidates = await csv(dir, 'consulta_cand/consulta_cand_2026.zip', 'consulta_cand_2026_BRASIL.csv');
  const municipalities = await csv(
    dir,
    'detalhe_votacao_munzona/detalhe_votacao_munzona_2026.zip',
    'detalhe_votacao_munzona_2026_BRASIL.csv'
  );
  const files = buildNameFiles(parseTseCsv(candidates), parseTseCsv(municipalities));
  mkdirSync(OUT, { recursive: true });
  for (const [area, file] of Object.entries(files)) writeFileSync(join(OUT, `${area}.json`), JSON.stringify(file));
  console.log(`wrote ${Object.keys(files).length} files to ${OUT} (TSE ${Object.values(files)[0]?.geradoEm})`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
