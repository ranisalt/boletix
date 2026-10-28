import { type BuQr, chainHashes, MAX_QR_CODES } from "@boletix/bu-qr";
import { TSE_ROOTS } from "@boletix/bu-verify/roots";
import { describe, expect, it } from "vitest";

import { openSubmission, sealSubmission, type BuSubmission } from "./submission";
import { expectBuError, loadBuFixtures, loadBuScan } from "./testing/fixtures";

/** What an attacker would do: alter the contents and send their recomputed HASH. */
async function withContents(submission: BuSubmission, contents: string[]): Promise<BuSubmission> {
  return { ...submission, contents, hash: (await chainHashes(contents)).at(-1)! };
}

async function submissionFor(name: string): Promise<BuSubmission> {
  const { parts, certs } = loadBuScan(name);
  return (await sealSubmission(parts, certs, TSE_ROOTS)).submission;
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const ED521 = "df-97012-11-178";
const ECDSA = "zz-29386-1-1709";
const SIGNED = loadBuFixtures()
  .filter((f) => f.qrce.length > 0)
  .map((f) => f.name);

describe("sealSubmission", () => {
  it("has signed fixtures for both urna certificate families", () => {
    expect(SIGNED).toHaveLength(12);
  });

  it("sends only each QR content, the final HASH, the ASSI and the certificate as DER hex", async () => {
    const { parts } = loadBuScan(ECDSA);
    const submission = await submissionFor(ECDSA);

    expect(Object.keys(submission).sort()).toEqual(["assi", "certDer", "contents", "hash"]);
    expect(submission.contents).toEqual([parts[0]!.content.trimEnd()]);
    expect(submission.hash).toBe(parts[0]!.hash);
    // ASSI goes as printed: uppercase hex.
    expect(submission.assi).toBe(toHex(parts[0]!.assi!).toUpperCase());
    expect(submission.certDer).toMatch(/^30[0-9a-f]+$/);
  });

  it("converts a PEM-printed certificate to DER", async () => {
    expect((await submissionFor(ED521)).certDer).toMatch(/^30[0-9a-f]+$/);
  });

  it("returns what the server will open from the submission", async () => {
    const { parts, certs } = loadBuScan(ED521);
    const { submission, ...sealed } = await sealSubmission(parts, certs, TSE_ROOTS);
    expect(sealed).toEqual(await openSubmission(JSON.parse(JSON.stringify(submission)), TSE_ROOTS));
  });

  it("requires a BU QR", async () => {
    const { certs } = loadBuScan(ED521);
    await expectBuError(() => sealSubmission([], certs, TSE_ROOTS), "QR_SET_INCOMPLETE");
  });

  it.each(SIGNED)("accepts the real BU %s", async (name) => {
    const { parts, certs } = loadBuScan(name);
    await expect(sealSubmission(parts, certs, TSE_ROOTS)).resolves.toBeDefined();
  });

  it("reports Ed521 and the AC UE2020 issuer for an MDUE 2020 urna", async () => {
    const { parts, certs } = loadBuScan(ED521);
    expect((await sealSubmission(parts, certs, TSE_ROOTS)).signature).toEqual({
      algorithm: "ed521",
      root: "AC UE2020",
    });
  });

  it("reports ECDSA P-521 and the AC URNA issuer for an MDUE 2013 urna", async () => {
    const { parts, certs } = loadBuScan(ECDSA);
    expect((await sealSubmission(parts, certs, TSE_ROOTS)).signature).toEqual({
      algorithm: "ecdsa-p521",
      root: "AC URNA",
    });
  });

  it.each([ED521, ECDSA])("rejects a tampered vote count in %s", async (name) => {
    const { parts, certs } = loadBuScan(name);
    const tampered = {
      ...parts[0]!,
      content: parts[0]!.content.replace(/APTA:(\d)/, (_, d) => `APTA:${(Number(d) + 1) % 10}`),
    };
    await expectBuError(() => sealSubmission([tampered], certs, TSE_ROOTS), "HASH_MISMATCH");
  });

  it.each([ED521, ECDSA])("rejects an ASSI that does not sign HASH in %s", async (name) => {
    const { parts, certs } = loadBuScan(name);
    const last = parts.at(-1)!;
    const flipped = last.assi!.slice();
    flipped[flipped.length - 1]! ^= 1;
    await expectBuError(
      () => sealSubmission([{ ...last, assi: flipped }], certs, TSE_ROOTS),
      "SIGNATURE_INVALID",
    );
  });

  it("checks the final HASH of a multi-QR BU against the whole chain", async () => {
    const { parts, certs } = loadBuScan(ED521);
    const [hash] = (await chainHashes([parts[0]!.content])) as [string];
    const first: BuQr = { ...parts[0]!, index: 1, total: 2, hash };
    const second = { ...parts[0]!, index: 2, total: 2 };
    await expectBuError(() => sealSubmission([first, second], certs, TSE_ROOTS), "HASH_MISMATCH");
  });

  it("requires ASSI on the BU", async () => {
    const { parts, certs } = loadBuScan(ED521);
    const { assi: _, ...unsigned } = parts[0]!;
    await expectBuError(() => sealSubmission([unsigned], certs, TSE_ROOTS), "SIGNATURE_MISSING");
  });

  it("requires the urna certificate QRs", async () => {
    const { parts } = loadBuScan(ED521);
    await expectBuError(() => sealSubmission(parts, [], TSE_ROOTS), "CERT_MISSING");
  });

  it("requires every certificate part", async () => {
    const { parts, certs } = loadBuScan(ED521);
    await expectBuError(
      () => sealSubmission(parts, certs.slice(0, 1), TSE_ROOTS),
      "QR_SET_INCOMPLETE",
    );
  });

  it("rejects the certificate of a different urna", async () => {
    const { parts } = loadBuScan(ECDSA);
    const { certs } = loadBuScan("zz-29386-1-1710");
    await expectBuError(() => sealSubmission(parts, certs, TSE_ROOTS), "CERT_URNA_MISMATCH");
  });

  it.each([ED521, ECDSA])(
    "rejects a certificate not issued by a pinned TSE root (%s)",
    async (name) => {
      const { parts, certs } = loadBuScan(name);
      await expectBuError(() => sealSubmission(parts, certs, []), "CERT_INVALID");
    },
  );

  it("rejects certificate bytes that are not X.509", async () => {
    const { parts, certs } = loadBuScan(ED521);
    const junk = certs.map((c) => ({ ...c, cert: "DEADBEEF" }));
    await expectBuError(() => sealSubmission(parts, junk, TSE_ROOTS), "CERT_INVALID");
  });
});

describe("openSubmission", () => {
  it.each(SIGNED)("accepts the real BU %s and returns the assembled BU", async (name) => {
    const { parts } = loadBuScan(name);
    const result = await openSubmission(await submissionFor(name), TSE_ROOTS);

    expect(result.hash).toBe(parts.at(-1)!.hash);
    expect(result.bu.header.urna).toBe(parts[0]!.tokens.find(([key]) => key === "IDUE")?.[1]);
    expect(result.signature.algorithm).toMatch(/^(ed521|ecdsa-p521)$/);
  });

  it("survives a JSON round trip", async () => {
    const wire = JSON.parse(JSON.stringify(await submissionFor(ED521)));
    expect((await openSubmission(wire, TSE_ROOTS)).signature.algorithm).toBe("ed521");
  });

  it("rejects client-supplied fields beyond the signed data", async () => {
    const valid = await submissionFor(ECDSA);
    await expectBuError(
      () => openSubmission({ ...valid, verified: true }, TSE_ROOTS),
      "UNEXPECTED_FIELD",
    );
    await expectBuError(
      () => openSubmission({ ...valid, votes: { "13": 1 } }, TSE_ROOTS),
      "UNEXPECTED_FIELD",
    );
  });

  it("rejects a HASH that does not match the submitted contents", async () => {
    const valid = await submissionFor(ECDSA);
    await expectBuError(
      () => openSubmission({ ...valid, hash: "A".repeat(128) }, TSE_ROOTS),
      "HASH_MISMATCH",
    );
  });

  it("rejects malformed payloads", async () => {
    const valid = await submissionFor(ECDSA);
    const malformed = [
      null,
      "x",
      { ...valid, contents: [] },
      { ...valid, contents: "ORIG:VOTA" },
      { ...valid, contents: Array.from({ length: MAX_QR_CODES + 1 }, () => "ORIG:VOTA") },
      { ...valid, assi: "not hex" },
      { ...valid, hash: "ABC" },
      { ...valid, certDer: "" },
      { assi: valid.assi, certDer: valid.certDer },
    ];
    await Promise.all(
      malformed.map(async (bad) =>
        expectBuError(() => openSubmission(bad, TSE_ROOTS), "INVALID_FIELD"),
      ),
    );
  });

  it("rejects altered vote content as a bad signature", async () => {
    const valid = await submissionFor(ECDSA);
    const content = valid.contents[0]!.replace(
      /APTA:(\d+)/,
      (_: string, n: string) => `APTA:${Number(n) + 1}`,
    );
    expect(content).not.toBe(valid.contents[0]);
    const altered = await withContents(valid, [content]);
    await expectBuError(() => openSubmission(altered, TSE_ROOTS), "SIGNATURE_INVALID");
  });

  it("rejects content split at boundaries the urna did not print", async () => {
    const valid = await submissionFor(ECDSA);
    const tokens = valid.contents[0]!.split(" ");
    const half = Math.floor(tokens.length / 2);
    const resplit = await withContents(valid, [
      tokens.slice(0, half).join(" "),
      tokens.slice(half).join(" "),
    ]);
    await expectBuError(() => openSubmission(resplit, TSE_ROOTS), "SIGNATURE_INVALID");
  });

  it("rejects another urna's certificate", async () => {
    const valid = await submissionFor(ECDSA);
    const other = await submissionFor("zz-29386-1-1710");
    await expectBuError(
      () => openSubmission({ ...valid, certDer: other.certDer }, TSE_ROOTS),
      "CERT_URNA_MISMATCH",
    );
  });

  it("rejects a certificate that is not issued by a pinned TSE root", async () => {
    const valid = await submissionFor(ECDSA);
    await expectBuError(() => openSubmission(valid, []), "CERT_INVALID");
  });

  it("rejects a certificate that is not X.509", async () => {
    const valid = await submissionFor(ECDSA);
    await expectBuError(
      () => openSubmission({ ...valid, certDer: "3003020101" }, TSE_ROOTS),
      "CERT_INVALID",
    );
  });
});
