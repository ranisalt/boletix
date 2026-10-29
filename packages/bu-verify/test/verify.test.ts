import { BuError } from "@boletix/bu-qr";
import { AsnConvert } from "@peculiar/asn1-schema";
import { Certificate } from "@peculiar/asn1-x509";
import { describe, expect, it } from "vitest";

import { type TrustedRoot, verifyBu } from "../src/index.ts";
import { TSE_ROOTS } from "../src/roots.ts";
import { ECDSA, ED521, expectVerificationError, loadSigned, SIGNED_FIXTURES } from "./fixtures.ts";

function flipLastByte(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice();
  copy[copy.length - 1]! ^= 1;
  return copy;
}

describe("verifyBu", () => {
  it.each(SIGNED_FIXTURES)("verifies the real BU %s", async (name) => {
    const { bu, certificate } = await loadSigned(name);
    const result = await verifyBu(bu, certificate, TSE_ROOTS);
    expect(result.algorithm).toMatch(/^(ed521|ecdsa-p521)$/);
  });

  it("reports Ed521 and the AC UE2020 issuer for an MDUE 2020 urna", async () => {
    const { bu, certificate } = await loadSigned(ED521);
    expect(await verifyBu(bu, certificate, TSE_ROOTS)).toEqual({
      algorithm: "ed521",
      root: "AC UE2020",
    });
  });

  it("reports ECDSA P-521 and the AC URNA issuer for an MDUE 2013 urna", async () => {
    const { bu, certificate } = await loadSigned(ECDSA);
    expect(await verifyBu(bu, certificate, TSE_ROOTS)).toEqual({
      algorithm: "ecdsa-p521",
      root: "AC URNA",
    });
  });

  it.each([ED521, ECDSA])("rejects an ASSI that does not sign HASH in %s", async (name) => {
    const { bu, certificate } = await loadSigned(name);
    await expectVerificationError(
      async () => verifyBu({ ...bu, assi: flipLastByte(bu.assi!) }, certificate, TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it.each([ED521, ECDSA])("rejects a HASH the ASSI does not sign in %s", async (name) => {
    const { bu, certificate } = await loadSigned(name);
    const hash = bu.hash.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
    await expectVerificationError(
      async () => verifyBu({ ...bu, hash }, certificate, TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it.each([ED521, ECDSA])("accepts a lowercased HASH in %s", async (name) => {
    const { bu, certificate } = await loadSigned(name);
    await expect(
      verifyBu({ ...bu, hash: bu.hash.toLowerCase() }, certificate, TSE_ROOTS),
    ).resolves.toMatchObject({ root: expect.any(String) });
  });

  it.each([ED521, ECDSA])("rejects a HASH that is not whole hex bytes in %s", async (name) => {
    const { bu, certificate } = await loadSigned(name);
    const thrown = await verifyBu({ ...bu, hash: `${bu.hash}0` }, certificate, TSE_ROOTS).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(BuError);
    expect((thrown as BuError).code).toBe("INVALID_FIELD");
  });

  it.each([ED521, ECDSA])(
    "treats a malformed ASSI as invalid, not as a crash, in %s",
    async (name) => {
      const { bu, certificate } = await loadSigned(name);
      const malformed = [bu.assi!.subarray(1), new Uint8Array(0), new Uint8Array(200)];
      await Promise.all(
        malformed.map(async (assi) =>
          expectVerificationError(
            async () => verifyBu({ ...bu, assi }, certificate, TSE_ROOTS),
            "SIGNATURE_INVALID",
          ),
        ),
      );
    },
  );

  it("requires ASSI before looking at the certificate", async () => {
    const { bu } = await loadSigned(ED521);
    const { assi: _, ...unsigned } = bu;
    await expectVerificationError(
      async () => verifyBu(unsigned, new Uint8Array([0xde, 0xad]), TSE_ROOTS),
      "SIGNATURE_MISSING",
    );
  });

  it("rejects the certificate of a different urna", async () => {
    const { bu } = await loadSigned(ECDSA);
    const { certificate } = await loadSigned("zz-29386-1-1710");
    await expectVerificationError(
      async () => verifyBu(bu, certificate, TSE_ROOTS),
      "CERT_URNA_MISMATCH",
    );
  });

  it.each([ED521, ECDSA])(
    "rejects a certificate not issued by a pinned root (%s)",
    async (name) => {
      const { bu, certificate } = await loadSigned(name);
      await expectVerificationError(async () => verifyBu(bu, certificate, []), "CERT_INVALID");
    },
  );

  it("rejects an Ed521 certificate presented under the ECDSA root alone, and vice versa", async () => {
    const ed = await loadSigned(ED521);
    const ec = await loadSigned(ECDSA);
    const acUrna = TSE_ROOTS.filter((root) => root.name === "AC URNA");
    const ue2020 = TSE_ROOTS.filter((root) => root.name === "AC UE2020");
    await expectVerificationError(
      async () => verifyBu(ed.bu, ed.certificate, acUrna),
      "CERT_INVALID",
    );
    await expectVerificationError(
      async () => verifyBu(ec.bu, ec.certificate, ue2020),
      "CERT_INVALID",
    );
  });

  it("rejects certificate bytes that are not X.509", async () => {
    const { bu } = await loadSigned(ECDSA);
    const junk = [
      Uint8Array.of(0xde, 0xad, 0xbe, 0xef),
      Uint8Array.of(0x30, 0x03, 0x02, 0x01, 0x01),
    ];
    await Promise.all(
      junk.map(async (certificate) =>
        expectVerificationError(async () => verifyBu(bu, certificate, TSE_ROOTS), "CERT_INVALID"),
      ),
    );
  });

  it("rejects a certificate whose key is neither Ed521 nor ECDSA", async () => {
    const { bu, certificate } = await loadSigned(ED521);
    const parsed = AsnConvert.parse(certificate, Certificate);
    parsed.tbsCertificate.subjectPublicKeyInfo.algorithm.algorithm = "1.3.101.112"; // Ed25519
    const other = new Uint8Array(AsnConvert.serialize(parsed));
    await expectVerificationError(
      async () => verifyBu(bu, other, TSE_ROOTS),
      "UNSUPPORTED_ALGORITHM",
    );
  });

  it("refuses a pinned root whose DER does not match its sha256", async () => {
    const { bu, certificate } = await loadSigned(ED521);
    const [first, ...rest] = TSE_ROOTS;
    const tampered: TrustedRoot = { ...first!, sha256: "00".repeat(32) };
    await expect(verifyBu(bu, certificate, [tampered, ...rest])).rejects.toThrow(/sha256/);
  });

  it("reads the certificate from a view with a non-zero byteOffset", async () => {
    const { bu, certificate } = await loadSigned(ECDSA);
    const padded = new Uint8Array(certificate.length + 7);
    padded.set(certificate, 7);
    const result = await verifyBu(bu, padded.subarray(7), TSE_ROOTS);
    expect(result.root).toBe("AC URNA");
  });
});
