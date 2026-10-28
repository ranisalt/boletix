import { type AssembledBu, bytesToHex, hexToBytes } from "@boletix/bu-qr";

import { verifySignature } from "./algorithms.ts";
import { VerificationError } from "./errors.ts";
import { type ParsedCertificate, parseCertificate, type SignatureAlgorithm } from "./x509.ts";

/** A CA certificate trusted directly, pinned by the SHA-256 of its DER. */
export type TrustedRoot = {
  name: string;
  /** Lowercase hex SHA-256 of the DER. */
  sha256: string;
  derBase64: string;
  /** Where the DER came from, for provenance. */
  source: string;
};

export type SignatureVerification = {
  algorithm: SignatureAlgorithm;
  /** `name` of the root that issued the urna certificate. */
  root: string;
};

async function sha(
  algorithm: "SHA-256" | "SHA-512",
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest(algorithm, data));
}

async function loadRoot(root: TrustedRoot): Promise<ParsedCertificate> {
  const der = Uint8Array.from(atob(root.derBase64), (c) => c.charCodeAt(0));
  // A configuration error, not a property of the BU: fail loudly instead of reporting CERT_INVALID.
  if (bytesToHex(await sha("SHA-256", der)) !== root.sha256) {
    throw new Error(`pinned root ${root.name} does not match its sha256`);
  }
  return parseCertificate(der);
}

/** Roots sign the leaf's TBS: Ed521 roots over the raw bytes, ECDSA roots with ecdsa-with-SHA512. */
async function findIssuingRoot(
  leaf: ParsedCertificate,
  roots: readonly TrustedRoot[],
): Promise<string | undefined> {
  for (const root of roots) {
    // Sequential so that a later root is never checked once an earlier one matched.
    // oxlint-disable-next-line no-await-in-loop
    const issuer = await loadRoot(root);
    // oxlint-disable-next-line no-await-in-loop
    if (await verifySignature(issuer.algorithm, issuer, leaf.tbs, leaf.signature)) return root.name;
  }
  return undefined;
}

/**
 * Verifies a BU the way TSE's "Boletim na Mão" app does: the urna certificate must name the BU's
 * urna (CN `UEAO0<IDUE>`) and be issued by one of `roots` (trusted directly; expiry is not
 * checked), and ASSI must sign the BU's HASH under it. Pass `bu` straight from `assembleBu`, which
 * has already checked the HASH chain. Throws `VerificationError`, or bu-qr's `BuError`
 * (`INVALID_FIELD`) when `bu.hash` is not hex.
 */
export async function verifyBu(
  bu: Pick<AssembledBu, "bu" | "hash" | "assi">,
  certificate: Uint8Array,
  roots: readonly TrustedRoot[],
): Promise<SignatureVerification> {
  if (!bu.assi) throw new VerificationError("SIGNATURE_MISSING", "BU has no ASSI");

  const leaf = parseCertificate(certificate);
  // Leaf CNs seen: `UEAO0<IDUE>` (UE2020) and `ueao0<IDUE>` (AC URNA).
  if (leaf.commonName?.toUpperCase() !== `UEAO0${bu.bu.header.urna}`) {
    throw new VerificationError("CERT_URNA_MISMATCH", "certificate subject is another urna");
  }
  const root = await findIssuingRoot(leaf, roots);
  if (!root)
    throw new VerificationError("CERT_INVALID", "certificate was not issued by a trusted root");

  // Ed521 urnas sign sha512(HASH); ECDSA urnas sign HASH with ecdsa-with-SHA512, i.e. the same digest.
  const hash = hexToBytes(bu.hash);
  const message = leaf.algorithm === "ed521" ? await sha("SHA-512", hash) : hash;
  if (!(await verifySignature(leaf.algorithm, leaf, message, bu.assi))) {
    throw new VerificationError(
      "SIGNATURE_INVALID",
      "ASSI does not sign HASH under the urna certificate",
    );
  }
  return { algorithm: leaf.algorithm, root };
}
