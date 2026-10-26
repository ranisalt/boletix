// Verifies a 2026 BU against the urna certificate printed in its QRCE codes, following the official
// "Boletim na Mão" app: HASH must match the content, the urna certificate must be signed by a pinned
// TSE CA (trusted directly, expiry not enforced), and ASSI must sign sha512(HASH bytes).
import { p521 } from "@noble/curves/nist.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { AsnConvert } from "@peculiar/asn1-schema";
import { Certificate } from "@peculiar/asn1-x509";

import { BuError } from "../errors";
import type { BuQr, CertQr } from "../format/parse";
import { verifyEd521 } from "./ed521";
import type { TrustedRoot } from "./tse-roots";

export type SignatureAlgorithm = "ed521" | "ecdsa-p521";

export interface SignatureVerification {
  algorithm: SignatureAlgorithm;
  root: string;
}

// Ed521 has no standard OID; this private arc is the one TSE uses.
const ALGORITHM_BY_SPKI_OID: Record<string, SignatureAlgorithm> = {
  "1.3.6.1.4.1.44588.2.1": "ed521",
  "1.2.840.10045.2.1": "ecdsa-p521",
};

interface ParsedCert {
  tbs: Uint8Array;
  signature: Uint8Array;
  algorithm: SignatureAlgorithm;
  publicKey: Uint8Array;
  commonName: string | undefined;
}

const COMMON_NAME_OID = "2.5.4.3";

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function parseCertificate(der: Uint8Array): ParsedCert {
  // asn1-schema reads the whole backing ArrayBuffer, so hand it an exact copy.
  const certificate = AsnConvert.parse(new Uint8Array(der), Certificate);
  const spki = certificate.tbsCertificate.subjectPublicKeyInfo;
  const algorithm = ALGORITHM_BY_SPKI_OID[spki.algorithm.algorithm];
  if (!algorithm)
    throw new BuError("UNSUPPORTED_ALGORITHM", `key algorithm ${spki.algorithm.algorithm}`);
  const commonName = certificate.tbsCertificate.subject
    .flatMap((rdn) => [...rdn])
    .find((attribute) => attribute.type === COMMON_NAME_OID)
    ?.value.toString();
  return {
    tbs: new Uint8Array(AsnConvert.serialize(certificate.tbsCertificate)),
    signature: new Uint8Array(certificate.signatureValue),
    algorithm,
    publicKey: new Uint8Array(spki.subjectPublicKey),
    commonName,
  };
}

/** The urna CERT may be printed as DER (MDUE 2013/2015) or as PEM text (MDUE 2020+). */
function decodeCertBytes(bytes: Uint8Array): Uint8Array {
  const pem = new TextDecoder().decode(bytes);
  if (!pem.startsWith("-----BEGIN CERTIFICATE-----")) return bytes;
  const body = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/.exec(pem)?.[1];
  if (!body) throw new BuError("CERT_INVALID", "malformed PEM certificate");
  return base64ToBytes(body.replace(/\s+/g, ""));
}

function verifyWith(
  algorithm: SignatureAlgorithm,
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  if (algorithm === "ed521") return verifyEd521(signature, message, publicKey);
  try {
    // Like the TSE app, ECDSA is given the message as an already-computed SHA-512 digest.
    return p521.verify(signature, message, publicKey, {
      prehash: false,
      format: "der",
      lowS: false,
    });
  } catch {
    return false;
  }
}

/** Leaf signatures: Ed521 roots sign the raw TBS bytes; ECDSA roots use ecdsa-with-SHA512. */
function findIssuingRoot(leaf: ParsedCert, roots: TrustedRoot[]): string | undefined {
  for (const root of roots) {
    const der = base64ToBytes(root.derBase64);
    if (bytesToHex(sha256(der)) !== root.sha256) {
      throw new Error(`pinned root ${root.name} does not match its sha256`);
    }
    const issuer = parseCertificate(der);
    const message = issuer.algorithm === "ecdsa-p521" ? sha512(leaf.tbs) : leaf.tbs;
    if (verifyWith(issuer.algorithm, issuer.publicKey, message, leaf.signature)) return root.name;
  }
  return undefined;
}

/** Joins the QRCE parts into the urna certificate as DER, whether it was printed as DER or PEM. */
export function assembleCertificate(certs: CertQr[]): { der: Uint8Array; idue: string } {
  if (certs.length === 0)
    throw new BuError("CERT_MISSING", "urna certificate QR codes are required");
  const total = certs[0]!.total;
  const sorted = [...certs].sort((a, b) => a.index - b.index);
  const complete =
    sorted.length === total && sorted.every((c, i) => c.index === i + 1 && c.total === total);
  if (!complete) throw new BuError("QR_SET_INCOMPLETE", `certificate needs ${total} QR codes`);
  const idue = sorted[0]!.idue;
  if (sorted.some((c) => c.idue !== idue)) {
    throw new BuError("QR_SET_MIXED", "certificate QR codes from different urnas");
  }
  return { der: decodeCertBytes(hexToBytes(sorted.map((c) => c.cert).join(""))), idue };
}

function buIdue(parts: BuQr[]): string | undefined {
  for (const part of parts) {
    const idue = part.tokens.find(([key]) => key === "IDUE")?.[1];
    if (idue) return idue;
  }
  return undefined;
}

const sha512Hex = (text: string) =>
  bytesToHex(sha512(new TextEncoder().encode(text))).toUpperCase();

/**
 * HASH of each QR of a BU, as the TSE app computes it: in order, each QR's content is appended to the
 * previous text as `<previous text> HASH:<previous hash> <content>` and re-hashed. The last one is signed.
 */
export function chainHashes(contents: string[]): string[] {
  let text: string | undefined;
  let hash = "";
  return contents.map((untrimmed) => {
    const content = untrimmed.trimEnd();
    text = text === undefined ? content : `${text} HASH:${hash} ${content}`;
    hash = sha512Hex(text);
    return hash;
  });
}

/** The hash the urna signed: the chain value of the last QR. */
export function chainedBuHash(parts: BuQr[]): string {
  return (
    chainHashes([...parts].sort((a, b) => a.index - b.index).map((part) => part.content)).at(-1) ??
    ""
  );
}

/** Full check from scanned QRs: assembles the certificate, then {@link verifyBuWithCertificate}. */
export function verifyBuSignature(
  parts: BuQr[],
  certs: CertQr[],
  roots: TrustedRoot[],
): SignatureVerification {
  if (parts.length === 0) throw new BuError("QR_SET_INCOMPLETE", "no BU QR codes");
  const { der, idue } = assembleCertificate(certs);
  if (idue !== buIdue(parts))
    throw new BuError("CERT_URNA_MISMATCH", "certificate belongs to another urna");
  return verifyBuWithCertificate(parts, der, roots);
}

/** Verifies HASH, the urna certificate (issuer and CN `UEAO0<IDUE>`) and ASSI, given the certificate DER. */
export function verifyBuWithCertificate(
  parts: BuQr[],
  der: Uint8Array,
  roots: TrustedRoot[],
): SignatureVerification {
  const last = [...parts].sort((a, b) => a.index - b.index).at(-1);
  if (!last) throw new BuError("QR_SET_INCOMPLETE", "no BU QR codes");
  if (chainedBuHash(parts) !== last.hash.toUpperCase()) {
    throw new BuError("HASH_MISMATCH", "BU content does not match HASH");
  }
  if (!last.assi) throw new BuError("SIGNATURE_MISSING", "BU has no ASSI");

  let leaf: ParsedCert;
  try {
    leaf = parseCertificate(der);
  } catch (error) {
    if (error instanceof BuError) throw error;
    throw new BuError("CERT_INVALID", "urna certificate is not X.509");
  }
  // Leaf CNs seen: `UEAO0<IDUE>` (UE2020) and `ueao0<IDUE>` (AC URNA).
  if (leaf.commonName?.toUpperCase() !== `UEAO0${buIdue(parts)}`) {
    throw new BuError("CERT_URNA_MISMATCH", "certificate subject is another urna");
  }
  const root = findIssuingRoot(leaf, roots);
  if (!root) throw new BuError("CERT_INVALID", "urna certificate was not issued by a TSE root");

  const message = sha512(hexToBytes(last.hash));
  if (!verifyWith(leaf.algorithm, leaf.publicKey, message, hexToBytes(last.assi))) {
    throw new BuError("SIGNATURE_INVALID", "ASSI does not match HASH under the urna certificate");
  }
  return { algorithm: leaf.algorithm, root };
}
