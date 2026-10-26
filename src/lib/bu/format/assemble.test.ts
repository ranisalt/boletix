import { expect, it } from "vitest";

import { BuError } from "../errors";
import { loadBuFixture } from "../testing/fixtures";
import { assembleBu } from "./assemble";
import { type BuQr, parseQr } from "./parse";

const HASH = "A".repeat(128);
const REAL_2026 = loadBuFixture("zz-29688-1-929").qrbu[0]!;

function parseBu(raw: string): BuQr {
  const parsed = parseQr(raw);
  if (parsed.kind !== "bu") throw new Error("expected a BU QR");
  return parsed;
}

function syntheticPart(index: number, total: number, content = ""): BuQr {
  const body = [`QRBU:${index}:${total}`, "VRQR:6.0", content, `HASH:${HASH}`]
    .filter(Boolean)
    .join(" ");
  return parseBu(body);
}

function expectErrorCode(action: () => unknown, code: BuError["code"]): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(BuError);
  expect((thrown as BuError).code).toBe(code);
}

it("assembles the real 2026 BU into its header and majoritarian cargo", () => {
  const bu = assembleBu([parseBu(REAL_2026)]);

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

it("sorts and joins split QR content with one space", () => {
  const first =
    "ORIG:VOTA ORLC:LEG PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:2 APTS:2 APTT:0 COMP:1 FALT:1 IDEL:1 CARG:1 TIPO:0 VERC:202610041234 13:1";
  const second = "APTA:2 APTS:2 APTT:0 NOMI:1 BRAN:0 NULO:0 TOTC:1";
  const bu = assembleBu([syntheticPart(2, 2, second), syntheticPart(1, 2, first)]);

  expect(bu.cargos[0]?.candidates).toEqual({ "13": 1 });
});

it("assembles a multi-QR BU whose joined content exceeds the single-QR size limit", () => {
  const candidates = Array.from({ length: 150 }, (_, i) => `${1000 + i}:1`);
  const header =
    "ORIG:VOTA ORLC:LEG PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:200 APTS:200 APTT:0 COMP:150 FALT:50 IDEL:1 CARG:1 TIPO:0 VERC:202610041234";
  const parts = [
    `${header} ${candidates.slice(0, 75).join(" ")}`,
    candidates.slice(75).join(" "),
    "APTA:200 APTS:200 APTT:0 NOMI:150 BRAN:0 NULO:0 TOTC:150",
  ];
  expect(parts.join(" ").length).toBeGreaterThan(1100);

  const bu = assembleBu(parts.map((content, i) => syntheticPart(i + 1, 3, content)));

  expect(Object.keys(bu.cargos[0]!.candidates)).toHaveLength(150);
});

it("rejects empty, incomplete, duplicate-index, or mixed-total QR sets", () => {
  expectErrorCode(() => assembleBu([]), "QR_SET_INCOMPLETE");
  expectErrorCode(() => assembleBu([syntheticPart(1, 2)]), "QR_SET_INCOMPLETE");
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 2), syntheticPart(1, 2)]),
    "QR_SET_INCOMPLETE",
  );
  expectErrorCode(() => assembleBu([syntheticPart(1, 2), syntheticPart(2, 3)]), "QR_SET_MIXED");
});

it("rejects unknown or origin-incompatible header fields", () => {
  const header =
    "ORIG:VOTA PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:2 APTS:2 APTT:0 COMP:1 FALT:1";
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, `${header} IDEL:1 FOO:1`)]),
    "UNEXPECTED_FIELD",
  );
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, `${header.replace("ORIG:VOTA", "ORIG:SA")} IDEL:1`)]),
    "UNEXPECTED_FIELD",
  );
});

it("rejects unknown and out-of-place cargo tokens", () => {
  const header =
    "ORIG:VOTA PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:2 APTS:2 APTT:0 COMP:1 FALT:1";
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, `${header} IDEL:1 CARG:1 TIPO:0 VERC:1 FOO:1`)]),
    "UNEXPECTED_FIELD",
  );
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, `${header} IDEL:1 CARG:1 VERC:1`)]),
    "MISSING_FIELD",
  );
});

const VALID_HEADER =
  "ORIG:VOTA PROC:1 DTPL:20261004 PLEI:1 TURN:1 FASE:O UNFE:ZZ MUNI:1 ZONA:1 SECA:1 IDUE:1 IDCA:000000000000000000000001 HIQT:1 HICA:1:000000000000000000000001 VERS:10.0.0 LOCA:1 APTO:10 APTS:10 APTT:0 COMP:2 FALT:8";
const VALID_MAJORITARIAN = `${VALID_HEADER} IDEL:1 CARG:13 TIPO:0 VERC:1 10:3 11:2 APTA:10 APTS:10 APTT:0 NOMI:5 BRAN:0 NULO:1 TOTC:6`;

it("accepts multi-vote cargos without equating TOTC to COMP", () => {
  const bu = assembleBu([syntheticPart(1, 1, VALID_MAJORITARIAN)]);
  expect(bu.header.comparecimento).toBe(2);
  expect(bu.cargos[0]?.total).toBe(6);
});

it("rejects candidate, cargo-summary, and VOTA header total mismatches", () => {
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, VALID_MAJORITARIAN.replace("10:3", "10:4"))]),
    "TOTALS_INCONSISTENT",
  );
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, VALID_MAJORITARIAN.replace("TOTC:6", "TOTC:7"))]),
    "TOTALS_INCONSISTENT",
  );
  expectErrorCode(
    () =>
      assembleBu([
        syntheticPart(1, 1, VALID_MAJORITARIAN.replace("COMP:2 FALT:8", "COMP:3 FALT:8")),
      ]),
    "TOTALS_INCONSISTENT",
  );
  expectErrorCode(
    () =>
      assembleBu([
        syntheticPart(
          1,
          1,
          VALID_MAJORITARIAN.replace("APTS:10 APTT:0 COMP", "APTS:9 APTT:0 COMP"),
        ),
      ]),
    "TOTALS_INCONSISTENT",
  );
});

it("checks party subtotals and proportional cargo totals", () => {
  const proportional = `${VALID_HEADER} IDEL:1 CARG:13 TIPO:1 VERC:1 PART:20 10:2 LEGP:1 TOTP:4 APTA:10 APTS:10 APTT:0 NOMI:3 LEGC:1 BRAN:1 NULO:0 TOTC:5`;
  expectErrorCode(() => assembleBu([syntheticPart(1, 1, proportional)]), "TOTALS_INCONSISTENT");
  expectErrorCode(
    () => assembleBu([syntheticPart(1, 1, proportional.replace("TOTP:4", "TOTP:3"))]),
    "TOTALS_INCONSISTENT",
  );
});
