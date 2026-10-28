/**
 * The 2026 boletim de urna (BU) protocol as the app uses it: the @boletix packages read and verify a
 * BU; this module adds the app's error vocabulary and the client/server submission format.
 *
 * Framework-free and runs anywhere (browser, workerd, Node), so the browser and the
 * server verify with the same code.
 */
export {
  assembleBu,
  chainHashes,
  MAX_QR_CHARS,
  MAX_QR_CODES,
  parseQr,
  type Bu,
  type BuCargo,
  type BuQr,
  type CertQr,
  type ParsedQr,
} from "@boletix/bu-qr";
export { TSE_ROOTS } from "@boletix/bu-verify/roots";
export { BuError, buErrorCode, type BuErrorCode } from "./errors";
export {
  openSubmission,
  sealSubmission,
  type BuSubmission,
  type SubmitStatus,
  type VerifiedSubmission,
} from "./submission";
