import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { BuError } from "./errors";
import { parseQr } from "./parse";

const HASH = "A".repeat(128);
const REAL_2026 = readFileSync(
  new URL("../../../fixtures/2026/zz-29688-1-929/qrbu-1.txt", import.meta.url),
  "utf8",
);

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

it("parses the real VRQR 6.0 payload and returns content after the header", () => {
  const [raw, version, header, thirdKey] = [REAL_2026, "6.0", "QRBU:1:1 VRQR:6.0 ", "ORIG"];
  const parsed = parseQr(raw);
  const hashStart = raw.indexOf(" HASH:");
  const expectedHash = raw.match(/(?:^| )HASH:([0-9A-F]+)/)?.[1];

  expect(parsed).toMatchObject({ kind: "bu", index: 1, total: 1, version });
  expect(parsed.kind).toBe("bu");
  if (parsed.kind !== "bu") return;

  expect(parsed.content).toBe(raw.slice(header.length, hashStart));
  expect(parsed.hash).toBe(expectedHash);
  expect(parsed.tokens[2]?.[0]).toBe(thirdKey);
  expect(parsed.assi).toBeDefined();
});

it("parses a certificate QR when one is present", () => {
  expect(parseQr("QRCE:2:2 IDUE:123456 MDUE:UE2020 CERT:ABCD")).toEqual({
    kind: "cert",
    index: 2,
    total: 2,
    idue: "123456",
    mdue: "UE2020",
    cert: "ABCD",
  });
});

it("parses a BU QR independently of certificate QRs", () => {
  expect(parseQr(REAL_2026).kind).toBe("bu");
});

it("rejects an unknown first field", () => {
  expectErrorCode(() => parseQr(`ORIG:VOTA HASH:${HASH}`), "MISSING_FIELD");
});

it("rejects QR indexes outside 1..total<=32", () => {
  expectErrorCode(() => parseQr(`QRBU:0:2 VRQR:6.0 HASH:${HASH}`), "QR_INDEX_INVALID");
  expectErrorCode(() => parseQr(`QRBU:1:33 VRQR:6.0 HASH:${HASH}`), "QR_INDEX_INVALID");
});

it("rejects unsupported VRQR versions", () => {
  expectErrorCode(() => parseQr(`QRBU:1:1 VRQR:5.0 HASH:${HASH}`), "UNSUPPORTED_VERSION");
  expectErrorCode(() => parseQr(`QRBU:1:1 VRQR:1.5 HASH:${HASH}`), "UNSUPPORTED_VERSION");
});

it("requires a 128-character hexadecimal HASH in the final position", () => {
  expectErrorCode(() => parseQr("QRBU:1:1 VRQR:6.0 ORIG:VOTA"), "MISSING_FIELD");
  expectErrorCode(() => parseQr("QRBU:1:1 VRQR:6.0 HASH:ABC"), "INVALID_FIELD");
  expectErrorCode(() => parseQr(`QRBU:1:1 VRQR:6.0 HASH:${HASH} EXTRA:1`), "INVALID_FIELD");
});

it("requires a final-QR signature to be hexadecimal and present only after HASH", () => {
  expectErrorCode(() => parseQr(`QRBU:1:2 VRQR:6.0 HASH:${HASH} ASSI:DEAD`), "UNEXPECTED_FIELD");
  expectErrorCode(() => parseQr(`QRBU:1:1 VRQR:6.0 HASH:${HASH} ASSI:DE-AD`), "INVALID_FIELD");
  expectErrorCode(() => parseQr(`QRBU:1:1 VRQR:6.0 ASSI:DEAD HASH:${HASH}`), "INVALID_FIELD");
});

it("rejects malformed certificate headers and missing certificate fields", () => {
  expectErrorCode(() => parseQr("QRCE:0:1 IDUE:123 MDUE:UE2020 CERT:ABCD"), "QR_INDEX_INVALID");
  expectErrorCode(() => parseQr("QRCE:1:1 IDUE:123 CERT:ABCD"), "MISSING_FIELD");
  expectErrorCode(() => parseQr("QRCE:1:1 IDUE:123 MDUE:UE2020 CERT:AB-G"), "INVALID_FIELD");
});
