import { BuError as QrError, type BuErrorCode as QrErrorCode } from "@boletix/bu-qr";
import { VerificationError, type VerificationErrorCode } from "@boletix/bu-verify";

/** Every reason a BU can be rejected: reading its QRs, verifying it, or the app's own rules. */
export type BuErrorCode =
  | QrErrorCode
  | VerificationErrorCode
  | "UNSUPPORTED_ELECTION"
  | "TEST_PHASE_REJECTED";

/** Raised by the app itself; the packages raise their own errors, read through `buErrorCode`. */
export class BuError extends Error {
  constructor(
    readonly code: BuErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

/** The code of a BU rejection from the app or either package, or undefined for any other error. */
export function buErrorCode(error: unknown): BuErrorCode | undefined {
  return error instanceof BuError || error instanceof QrError || error instanceof VerificationError
    ? error.code
    : undefined;
}
