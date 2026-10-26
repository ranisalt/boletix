import { sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import { BuError } from "./errors";
import { loadBuFixture, loadBuFixtures } from "./fixtures";
import { parseQr, type BuQr, type CertQr } from "./parse";
import { TSE_ROOTS } from "./tse-roots";
import { chainedBuHash, verifyBuSignature } from "./verify";

const sha512Hex = (text: string) =>
  bytesToHex(sha512(new TextEncoder().encode(text))).toUpperCase();

function bu(index: number, total: number, content: string, hash = "0".repeat(128)): BuQr {
  return { kind: "bu", index, total, version: "6.0", content, tokens: [], hash };
}

// Rule from the TSE "Boletim na Mão" app (module 4770): each QR's text after its header is chained as
// `<previous text> HASH:<previous hash> <content>`, and only the final hash is checked.
describe("chainedBuHash", () => {
  it("is the SHA-512 of the content for a single QR", () => {
    expect(chainedBuHash([bu(1, 1, "IDUE:1 APTA:2")])).toBe(sha512Hex("IDUE:1 APTA:2"));
  });

  it("chains every QR through the previous hash, in index order", () => {
    const h1 = sha512Hex("A:1");
    const h2 = sha512Hex(`A:1 HASH:${h1} B:2`);
    const h3 = sha512Hex(`A:1 HASH:${h1} B:2 HASH:${h2} C:3`);
    expect(chainedBuHash([bu(3, 3, "C:3"), bu(1, 3, "A:1"), bu(2, 3, "B:2")])).toBe(h3);
  });
});

function parsed(name: string) {
  const fixture = loadBuFixture(name);
  return {
    parts: fixture.qrbu.map((raw) => parseQr(raw) as BuQr),
    certs: fixture.qrce.map((raw) => parseQr(raw) as CertQr),
  };
}

function expectBuError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(BuError);
    expect((error as BuError).code).toBe(code);
    return;
  }
  expect.fail(`expected BuError ${code}`);
}

const ED521 = "df-97012-11-178"; // MDUE 2020, Ed521 urna cert issued by AC UE2020
const P521 = "zz-29386-1-1709"; // MDUE 2013, P-521 urna cert issued by AC URNA

describe("verifyBuSignature", () => {
  it("has signed fixtures for both urna certificate families", () => {
    const withCerts = loadBuFixtures().filter((f) => f.qrce.length > 0);
    expect(withCerts.length).toBe(12);
  });

  it.each(
    loadBuFixtures()
      .filter((f) => f.qrce.length > 0)
      .map((f) => f.name),
  )("accepts the real BU %s", (name) => {
    const { parts, certs } = parsed(name);
    expect(() => verifyBuSignature(parts, certs, TSE_ROOTS)).not.toThrow();
  });

  it("reports Ed521 and the AC UE2020 issuer for an MDUE 2020 urna", () => {
    const { parts, certs } = parsed(ED521);
    expect(verifyBuSignature(parts, certs, TSE_ROOTS)).toEqual({
      algorithm: "ed521",
      root: "AC UE2020",
    });
  });

  it("reports ECDSA P-521 and the AC URNA issuer for an MDUE 2013 urna", () => {
    const { parts, certs } = parsed(P521);
    expect(verifyBuSignature(parts, certs, TSE_ROOTS)).toEqual({
      algorithm: "ecdsa-p521",
      root: "AC URNA",
    });
  });

  it.each([ED521, P521])("rejects a tampered vote count in %s", (name) => {
    const { parts, certs } = parsed(name);
    const tampered = {
      ...parts[0]!,
      content: parts[0]!.content.replace(/APTA:(\d)/, (_, d) => `APTA:${(Number(d) + 1) % 10}`),
    };
    expectBuError(() => verifyBuSignature([tampered], certs, TSE_ROOTS), "HASH_MISMATCH");
  });

  it.each([ED521, P521])("rejects a HASH re-signed by nobody in %s", (name) => {
    const { parts, certs } = parsed(name);
    const last = parts.at(-1)!;
    const flipped = last.assi!.slice(0, -2) + (last.assi!.endsWith("00") ? "01" : "00");
    expectBuError(
      () => verifyBuSignature([{ ...last, assi: flipped }], certs, TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("checks the final HASH of a multi-QR BU against the whole chain", () => {
    const { parts, certs } = parsed(ED521);
    const first = bu(1, 2, "A:1", sha512Hex("A:1"));
    const second = { ...parts[0]!, index: 2, total: 2 };
    expectBuError(() => verifyBuSignature([first, second], certs, TSE_ROOTS), "HASH_MISMATCH");
  });

  it("requires ASSI on the BU", () => {
    const { parts, certs } = parsed(ED521);
    const { assi, ...unsigned } = parts[0]!;
    expectBuError(() => verifyBuSignature([unsigned], certs, TSE_ROOTS), "SIGNATURE_MISSING");
  });

  it("requires the urna certificate QRs", () => {
    const { parts } = parsed(ED521);
    expectBuError(() => verifyBuSignature(parts, [], TSE_ROOTS), "CERT_MISSING");
  });

  it("requires every certificate part", () => {
    const { parts, certs } = parsed(ED521);
    expectBuError(
      () => verifyBuSignature(parts, certs.slice(0, 1), TSE_ROOTS),
      "QR_SET_INCOMPLETE",
    );
  });

  it("rejects the certificate of a different urna", () => {
    const { parts } = parsed(P521);
    const { certs } = parsed("zz-29386-1-1710");
    expectBuError(() => verifyBuSignature(parts, certs, TSE_ROOTS), "CERT_URNA_MISMATCH");
  });

  it.each([ED521, P521])("rejects a certificate not issued by a pinned TSE root (%s)", (name) => {
    const { parts, certs } = parsed(name);
    expectBuError(() => verifyBuSignature(parts, certs, []), "CERT_INVALID");
  });

  it("rejects certificate bytes that are not X.509", () => {
    const { parts, certs } = parsed(ED521);
    const junk = certs.map((c) => ({ ...c, cert: "DEADBEEF" }));
    expectBuError(() => verifyBuSignature(parts, junk, TSE_ROOTS), "CERT_INVALID");
  });
});
