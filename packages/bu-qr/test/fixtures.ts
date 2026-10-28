import { readdirSync, readFileSync } from "node:fs";

import { expect } from "vitest";

import { BuError, type BuQr, type CertQr, chainHashes, parseQr } from "../src/index.ts";

// Test-only loader for the real 2026 BU fixtures at the repo root: fixtures/2026/<uf>-<mun>-<zona>-<secao>/.
// Each directory holds qrbu-<i>.txt (BU QRs) and qrce-<i>.txt (urna certificate QRs).
const ROOT = new URL("../../../fixtures/2026/", import.meta.url);
const files: Record<string, string> = Object.fromEntries(
  readdirSync(ROOT, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".txt"))
    .map((path) => [`/fixtures/2026/${path}`, readFileSync(new URL(path, ROOT), "utf8")]),
);

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
  for (const path of Object.keys(files).toSorted(byIndex)) {
    const match = /\/fixtures\/2026\/([^/]+)\/(qrbu|qrce)-\d+\.txt$/.exec(path);
    if (!match) continue;
    const [, name, kind] = match as unknown as [string, string, "qrbu" | "qrce"];
    const entry = dirs.get(name) ?? { qrbu: [], qrce: [] };
    entry[kind].push(files[path]!.trim());
    dirs.set(name, entry);
  }
  return [...dirs]
    .map(([name, { qrbu, qrce }]) => ({ name, qrbu, qrce }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
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

export async function expectBuErrorAsync(
  action: () => Promise<unknown>,
  code: BuError["code"],
): Promise<void> {
  const thrown = await action().then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(BuError);
  expect((thrown as BuError).code).toBe(code);
}

/** Uppercase hex, as printed in QR codes. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Builds a BU QR set from raw contents with a correct HASH chain, the way an urna prints it. */
export async function sealParts(contents: readonly string[], assi = "ABCD"): Promise<BuQr[]> {
  const hashes = await chainHashes(contents);
  return contents.map((content, i) => {
    const signature = i === contents.length - 1 ? ` ASSI:${assi}` : "";
    const raw = `QRBU:${i + 1}:${contents.length} VRQR:6.0 ${content} HASH:${hashes[i]}${signature}`;
    return parseQr(raw) as BuQr;
  });
}
