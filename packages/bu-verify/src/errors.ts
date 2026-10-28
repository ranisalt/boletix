export type VerificationErrorCode =
  | "SIGNATURE_MISSING"
  | "CERT_INVALID"
  | "CERT_URNA_MISMATCH"
  | "UNSUPPORTED_ALGORITHM"
  | "SIGNATURE_INVALID";

/** Why a BU failed verification. `code` is stable; `detail` is for humans and may change. */
export class VerificationError extends Error {
  override readonly name: string = "VerificationError";

  constructor(
    readonly code: VerificationErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}
