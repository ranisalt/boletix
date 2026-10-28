import { sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import { type BuQr, MAX_QR_CODES } from "./format/parse";
import { TSE_ROOTS } from "./signature/tse-roots";
import { chainHashes } from "./signature/verify";
import { openSubmission, sealSubmission, type BuSubmission } from "./submission";
import { expectBuError, loadBuFixtures, loadBuScan } from "./testing/fixtures";

/** What an attacker would do: alter the contents and send their recomputed HASH. */
function withContents(submission: BuSubmission, contents: string[]): BuSubmission {
  return { ...submission, contents, hash: chainHashes(contents).at(-1)! };
}

function submissionFor(name: string): BuSubmission {
  const { parts, certs } = loadBuScan(name);
  return sealSubmission(parts, certs, TSE_ROOTS).submission;
}

const sha512Hex = (text: string) =>
  bytesToHex(sha512(new TextEncoder().encode(text))).toUpperCase();

const ED521 = "df-97012-11-178";
const ECDSA = "zz-29386-1-1709";

describe("sealSubmission", () => {
  it("has signed fixtures for both urna certificate families", () => {
    const withCerts = loadBuFixtures().filter((f) => f.qrce.length > 0);
    expect(withCerts.length).toBe(12);
  });

  it("sends only each QR content, the final HASH, the ASSI and the certificate as DER hex", () => {
    const { parts } = loadBuScan(ECDSA);
    const submission = submissionFor(ECDSA);

    expect(Object.keys(submission).sort()).toEqual(["assi", "certDer", "contents", "hash"]);
    expect(submission.contents).toEqual([parts[0]!.content.trimEnd()]);
    expect(submission.hash).toBe(parts[0]!.hash.toUpperCase());
    expect(submission.assi).toBe(parts[0]!.assi);
    expect(submission.certDer).toMatch(/^30[0-9a-f]+$/);
  });

  it("converts a PEM-printed certificate to DER", () => {
    expect(submissionFor(ED521).certDer).toMatch(/^30[0-9a-f]+$/);
  });

  it("returns what the server will open from the submission", () => {
    const { parts, certs } = loadBuScan(ED521);
    const { submission, ...sealed } = sealSubmission(parts, certs, TSE_ROOTS);
    expect(sealed).toEqual(openSubmission(JSON.parse(JSON.stringify(submission)), TSE_ROOTS));
  });

  it("requires a BU QR", () => {
    const { certs } = loadBuScan(ED521);
    expectBuError(() => sealSubmission([], certs, TSE_ROOTS), "QR_SET_INCOMPLETE");
  });

  it.each(
    loadBuFixtures()
      .filter((f) => f.qrce.length > 0)
      .map((f) => f.name),
  )("accepts the real BU %s", (name) => {
    const { parts, certs } = loadBuScan(name);
    expect(() => sealSubmission(parts, certs, TSE_ROOTS)).not.toThrow();
  });

  it("reports Ed521 and the AC UE2020 issuer for an MDUE 2020 urna", () => {
    const { parts, certs } = loadBuScan(ED521);
    expect(sealSubmission(parts, certs, TSE_ROOTS).signature).toEqual({
      algorithm: "ed521",
      root: "AC UE2020",
    });
  });

  it("reports ECDSA P-521 and the AC URNA issuer for an MDUE 2013 urna", () => {
    const { parts, certs } = loadBuScan(ECDSA);
    expect(sealSubmission(parts, certs, TSE_ROOTS).signature).toEqual({
      algorithm: "ecdsa-p521",
      root: "AC URNA",
    });
  });

  it.each([ED521, ECDSA])("rejects a tampered vote count in %s", (name) => {
    const { parts, certs } = loadBuScan(name);
    const tampered = {
      ...parts[0]!,
      content: parts[0]!.content.replace(/APTA:(\d)/, (_, d) => `APTA:${(Number(d) + 1) % 10}`),
    };
    expectBuError(() => sealSubmission([tampered], certs, TSE_ROOTS), "HASH_MISMATCH");
  });

  it.each([ED521, ECDSA])("rejects an ASSI that does not sign HASH in %s", (name) => {
    const { parts, certs } = loadBuScan(name);
    const last = parts.at(-1)!;
    const flipped = last.assi!.slice(0, -2) + (last.assi!.endsWith("00") ? "01" : "00");
    expectBuError(
      () => sealSubmission([{ ...last, assi: flipped }], certs, TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("checks the final HASH of a multi-QR BU against the whole chain", () => {
    const { parts, certs } = loadBuScan(ED521);
    const first: BuQr = { ...parts[0]!, index: 1, total: 2, hash: sha512Hex(parts[0]!.content) };
    const second = { ...parts[0]!, index: 2, total: 2 };
    expectBuError(() => sealSubmission([first, second], certs, TSE_ROOTS), "HASH_MISMATCH");
  });

  it("requires ASSI on the BU", () => {
    const { parts, certs } = loadBuScan(ED521);
    const { assi, ...unsigned } = parts[0]!;
    expectBuError(() => sealSubmission([unsigned], certs, TSE_ROOTS), "SIGNATURE_MISSING");
  });

  it("requires the urna certificate QRs", () => {
    const { parts } = loadBuScan(ED521);
    expectBuError(() => sealSubmission(parts, [], TSE_ROOTS), "CERT_MISSING");
  });

  it("requires every certificate part", () => {
    const { parts, certs } = loadBuScan(ED521);
    expectBuError(() => sealSubmission(parts, certs.slice(0, 1), TSE_ROOTS), "QR_SET_INCOMPLETE");
  });

  it("rejects the certificate of a different urna", () => {
    const { parts } = loadBuScan(ECDSA);
    const { certs } = loadBuScan("zz-29386-1-1710");
    expectBuError(() => sealSubmission(parts, certs, TSE_ROOTS), "CERT_URNA_MISMATCH");
  });

  it.each([ED521, ECDSA])("rejects a certificate not issued by a pinned TSE root (%s)", (name) => {
    const { parts, certs } = loadBuScan(name);
    expectBuError(() => sealSubmission(parts, certs, []), "CERT_INVALID");
  });

  it("rejects certificate bytes that are not X.509", () => {
    const { parts, certs } = loadBuScan(ED521);
    const junk = certs.map((c) => ({ ...c, cert: "DEADBEEF" }));
    expectBuError(() => sealSubmission(parts, junk, TSE_ROOTS), "CERT_INVALID");
  });
});

describe("openSubmission", () => {
  it.each(
    loadBuFixtures()
      .filter((f) => f.qrce.length > 0)
      .map((f) => f.name),
  )("accepts the real BU %s and returns the assembled BU", (name) => {
    const { parts } = loadBuScan(name);
    const result = openSubmission(submissionFor(name), TSE_ROOTS);

    expect(result.hash).toBe(parts.at(-1)!.hash.toUpperCase());
    expect(result.bu.header.urna).toBe(parts[0]!.tokens.find(([key]) => key === "IDUE")?.[1]);
    expect(result.signature.algorithm).toMatch(/^(ed521|ecdsa-p521)$/);
  });

  it("survives a JSON round trip", () => {
    const wire = JSON.parse(JSON.stringify(submissionFor(ED521)));
    expect(openSubmission(wire, TSE_ROOTS).signature.algorithm).toBe("ed521");
  });

  it("rejects client-supplied fields beyond the signed data", () => {
    expectBuError(
      () => openSubmission({ ...submissionFor(ECDSA), verified: true }, TSE_ROOTS),
      "UNEXPECTED_FIELD",
    );
    expectBuError(
      () => openSubmission({ ...submissionFor(ECDSA), votes: { "13": 1 } }, TSE_ROOTS),
      "UNEXPECTED_FIELD",
    );
  });

  it("rejects a HASH that does not match the submitted contents", () => {
    expectBuError(
      () => openSubmission({ ...submissionFor(ECDSA), hash: "A".repeat(128) }, TSE_ROOTS),
      "HASH_MISMATCH",
    );
  });

  it("rejects malformed payloads", () => {
    const valid = submissionFor(ECDSA);
    for (const bad of [
      null,
      "x",
      { ...valid, contents: [] },
      { ...valid, contents: "ORIG:VOTA" },
      { ...valid, contents: Array.from({ length: MAX_QR_CODES + 1 }, () => "ORIG:VOTA") },
      { ...valid, assi: "not hex" },
      { ...valid, hash: "ABC" },
      { ...valid, certDer: "" },
      { assi: valid.assi, certDer: valid.certDer },
    ]) {
      expectBuError(() => openSubmission(bad, TSE_ROOTS), "INVALID_FIELD");
    }
  });

  it("rejects altered vote content as a bad signature", () => {
    const valid = submissionFor(ECDSA);
    const content = valid.contents[0]!.replace(
      /APTA:(\d+)/,
      (_: string, n: string) => `APTA:${Number(n) + 1}`,
    );
    expect(content).not.toBe(valid.contents[0]);
    expectBuError(
      () => openSubmission(withContents(valid, [content]), TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("rejects content split at boundaries the urna did not print", () => {
    const valid = submissionFor(ECDSA);
    const tokens = valid.contents[0]!.split(" ");
    const half = Math.floor(tokens.length / 2);
    const resplit = [tokens.slice(0, half).join(" "), tokens.slice(half).join(" ")];
    expectBuError(
      () => openSubmission(withContents(valid, resplit), TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("rejects another urna's certificate", () => {
    const valid = submissionFor(ECDSA);
    const other = submissionFor("zz-29386-1-1710");
    expectBuError(
      () => openSubmission({ ...valid, certDer: other.certDer }, TSE_ROOTS),
      "CERT_URNA_MISMATCH",
    );
  });

  it("rejects a certificate that is not issued by a pinned TSE root", () => {
    expectBuError(() => openSubmission(submissionFor(ECDSA), []), "CERT_INVALID");
  });

  it("rejects a certificate that is not X.509", () => {
    expectBuError(
      () => openSubmission({ ...submissionFor(ECDSA), certDer: "3003020101" }, TSE_ROOTS),
      "CERT_INVALID",
    );
  });
});
