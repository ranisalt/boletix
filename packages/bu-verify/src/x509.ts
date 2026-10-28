import { AsnConvert } from "@peculiar/asn1-schema";
import { Certificate } from "@peculiar/asn1-x509";

import { VerificationError } from "./errors.ts";

export type SignatureAlgorithm = "ed521" | "ecdsa-p521";

export type ParsedCertificate = {
  /** The DER of tbsCertificate: what the issuer signed. */
  tbs: Uint8Array<ArrayBuffer>;
  /** The issuer's signature over `tbs`. */
  signature: Uint8Array;
  algorithm: SignatureAlgorithm;
  /** The subjectPublicKey bits: the raw key (Ed521). */
  publicKey: Uint8Array;
  /** The whole SubjectPublicKeyInfo DER, as WebCrypto imports it (ECDSA). */
  spki: Uint8Array<ArrayBuffer>;
  commonName: string | undefined;
};

// Ed521 has no standard OID; this private arc is the one TSE uses.
const ALGORITHM_BY_SPKI_OID: Readonly<Record<string, SignatureAlgorithm>> = {
  "1.3.6.1.4.1.44588.2.1": "ed521",
  "1.2.840.10045.2.1": "ecdsa-p521",
};

const COMMON_NAME_OID = "2.5.4.3";

function parseX509(der: Uint8Array): Certificate {
  try {
    // asn1-schema reads the whole backing ArrayBuffer, so hand it an exact copy.
    return AsnConvert.parse(der.slice(), Certificate);
  } catch {
    throw new VerificationError("CERT_INVALID", "certificate is not X.509 DER");
  }
}

export function parseCertificate(der: Uint8Array): ParsedCertificate {
  const certificate = parseX509(der);
  const spki = certificate.tbsCertificate.subjectPublicKeyInfo;
  const algorithm = ALGORITHM_BY_SPKI_OID[spki.algorithm.algorithm];
  if (!algorithm) {
    throw new VerificationError(
      "UNSUPPORTED_ALGORITHM",
      `key algorithm ${spki.algorithm.algorithm}`,
    );
  }
  const commonName = certificate.tbsCertificate.subject
    .flatMap((rdn) => [...rdn])
    .find((attribute) => attribute.type === COMMON_NAME_OID)
    ?.value.toString();
  return {
    tbs: new Uint8Array(AsnConvert.serialize(certificate.tbsCertificate)),
    signature: new Uint8Array(certificate.signatureValue),
    algorithm,
    publicKey: new Uint8Array(spki.subjectPublicKey),
    spki: new Uint8Array(AsnConvert.serialize(spki)),
    commonName,
  };
}
