// What the client sends once every BU and certificate QR is scanned: only the signed data and its final
// HASH. The server rebuilds each QR (header, chained HASH, ASSI) from it, so intermediate hashes never
// cross the wire and no verification result or total is accepted from the client.
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import * as v from "valibot";

import { assembleBu, type Bu } from "./assemble";
import { BuError } from "./errors";
import { parseQr, type BuQr, type CertQr } from "./parse";
import type { TrustedRoot } from "./tse-roots";
import {
  assembleCertificate,
  chainHashes,
  verifyBuWithCertificate,
  type SignatureVerification,
} from "./verify";

const HEX = /^(?:[0-9A-Fa-f]{2})+$/;
const hex = (maxLength: number) => v.pipe(v.string(), v.maxLength(maxLength), v.regex(HEX));

const SubmissionSchema = v.object({
  // Boundaries matter: the chained HASH is inserted between consecutive QR contents.
  contents: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(1100))),
    v.minLength(1),
    v.maxLength(64),
  ),
  assi: hex(512),
  hash: v.pipe(v.string(), v.regex(/^[0-9A-Fa-f]{128}$/)),
  certDer: hex(8192),
});
const SUBMISSION_KEYS = new Set(["contents", "assi", "hash", "certDer"]);

export type BuSubmission = v.InferOutput<typeof SubmissionSchema>;

export interface VerifiedSubmission {
  bu: Bu;
  hash: string;
  signature: SignatureVerification;
}

/** Client side: build the payload once every QR is scanned (and verifyBuSignature has passed). */
export function toSubmission(parts: BuQr[], certs: CertQr[]): BuSubmission {
  const sorted = [...parts].sort((a, b) => a.index - b.index);
  const last = sorted.at(-1);
  if (!last?.assi) throw new BuError("SIGNATURE_MISSING", "BU has no ASSI");
  return {
    contents: sorted.map((part) => part.content.trimEnd()),
    assi: last.assi,
    hash: last.hash.toUpperCase(),
    certDer: bytesToHex(assembleCertificate(certs).der),
  };
}

/** Rebuilds the QRs exactly as the urna printed them, so the regular parser validates every part. */
function rebuildParts({ contents, assi }: BuSubmission): BuQr[] {
  const hashes = chainHashes(contents);
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

/** Server side: validate shape, rebuild, verify the signature chain, then assemble the BU. */
export function verifySubmission(input: unknown, roots: TrustedRoot[]): VerifiedSubmission {
  if (typeof input === "object" && input !== null) {
    const extra = Object.keys(input).find((key) => !SUBMISSION_KEYS.has(key));
    if (extra) throw new BuError("UNEXPECTED_FIELD", `unexpected field ${extra}`);
  }
  const parsed = v.safeParse(SubmissionSchema, input);
  if (!parsed.success) throw new BuError("INVALID_FIELD", v.summarize(parsed.issues));

  const parts = rebuildParts(parsed.output);
  const hash = parts.at(-1)!.hash;
  if (hash !== parsed.output.hash.toUpperCase()) {
    throw new BuError("HASH_MISMATCH", "submitted HASH does not match the submitted contents");
  }
  const signature = verifyBuWithCertificate(parts, hexToBytes(parsed.output.certDer), roots);
  return { bu: assembleBu(parts), hash, signature };
}
