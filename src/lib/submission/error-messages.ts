import type { BuErrorCode } from "../bu";
import { m } from "../paraglide/messages.js";

const BU_ERROR_MESSAGES: Record<BuErrorCode, () => string> = {
  PAYLOAD_TOO_LARGE: m.error_payload_too_large,
  MALFORMED_TOKEN: m.error_invalid_qr,
  MISSING_FIELD: m.error_invalid_qr,
  INVALID_FIELD: m.error_invalid_qr,
  UNEXPECTED_FIELD: m.error_invalid_qr,
  UNSUPPORTED_VERSION: m.error_unsupported_version,
  UNSUPPORTED_ELECTION: m.error_unsupported_election,
  TEST_PHASE_REJECTED: m.error_test_phase_rejected,
  QR_INDEX_INVALID: m.error_qr_index_invalid,
  QR_SET_INCOMPLETE: m.error_qr_set_incomplete,
  QR_SET_MIXED: m.error_qr_set_mixed,
  CERT_MISSING: m.error_cert_missing,
  CERT_INVALID: m.error_cert_invalid,
  CERT_URNA_MISMATCH: m.error_cert_urna_mismatch,
  UNSUPPORTED_ALGORITHM: m.error_unsupported_algorithm,
  HASH_MISMATCH: m.error_hash_mismatch,
  SIGNATURE_MISSING: m.error_signature_missing,
  SIGNATURE_INVALID: m.error_signature_invalid,
  TOTALS_INCONSISTENT: m.error_totals_inconsistent,
};

/** Whether the server rejected the boletim itself, as opposed to failing to process it. */
export function isBuErrorCode(code: string): code is BuErrorCode {
  return Object.hasOwn(BU_ERROR_MESSAGES, code);
}

/** User-facing text for a verification error, whether raised locally or returned by the server. */
export function buErrorMessage(code: string): string {
  if (code === "RATE_LIMITED") return m.submit_rate_limited();
  return isBuErrorCode(code) ? BU_ERROR_MESSAGES[code]() : m.submit_server_error();
}
