import { expect } from "vitest";

import { BuError } from "../src/errors.ts";
import { parseQr, type BuQr, type CertQr } from "../src/parse.ts";

// Test-only loader for the real 2026 BU fixtures at the repo root: fixtures/2026/<uf>-<mun>-<zona>-<secao>/.
// Each directory holds qrbu-<i>.txt (BU QRs) and qrce-<i>.txt (urna certificate QRs).
const files = import.meta.glob("../../../fixtures/2026/*/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type BuFixture = {
  name: string;
  qrbu: string[];
  qrce: string[];
};

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

/** A fixture as the scanner would hand it over: parsed BU and certificate QRs. */
export function loadBuScan(name: string): { parts: BuQr[]; certs: CertQr[] } {
  const fixture = loadBuFixture(name);
  return {
    parts: fixture.qrbu.map((raw) => parseQr(raw) as BuQr),
    certs: fixture.qrce.map((raw) => parseQr(raw) as CertQr),
  };
}

export function expectBuError(action: () => unknown, code: BuError["code"]): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(BuError);
  expect((thrown as BuError).code).toBe(code);
}
