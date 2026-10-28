import { BuError } from "./errors.ts";
import { hexToBytes } from "./hex.ts";
import type { CertQr } from "./parse.ts";

const PEM_BEGIN = "-----BEGIN CERTIFICATE-----";

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// The CERT field carries either DER or a PEM text, both hex-encoded.
function decodeCertBytes(bytes: Uint8Array): Uint8Array {
  const pem = new TextDecoder().decode(bytes);
  if (!pem.startsWith(PEM_BEGIN)) return bytes;
  const body = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/.exec(pem)?.[1];
  if (body === undefined) throw new BuError("CERT_INVALID", "malformed PEM certificate");
  return base64ToBytes(body.replace(/\s+/g, ""));
}

/**
 * Joins the QRCE set of one urna (indices 1..total, all with the same IDUE) and returns the DER
 * bytes of its X.509 certificate.
 */
export function assembleCertificate(certs: readonly CertQr[]): Uint8Array {
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
  return decodeCertBytes(hexToBytes(sorted.map((c) => c.cert).join("")));
}
