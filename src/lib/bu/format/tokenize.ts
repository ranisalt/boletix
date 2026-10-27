import { BuError } from "../errors";

/** Each printed QR holds at most 1100 characters (manual, section 1.4). */
export const MAX_QR_CHARS = 1100;

const QR_ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]+$/;

export function tokenize(raw: string): [string, string][] {
  if (raw.length > MAX_QR_CHARS) {
    throw new BuError("PAYLOAD_TOO_LARGE", `payload has ${raw.length} characters`);
  }

  if (!QR_ALPHANUMERIC.test(raw)) {
    throw new BuError("MALFORMED_TOKEN", "payload contains characters outside the QR alphabet");
  }

  const tokens = raw.split(" ");
  if (tokens.some((token) => token.length === 0)) {
    throw new BuError("MALFORMED_TOKEN", "payload contains an empty token");
  }

  return tokens.map((token) => {
    const separator = token.indexOf(":");
    if (separator <= 0 || separator === token.length - 1) {
      throw new BuError("MALFORMED_TOKEN", `token is not a non-empty key-value pair: ${token}`);
    }

    return [token.slice(0, separator), token.slice(separator + 1)];
  });
}
