// Test-only loader for the real 2026 BU fixtures under /fixtures/2026/<uf>-<mun>-<zona>-<secao>/.
// Each directory holds qrbu-<i>.txt (BU QRs) and qrce-<i>.txt (urna certificate QRs).
const files = import.meta.glob("/fixtures/2026/*/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export interface BuFixture {
  name: string;
  qrbu: string[];
  qrce: string[];
}

function byIndex(a: string, b: string): number {
  return Number(/-(\d+)\.txt$/.exec(a)![1]) - Number(/-(\d+)\.txt$/.exec(b)![1]);
}

export function loadBuFixtures(): BuFixture[] {
  const dirs = new Map<string, { qrbu: string[]; qrce: string[] }>();
  for (const path of Object.keys(files).sort(byIndex)) {
    const match = /\/fixtures\/2026\/([^/]+)\/(qrbu|qrce)-\d+\.txt$/.exec(path);
    if (!match) continue;
    const [, name, kind] = match as unknown as [string, string, "qrbu" | "qrce"];
    const entry = dirs.get(name) ?? { qrbu: [], qrce: [] };
    entry[kind].push(files[path]!.trim());
    dirs.set(name, entry);
  }
  return [...dirs]
    .map(([name, e]) => ({ name, ...e }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadBuFixture(name: string): BuFixture {
  const fixture = loadBuFixtures().find((f) => f.name === name);
  if (!fixture) throw new Error(`unknown fixture ${name}`);
  return fixture;
}
