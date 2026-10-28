// What the client sends once every BU and certificate QR is scanned: only the signed data and its final
// HASH. The server rebuilds each QR (header, chained HASH, ASSI) from it, so intermediate hashes never
// cross the wire and no verification result or total is accepted from the client.
//
// The client seals by building the payload and opening it itself, so whatever it sends has already
// passed the server's checks. Only a scan too incomplete to build a payload fails earlier, on the phone.
import {
  assembleBu,
  assembleCertificate,
  bytesToHex,
  chainHashes,
  hexToBytes,
  MAX_QR_CHARS,
  MAX_QR_CODES,
  parseQr,
  type Bu,
  type BuQr,
  type CertQr,
} from "@boletix/bu-qr";
import { verifyBu, type SignatureVerification, type TrustedRoot } from "@boletix/bu-verify";
import * as v from "valibot";

import { BuError } from "./errors";

const HEX = /^(?:[0-9A-Fa-f]{2})+$/;
const hex = (maxLength: number) => v.pipe(v.string(), v.maxLength(maxLength), v.regex(HEX));

const SubmissionSchema = v.object({
  // Boundaries matter: the chained HASH is inserted between consecutive QR contents.
  contents: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_QR_CHARS))),
    v.minLength(1),
    v.maxLength(MAX_QR_CODES),
  ),
  assi: hex(512),
  hash: v.pipe(v.string(), v.regex(/^[0-9A-Fa-f]{128}$/)),
  certDer: hex(8192),
});
const SUBMISSION_KEYS = new Set(["contents", "assi", "hash", "certDer"]);

export type BuSubmission = v.InferOutput<typeof SubmissionSchema>;

/** How the server answered a submission it accepted: stored, already held, or clashing with another BU. */
export type SubmitStatus = "new" | "duplicate" | "conflict";

export type VerifiedSubmission = {
  bu: Bu;
  hash: string;
  signature: SignatureVerification;
};

/** Rebuilds the QRs exactly as the urna printed them, so the regular parser validates every part. */
async function rebuildParts({ contents, assi }: BuSubmission): Promise<BuQr[]> {
  const hashes = await chainHashes(contents);
  const total = contents.length;
  return contents.map((content, i) => {
    const signature = i === total - 1 ? ` ASSI:${assi}` : "";
    const parsed = parseQr(
      `QRBU:${i + 1}:${total} VRQR:6.0 ${content} HASH:${hashes[i]}${signature}`,
    );
    if (parsed.kind !== "bu") throw new BuError("INVALID_FIELD", "content is not a BU QR");
    return parsed;
  });
}

/** Server side: validate shape, rebuild and assemble the BU, then verify its signature. */
export async function openSubmission(
  input: unknown,
  roots: readonly TrustedRoot[],
): Promise<VerifiedSubmission> {
  if (typeof input === "object" && input !== null) {
    const extra = Object.keys(input).find((key) => !SUBMISSION_KEYS.has(key));
    if (extra) throw new BuError("UNEXPECTED_FIELD", `unexpected field ${extra}`);
  }
  const parsed = v.safeParse(SubmissionSchema, input);
  if (!parsed.success) throw new BuError("INVALID_FIELD", v.summarize(parsed.issues));

  const assembled = await assembleBu(await rebuildParts(parsed.output));
  if (assembled.hash !== parsed.output.hash.toUpperCase()) {
    throw new BuError("HASH_MISMATCH", "submitted HASH does not match the submitted contents");
  }
  const signature = await verifyBu(assembled, hexToBytes(parsed.output.certDer), roots);
  return { bu: assembled.bu, hash: assembled.hash, signature };
}

/** Client side: build the payload from the scanned QRs and open it as the server will. */
export async function sealSubmission(
  parts: BuQr[],
  certs: CertQr[],
  roots: readonly TrustedRoot[],
): Promise<VerifiedSubmission & { submission: BuSubmission }> {
  const { hash, assi } = await assembleBu(parts);
  const der = assembleCertificate(certs);
  if (!assi) throw new BuError("SIGNATURE_MISSING", "BU has no ASSI");

  const submission = {
    contents: parts.toSorted((a, b) => a.index - b.index).map((part) => part.content.trimEnd()),
    // As printed: ASSI in uppercase hex. The certificate goes as lowercase hex DER.
    assi: bytesToHex(assi).toUpperCase(),
    hash,
    certDer: bytesToHex(der),
  };
  return { submission, ...(await openSubmission(submission, roots)) };
}
