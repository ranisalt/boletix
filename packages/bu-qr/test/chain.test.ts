import { describe, expect, it } from "vitest";

import { chainHashes } from "../src/chain.ts";
import { bytesToHex } from "../src/hex.ts";
import { parseQr, type BuQr } from "../src/parse.ts";
import { loadBuFixtures } from "./fixtures.ts";

async function sha512Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest)).toUpperCase();
}

function bu(raw: string): BuQr {
  const parsed = parseQr(raw);
  if (parsed.kind !== "bu") throw new Error("expected a BU QR");
  return parsed;
}

describe("chainHashes", () => {
  it("chains each QR's text through the previous hash, in order", async () => {
    const h1 = await sha512Hex("A:1");
    const h2 = await sha512Hex(`A:1 HASH:${h1} B:2`);
    const h3 = await sha512Hex(`A:1 HASH:${h1} B:2 HASH:${h2} C:3`);
    expect(await chainHashes(["A:1", "B:2", "C:3"])).toEqual([h1, h2, h3]);
  });

  it("drops trailing spaces from each QR's content before chaining", async () => {
    const h1 = await sha512Hex("A:1");
    const h2 = await sha512Hex(`A:1 HASH:${h1} B:2`);
    expect(await chainHashes(["A:1 ", "B:2  "])).toEqual([h1, h2]);
  });

  it("matches the signed HASH when the content comes from a subarray view with a non-zero byteOffset", async () => {
    // Review Focus 1: the digest must read only this view, not the whole backing ArrayBuffer.
    const fixture = loadBuFixtures()[0]!;
    const part = bu(fixture.qrbu[0]!);
    const padded = new TextEncoder().encode(`PADDING-PREFIX${part.content}`);
    const view = padded.subarray("PADDING-PREFIX".length);
    expect(view.byteOffset).toBeGreaterThan(0);

    const [last] = await chainHashes([new TextDecoder().decode(view)]);
    expect(last).toBe(part.hash);
  });

  it("reproduces the signed HASH of every real 2026 fixture", async () => {
    // zz-29688-1-929 is excluded: it is a hand-edited synthetic BU (UF ZZ, no QRCE),
    // so its printed HASH no longer matches its content.
    const fixtures = loadBuFixtures().filter((f) => f.name !== "zz-29688-1-929");
    const results = await Promise.all(
      fixtures.map(async (fixture) => {
        const parts = fixture.qrbu.map(bu);
        const hashes = await chainHashes(parts.map((part) => part.content));
        return [fixture.name, hashes.at(-1), parts.at(-1)!.hash];
      }),
    );
    for (const [name, actual, expected] of results) expect(actual, name).toBe(expected);
  });
});
