import { BuError } from "./errors.ts";

const HEX_PAIRS = /^(?:[0-9a-fA-F]{2})*$/;

/** Lowercase hex encoding of `bytes`. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * Strict hex decoding: accepts upper- and lowercase digits, rejects odd length and any non-hex
 * character with `BuError("INVALID_FIELD")`.
 */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new BuError("INVALID_FIELD", "hex string has an odd length");
  if (!HEX_PAIRS.test(hex)) throw new BuError("INVALID_FIELD", "hex string has non-hex characters");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}
