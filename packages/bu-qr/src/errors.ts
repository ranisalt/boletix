export type BuErrorCode =
  | "PAYLOAD_TOO_LARGE"
  | "MALFORMED_TOKEN"
  | "MISSING_FIELD"
  | "INVALID_FIELD"
  | "UNEXPECTED_FIELD"
  | "UNSUPPORTED_VERSION"
  | "QR_INDEX_INVALID"
  | "QR_SET_INCOMPLETE"
  | "QR_SET_MIXED"
  | "CERT_MISSING"
  | "CERT_INVALID"
  | "HASH_MISMATCH"
  | "TOTALS_INCONSISTENT";

export class BuError extends Error {
  constructor(
    readonly code: BuErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}
