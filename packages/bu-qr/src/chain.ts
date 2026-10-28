import { bytesToHex } from "./hex.ts";

async function sha512Hex(text: string): Promise<string> {
  // TextEncoder allocates a fresh, exact-length buffer, so the digest never sees a pooled view.
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest)).toUpperCase();
}

/**
 * Chains the HASH of a BU's QR codes, in index order. Each QR's content (trailing spaces dropped)
 * is appended to the previous text as ` HASH:<previous hash> <content>`, so the last hash covers
 * the whole BU. Returns one uppercase SHA-512 hex digest per content.
 */
export async function chainHashes(contents: readonly string[]): Promise<string[]> {
  const hashes: string[] = [];
  let text = "";
  let hash = "";
  for (const [i, untrimmed] of contents.entries()) {
    const content = untrimmed.trimEnd();
    text = i === 0 ? content : `${text} HASH:${hash} ${content}`;
    hash = await sha512Hex(text);
    hashes.push(hash);
  }
  return hashes;
}
