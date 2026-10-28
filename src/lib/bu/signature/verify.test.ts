import { sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";

import { type BuQr } from "../format/parse";
import { expectBuError } from "../testing/fixtures";
import { TSE_ROOTS } from "./tse-roots";
import { chainHashes, verifyBuWithCertificate } from "./verify";

const sha512Hex = (text: string) =>
  bytesToHex(sha512(new TextEncoder().encode(text))).toUpperCase();

function bu(index: number, total: number, content: string, hash = "0".repeat(128)): BuQr {
  return { kind: "bu", index, total, version: "6.0", content, tokens: [], hash };
}

// Rule from the TSE "Boletim na Mão" app (module 4770): each QR's text after its header is chained as
// `<previous text> HASH:<previous hash> <content>`, and only the final hash is checked.
describe("chainHashes", () => {
  it("chains every QR through the previous hash", () => {
    const h1 = sha512Hex("A:1");
    const h2 = sha512Hex(`A:1 HASH:${h1} B:2`);
    const h3 = sha512Hex(`A:1 HASH:${h1} B:2 HASH:${h2} C:3`);
    expect(chainHashes(["A:1", "B:2", "C:3"])).toEqual([h1, h2, h3]);
  });
});

describe("verifyBuWithCertificate", () => {
  it("chains multi-QR BUs in index order, whatever the scan order", () => {
    const [h1, h2] = chainHashes(["A:1", "B:2"]);
    const parts = [bu(2, 2, "B:2", h2), bu(1, 2, "A:1", h1)];
    // Past the HASH check, the unsigned synthetic BU stops at the missing ASSI.
    expectBuError(
      () => verifyBuWithCertificate(parts, new Uint8Array(), TSE_ROOTS),
      "SIGNATURE_MISSING",
    );
  });
});
