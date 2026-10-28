import { expect, it } from "vitest";

import { assembleBu, type Bu, type BuQr, parseQr } from "../src/index.ts";
import {
  expectBuErrorAsync,
  loadBuFixture,
  loadBuFixtures,
  loadBuScan,
  sealParts,
} from "./fixtures.ts";

const HASH = "A".repeat(128);
const REAL_2026 = loadBuFixture("zz-29688-1-929").qrbu[0]!;

function parseBu(raw: string): BuQr {
  const parsed = parseQr(raw);
  if (parsed.kind !== "bu") throw new Error("expected a BU QR");
  return parsed;
}

/** Parts with a placeholder HASH: only for set-shape errors, which are checked before the chain. */
function syntheticPart(index: number, total: number, content = ""): BuQr {
  const body = [`QRBU:${index}:${total}`, "VRQR:6.0", content, `HASH:${HASH}`]
    .filter(Boolean)
    .join(" ");
  return parseBu(body);
}

async function assemble(...contents: string[]): Promise<Bu> {
  return (await assembleBu(await sealParts(contents))).bu;
}

it("assembles the real 2026 BU into its header and majoritarian cargo", async () => {
  // zz-29688-1-929 is hand-edited, so its printed HASH is stale: re-seal its content.
  const bu = await assemble(parseBu(REAL_2026).content);

  expect(bu.header).toMatchObject({
    orig: "VOTA",
    proc: 1219,
    plei: 3220,
    turno: 1,
    fase: "O",
    dtpl: "20261004",
    uf: "ZZ",
    municipio: 29688,
    zona: 1,
    secao: 929,
    agregadas: [3439],
    urna: "1654174",
    idca: "192430138112993362418449",
    aptos: 746,
    comparecimento: 310,
    faltosos: 436,
  });
  expect(bu.cargos).toHaveLength(1);
  expect(bu.cargos[0]).toMatchObject({
    idel: 6257,
    cargo: 1,
    tipo: 0,
    candidates: {
      "13": 210,
      "14": 7,
      "16": 1,
      "21": 2,
      "22": 56,
      "30": 8,
      "55": 6,
      "70": 10,
      "80": 3,
    },
    apta: 746,
    nominais: 303,
    brancos: 6,
    nulos: 1,
    total: 310,
  });
});

it("sorts and joins split QR content with one space", async () => {
  const first =
    "ORIG:VOTA ORLC:LEG PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:2 APTS:2 APTT:0 COMP:1 FALT:1 IDEL:1 CARG:1 TIPO:0 VERC:202610041234 13:1";
  const second = "APTA:2 APTS:2 APTT:0 NOMI:1 BRAN:0 NULO:0 TOTC:1";
  const [p1, p2] = await sealParts([first, second]);
  const { bu } = await assembleBu([p2!, p1!]);

  expect(bu.cargos[0]?.candidates).toEqual({ "13": 1 });
});

it("assembles a multi-QR BU whose joined content exceeds the single-QR size limit", async () => {
  const candidates = Array.from({ length: 150 }, (_, i) => `${1000 + i}:1`);
  const header =
    "ORIG:VOTA ORLC:LEG PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:200 APTS:200 APTT:0 COMP:150 FALT:50 IDEL:1 CARG:1 TIPO:0 VERC:202610041234";
  const parts = [
    `${header} ${candidates.slice(0, 75).join(" ")}`,
    candidates.slice(75).join(" "),
    "APTA:200 APTS:200 APTT:0 NOMI:150 BRAN:0 NULO:0 TOTC:150",
  ];
  expect(parts.join(" ").length).toBeGreaterThan(1100);

  const bu = await assemble(...parts);

  expect(Object.keys(bu.cargos[0]!.candidates)).toHaveLength(150);
});

it("rejects empty, incomplete, duplicate-index, or mixed-total QR sets", async () => {
  await expectBuErrorAsync(async () => assembleBu([]), "QR_SET_INCOMPLETE");
  await expectBuErrorAsync(async () => assembleBu([syntheticPart(1, 2)]), "QR_SET_INCOMPLETE");
  await expectBuErrorAsync(
    async () => assembleBu([syntheticPart(1, 2), syntheticPart(1, 2)]),
    "QR_SET_INCOMPLETE",
  );
  await expectBuErrorAsync(
    async () => assembleBu([syntheticPart(1, 2), syntheticPart(2, 3)]),
    "QR_SET_MIXED",
  );
});

it("rejects unknown or origin-incompatible header fields", async () => {
  const header =
    "ORIG:VOTA PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:2 APTS:2 APTT:0 COMP:1 FALT:1";
  await expectBuErrorAsync(async () => assemble(`${header} IDEL:1 FOO:1`), "UNEXPECTED_FIELD");
  await expectBuErrorAsync(
    async () => assemble(`${header.replace("ORIG:VOTA", "ORIG:SA")} IDEL:1`),
    "UNEXPECTED_FIELD",
  );
});

it("rejects unknown and out-of-place cargo tokens", async () => {
  const header =
    "ORIG:VOTA PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:2 APTS:2 APTT:0 COMP:1 FALT:1";
  await expectBuErrorAsync(
    async () => assemble(`${header} IDEL:1 CARG:1 TIPO:0 VERC:1 FOO:1`),
    "UNEXPECTED_FIELD",
  );
  await expectBuErrorAsync(async () => assemble(`${header} IDEL:1 CARG:1 VERC:1`), "MISSING_FIELD");
});

const VALID_HEADER =
  "ORIG:VOTA PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:10 APTS:10 APTT:0 COMP:2 FALT:8";
const VALID_MAJORITARIAN = `${VALID_HEADER} IDEL:1 CARG:13 TIPO:0 VERC:1 10:3 11:2 APTA:10 APTS:10 APTT:0 NOMI:5 BRAN:0 NULO:1 TOTC:6`;

it("accepts multi-vote cargos without equating TOTC to COMP", async () => {
  const bu = await assemble(VALID_MAJORITARIAN);
  expect(bu.header.comparecimento).toBe(2);
  expect(bu.cargos[0]?.total).toBe(6);
});

it("rejects candidate, cargo-summary, and VOTA header total mismatches", async () => {
  await expectBuErrorAsync(
    async () => assemble(VALID_MAJORITARIAN.replace("10:3", "10:4")),
    "TOTALS_INCONSISTENT",
  );
  await expectBuErrorAsync(
    async () => assemble(VALID_MAJORITARIAN.replace("TOTC:6", "TOTC:7")),
    "TOTALS_INCONSISTENT",
  );
  await expectBuErrorAsync(
    async () => assemble(VALID_MAJORITARIAN.replace("COMP:2 FALT:8", "COMP:3 FALT:8")),
    "TOTALS_INCONSISTENT",
  );
  await expectBuErrorAsync(
    async () => assemble(VALID_MAJORITARIAN.replace("APTS:10 APTT:0 COMP", "APTS:9 APTT:0 COMP")),
    "TOTALS_INCONSISTENT",
  );
});

it("checks party subtotals and proportional cargo totals", async () => {
  const proportional = `${VALID_HEADER} IDEL:1 CARG:13 TIPO:1 VERC:1 PART:20 10:2 LEGP:1 TOTP:4 APTA:10 APTS:10 APTT:0 NOMI:3 LEGC:1 BRAN:1 NULO:0 TOTC:5`;
  await expectBuErrorAsync(async () => assemble(proportional), "TOTALS_INCONSISTENT");
  await expectBuErrorAsync(
    async () => assemble(proportional.replace("TOTP:4", "TOTP:3")),
    "TOTALS_INCONSISTENT",
  );
});

it("returns the signed HASH and ASSI of every real 2026 BU", async () => {
  // zz-29688-1-929 is hand-edited, so its printed HASH no longer matches its content.
  const names = loadBuFixtures()
    .map((f) => f.name)
    .filter((name) => name !== "zz-29688-1-929");
  const results = await Promise.all(
    names.map(async (name) => {
      const { parts } = loadBuScan(name);
      const last = parts.find((part) => part.index === part.total)!;
      return { name, last, assembled: await assembleBu(parts.toReversed()) };
    }),
  );
  for (const { name, last, assembled } of results) {
    expect(assembled.hash, name).toBe(last.hash);
    expect(assembled.assi, name).toEqual(last.assi);
  }
});

it("rejects a BU whose content no longer matches its HASH chain", async () => {
  const parts = await sealParts([VALID_MAJORITARIAN]);
  const tampered = parseBu(
    `QRBU:1:1 VRQR:6.0 ${VALID_MAJORITARIAN.replace("NULO:1", "NULO:2")} HASH:${parts[0]!.hash} ASSI:ABCD`,
  );
  await expectBuErrorAsync(async () => assembleBu([tampered]), "HASH_MISMATCH");
});

it("rejects a BU whose intermediate QR HASH is wrong even if the last one matches", async () => {
  const [p1, p2] = await sealParts(["ORIG:VOTA", "PROC:1"]);
  await expectBuErrorAsync(
    async () => assembleBu([{ ...p1!, hash: "0".repeat(128) }, p2!]),
    "HASH_MISMATCH",
  );
});
