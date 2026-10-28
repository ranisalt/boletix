import { ed521 } from "@boletix/ed521";

import type { ParsedCertificate, SignatureAlgorithm } from "./x509.ts";

const P521_SCALAR_BYTES = 66;

/** Reads the DER length at `at`; returns [length, offset of the value] or undefined. */
function readLength(der: Uint8Array, at: number): [number, number] | undefined {
  const first = der[at];
  if (first === undefined) return undefined;
  if (first < 0x80) return [first, at + 1];
  if (first !== 0x81) return undefined; // P-521 signatures never need more than one length byte.
  const length = der[at + 1];
  return length === undefined || length < 0x80 ? undefined : [length, at + 2];
}

/** Reads an INTEGER at `at` into `out` (big-endian, left-padded); returns the next offset. */
function readScalar(der: Uint8Array, at: number, out: Uint8Array): number | undefined {
  if (der[at] !== 0x02) return undefined;
  const header = readLength(der, at + 1);
  if (!header) return undefined;
  const [length, start] = header;
  const end = start + length;
  if (length === 0 || end > der.length) return undefined;
  let value = der.subarray(start, end);
  while (value.length > 1 && value[0] === 0) value = value.subarray(1);
  if (value.length > out.length) return undefined;
  out.set(value, out.length - value.length);
  return end;
}

/**
 * ECDSA-Sig-Value (DER `SEQUENCE { r INTEGER, s INTEGER }`) to the IEEE P1363 `r || s` WebCrypto
 * expects, 66 bytes each for P-521. Returns undefined for anything malformed.
 */
export function derToP1363(der: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (der[0] !== 0x30) return undefined;
  const header = readLength(der, 1);
  if (!header || header[0] + header[1] !== der.length) return undefined;
  const out = new Uint8Array(2 * P521_SCALAR_BYTES);
  const afterR = readScalar(der, header[1], out.subarray(0, P521_SCALAR_BYTES));
  if (afterR === undefined) return undefined;
  const afterS = readScalar(der, afterR, out.subarray(P521_SCALAR_BYTES));
  return afterS === der.length ? out : undefined;
}

async function verifyEcdsa(
  spki: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>,
  signature: Uint8Array,
): Promise<boolean> {
  const p1363 = derToP1363(signature);
  if (!p1363) return false;
  try {
    const curve = { name: "ECDSA", namedCurve: "P-521" };
    const key = await crypto.subtle.importKey("spki", spki, curve, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-512" }, key, p1363, message);
  } catch {
    // A key on another curve or off the curve: still just an invalid signature.
    return false;
  }
}

function verifyEd521(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed521.verify(signature, message, publicKey);
  } catch {
    // Malformed points or encodings throw: still just an invalid signature.
    return false;
  }
}

/**
 * Whether `signature` was made over `message` by `key`. ECDSA is ecdsa-with-SHA512 (WebCrypto
 * hashes `message`); Ed521 is PureEdDSA over `message` as-is. Never throws.
 */
export async function verifySignature(
  algorithm: SignatureAlgorithm,
  key: Pick<ParsedCertificate, "publicKey" | "spki">,
  message: Uint8Array<ArrayBuffer>,
  signature: Uint8Array,
): Promise<boolean> {
  return algorithm === "ed521"
    ? verifyEd521(key.publicKey, message, signature)
    : verifyEcdsa(key.spki, message, signature);
}
