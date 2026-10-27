import { describe, expect, it } from "vitest";

import { MAX_QR_CODES } from "./format/parse";
import { TSE_ROOTS } from "./signature/tse-roots";
import { chainHashes } from "./signature/verify";
import { toSubmission, verifySubmission, type BuSubmission } from "./submission";
import { expectBuError, loadBuFixtures, loadBuScan } from "./testing/fixtures";

/** What an attacker would do: alter the contents and send their recomputed HASH. */
function withContents(submission: BuSubmission, contents: string[]): BuSubmission {
  return { ...submission, contents, hash: chainHashes(contents).at(-1)! };
}

function submissionFor(name: string): BuSubmission {
  const { parts, certs } = loadBuScan(name);
  return toSubmission(parts, certs);
}

const ED521 = "df-97012-11-178";
const ECDSA = "zz-29386-1-1709";

describe("toSubmission", () => {
  it("keeps only each QR content, the final HASH, the ASSI and the certificate as DER hex", () => {
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

  it("refuses to build a submission before every certificate QR is scanned", () => {
    const { parts, certs } = loadBuScan(ECDSA);
    expectBuError(() => toSubmission(parts, certs.slice(1)), "QR_SET_INCOMPLETE");
  });
});

describe("verifySubmission", () => {
  it.each(
    loadBuFixtures()
      .filter((f) => f.qrce.length > 0)
      .map((f) => f.name),
  )("accepts the real BU %s and returns the assembled BU", (name) => {
    const { parts } = loadBuScan(name);
    const result = verifySubmission(submissionFor(name), TSE_ROOTS);

    expect(result.hash).toBe(parts.at(-1)!.hash.toUpperCase());
    expect(result.bu.header.urna).toBe(parts[0]!.tokens.find(([key]) => key === "IDUE")?.[1]);
    expect(result.signature.algorithm).toMatch(/^(ed521|ecdsa-p521)$/);
  });

  it("survives a JSON round trip", () => {
    const wire = JSON.parse(JSON.stringify(submissionFor(ED521)));
    expect(verifySubmission(wire, TSE_ROOTS).signature.algorithm).toBe("ed521");
  });

  it("rejects client-supplied fields beyond the signed data", () => {
    expectBuError(
      () => verifySubmission({ ...submissionFor(ECDSA), verified: true }, TSE_ROOTS),
      "UNEXPECTED_FIELD",
    );
    expectBuError(
      () => verifySubmission({ ...submissionFor(ECDSA), votes: { "13": 1 } }, TSE_ROOTS),
      "UNEXPECTED_FIELD",
    );
  });

  it("rejects a HASH that does not match the submitted contents", () => {
    expectBuError(
      () => verifySubmission({ ...submissionFor(ECDSA), hash: "A".repeat(128) }, TSE_ROOTS),
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
      expectBuError(() => verifySubmission(bad, TSE_ROOTS), "INVALID_FIELD");
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
      () => verifySubmission(withContents(valid, [content]), TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("rejects content split at boundaries the urna did not print", () => {
    const valid = submissionFor(ECDSA);
    const tokens = valid.contents[0]!.split(" ");
    const half = Math.floor(tokens.length / 2);
    const resplit = [tokens.slice(0, half).join(" "), tokens.slice(half).join(" ")];
    expectBuError(
      () => verifySubmission(withContents(valid, resplit), TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("rejects another urna's certificate", () => {
    const valid = submissionFor(ECDSA);
    const other = submissionFor("zz-29386-1-1710");
    expectBuError(
      () => verifySubmission({ ...valid, certDer: other.certDer }, TSE_ROOTS),
      "CERT_URNA_MISMATCH",
    );
  });

  it("rejects a certificate that is not issued by a pinned TSE root", () => {
    expectBuError(() => verifySubmission(submissionFor(ECDSA), []), "CERT_INVALID");
  });

  it("rejects a certificate that is not X.509", () => {
    expectBuError(
      () => verifySubmission({ ...submissionFor(ECDSA), certDer: "3003020101" }, TSE_ROOTS),
      "CERT_INVALID",
    );
  });
});
