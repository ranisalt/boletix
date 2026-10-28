import { expect, it } from "vitest";

import { assembleCertificate } from "../src/certificate.ts";
import { bytesToHex } from "../src/hex.ts";
import { parseQr, type CertQr } from "../src/parse.ts";
import { expectBuError, loadBuFixtures, loadBuScan } from "./fixtures.ts";

function cert(raw: string): CertQr {
  const parsed = parseQr(raw);
  if (parsed.kind !== "cert") throw new Error("expected a certificate QR");
  return parsed;
}

const CERT_HEX = "3082";

it("requires at least one certificate QR", () => {
  expectBuError(() => assembleCertificate([]), "CERT_MISSING");
});

it("requires every QR index 1..total from the same urna", () => {
  expectBuError(
    () => assembleCertificate([cert(`QRCE:1:2 IDUE:1 MDUE:2020 CERT:${CERT_HEX}`)]),
    "QR_SET_INCOMPLETE",
  );
  expectBuError(
    () =>
      assembleCertificate([
        cert(`QRCE:1:2 IDUE:1 MDUE:2020 CERT:${CERT_HEX}`),
        cert(`QRCE:1:2 IDUE:1 MDUE:2020 CERT:${CERT_HEX}`),
      ]),
    "QR_SET_INCOMPLETE",
  );
});

it("rejects certificate QR codes from different urnas", () => {
  expectBuError(
    () =>
      assembleCertificate([
        cert(`QRCE:1:2 IDUE:1 MDUE:2020 CERT:${CERT_HEX}`),
        cert(`QRCE:2:2 IDUE:2 MDUE:2020 CERT:${CERT_HEX}`),
      ]),
    "QR_SET_MIXED",
  );
});

it("rejects a PEM body that is not terminated", () => {
  const pem = "-----BEGIN CERTIFICATE-----\nAAAA";
  const hex = bytesToHex(new TextEncoder().encode(pem));
  expectBuError(() => assembleCertificate([cert(`QRCE:1:1 IDUE:1 MDUE:2020 CERT:${hex}`)]), "CERT_INVALID");
});

it("decodes every real 2026 certificate into a DER SEQUENCE, not PEM text", () => {
  for (const fixture of loadBuFixtures()) {
    const der = assembleCertificate(loadBuScan(fixture.name).certs);
    expect(der[0], fixture.name).toBe(0x30);
    expect(new TextDecoder().decode(der).startsWith("-----"), fixture.name).toBe(false);
  }
});

it("decodes a PEM certificate split across QR codes into the same DER", () => {
  const { certs } = loadBuScan("zz-29386-1-1709");
  const der = assembleCertificate(certs);
  const base64 = btoa(String.fromCharCode(...der));
  const wrapped = base64.match(/.{1,64}/g)!.join("\n");
  const pem = `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----\n`;
  const hex = bytesToHex(new TextEncoder().encode(pem));
  const split = Math.floor(hex.length / 4) * 2; // split on a byte boundary
  const { idue, mdue } = certs[0]!;
  const pemCerts = [
    cert(`QRCE:1:2 IDUE:${idue} MDUE:${mdue} CERT:${hex.slice(0, split)}`),
    cert(`QRCE:2:2 IDUE:${idue} MDUE:${mdue} CERT:${hex.slice(split)}`),
  ];

  expect(assembleCertificate(pemCerts)).toEqual(der);
});
