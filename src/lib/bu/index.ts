/**
 * The 2026 boletim de urna (BU) protocol: reading the QR codes printed on a BU,
 * rebuilding the signed document and checking its signature against the TSE roots.
 *
 * Framework-free and runs anywhere (browser, workerd, Node), so the browser and the
 * server verify with the same code.
 */
export { BuError, type BuErrorCode } from "./errors";
export { assembleBu, type Bu, type BuCargo } from "./format/assemble";
export { MAX_QR_CHARS } from "./format/tokenize";
export { MAX_QR_CODES, parseQr, type BuQr, type CertQr, type ParsedQr } from "./format/parse";
export { chainHashes, verifyBuSignature, type SignatureVerification } from "./signature/verify";
export { TSE_ROOTS, type TrustedRoot } from "./signature/tse-roots";
export {
  toSubmission,
  verifySubmission,
  type BuSubmission,
  type VerifiedSubmission,
} from "./submission";
