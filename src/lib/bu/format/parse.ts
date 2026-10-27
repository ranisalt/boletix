import { BuError } from "../errors";
import { tokenize } from "./tokenize";

// Decodes a single printed QR: either a part of the BU (QRBU) or a part of the urna certificate (QRCE).

const SUPPORTED_VRQR_VERSIONS: readonly string[] = ["6.0"];

/** One QR of the BU. `content` is what the HASH chain covers: the text between the QRBU/VRQR prefix and HASH. */
export type BuQr = {
  kind: "bu";
  index: number;
  total: number;
  version: string;
  content: string;
  tokens: [string, string][];
  hash: string;
  /** Signature over the final HASH; only on the last QR. */
  assi?: string;
};

/** One QR of the urna certificate (hex-encoded, split over several QRs). */
export type CertQr = {
  kind: "cert";
  index: number;
  total: number;
  idue: string;
  mdue: string;
  cert: string;
};

export type ParsedQr = BuQr | CertQr;

function requiredValue(tokens: [string, string][], key: string): string {
  const entry = tokens.find(([tokenKey]) => tokenKey === key);
  if (!entry) throw new BuError("MISSING_FIELD", `missing ${key}`);
  return entry[1];
}

/**
 * Our own sanity bound, not the manual's (it sets none): the longest real BU seen spans 9 QRs, so
 * this only rejects garbage before it costs any work.
 */
export const MAX_QR_CODES = 32;

function parseIndexTotal(value: string): { index: number; total: number } {
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) throw new BuError("QR_INDEX_INVALID", `invalid QRBU/QRCE sequence: ${value}`);

  const index = Number(match[1]);
  const total = Number(match[2]);
  if (
    !Number.isSafeInteger(index) ||
    !Number.isSafeInteger(total) ||
    index < 1 ||
    index > total ||
    total > MAX_QR_CODES
  ) {
    throw new BuError(
      "QR_INDEX_INVALID",
      `QR index ${index} of ${total} is outside 1..total<=${MAX_QR_CODES}`,
    );
  }

  return { index, total };
}

function parseCertificate(tokens: [string, string][]): CertQr {
  const { index, total } = parseIndexTotal(requiredValue(tokens, "QRCE"));
  const idue = requiredValue(tokens, "IDUE");
  const mdue = requiredValue(tokens, "MDUE");
  const cert = requiredValue(tokens, "CERT");

  if (!/^[0-9A-Fa-f]+$/.test(cert)) {
    throw new BuError("INVALID_FIELD", "CERT must contain hexadecimal data");
  }

  return { kind: "cert", index, total, idue, mdue, cert };
}

// Slices from the raw text rather than re-joining tokens, so the hashed bytes are exactly what was printed.
function contentAfterHeader(raw: string, headerTokenCount: number, hashStart: number): string {
  let cursor = 0;
  for (let token = 0; token < headerTokenCount; token += 1) {
    const separator = raw.indexOf(" ", cursor);
    if (separator === -1) return "";
    cursor = separator + 1;
  }

  return raw.slice(cursor, hashStart);
}

function parseBu(raw: string, tokens: [string, string][]): BuQr {
  const { index, total } = parseIndexTotal(requiredValue(tokens, "QRBU"));
  const versionEntry = tokens[1];
  if (!versionEntry || versionEntry[0] !== "VRQR") {
    throw new BuError("MISSING_FIELD", "VRQR must immediately follow QRBU");
  }

  const version = versionEntry[1];
  if (!SUPPORTED_VRQR_VERSIONS.includes(version)) {
    throw new BuError("UNSUPPORTED_VERSION", `unsupported VRQR:${version}`);
  }

  const hashEntries = tokens.filter(([key]) => key === "HASH");
  if (hashEntries.length === 0) throw new BuError("MISSING_FIELD", "missing HASH");
  if (hashEntries.length !== 1) throw new BuError("INVALID_FIELD", "HASH must appear exactly once");

  const hashIndex = tokens.findIndex(([key]) => key === "HASH");
  const assiIndex = tokens.findIndex(([key]) => key === "ASSI");
  if (assiIndex !== -1 && assiIndex !== hashIndex + 1) {
    throw new BuError("INVALID_FIELD", "ASSI must immediately follow HASH");
  }
  const isFinalHash = hashIndex === tokens.length - 1;
  const isHashBeforeFinalAssi = hashIndex === tokens.length - 2 && assiIndex === tokens.length - 1;
  if (!isFinalHash && !isHashBeforeFinalAssi) {
    throw new BuError("INVALID_FIELD", "HASH must be the last token or immediately precede ASSI");
  }

  const hash = hashEntries[0]![1];
  if (!/^[0-9A-Fa-f]{128}$/.test(hash)) {
    throw new BuError("INVALID_FIELD", "HASH must be exactly 128 hexadecimal characters");
  }

  let assi: string | undefined;
  if (assiIndex !== -1) {
    if (index !== total) {
      throw new BuError("UNEXPECTED_FIELD", "ASSI is allowed only on the final QR");
    }
    assi = tokens[assiIndex]![1];
    if (!/^[0-9A-Fa-f]+$/.test(assi)) {
      throw new BuError("INVALID_FIELD", "ASSI must contain hexadecimal data");
    }
  }

  const hashStart = raw.indexOf(" HASH:");
  if (hashStart === -1) throw new BuError("MISSING_FIELD", "missing HASH token");

  return {
    kind: "bu",
    index,
    total,
    version,
    content: contentAfterHeader(raw, 2, hashStart),
    tokens,
    hash,
    ...(assi === undefined ? {} : { assi }),
  };
}

export function parseQr(raw: string): ParsedQr {
  const tokens = tokenize(raw);
  const firstKey = tokens[0]?.[0];

  if (firstKey === "QRCE") return parseCertificate(tokens);
  if (firstKey === "QRBU") return parseBu(raw, tokens);

  throw new BuError("MISSING_FIELD", "first token must be QRBU or QRCE");
}
