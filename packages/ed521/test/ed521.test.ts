import { hexToBytes } from "@noble/curves/utils.js";
import { describe, expect, test } from "vitest";

import { ed521 } from "../src/index.ts";
import vectors from "./vectors/ed521.json" with { type: "json" };

const P = 2n ** 521n - 1n;
const N =
  0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd15b6c64746fc85f736b8af5e7ec53f04fbd8c4569a8f1f4540ea2435f5180d6bn;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const utf8 = (text: string) => new TextEncoder().encode(text);

// ECPy's own Ed521 self-test (ecpy/eddsa.py, "Message for Ed521 signing"), re-encoded: the
// secret key is ECPy's `d` as 66 big-endian bytes, the public key its point encoding.
const ECPY_SELFTEST = {
  secretKey:
    "a0d4d2ea5090b09a5d05ddf8c10d72e3a4b5c435fbff6d3a5f775cfe837f158fcf4e04b3d70713b71e834f3bec2442ef4c5c8a1ffb6f2f81dec330226ffe2f46a285",
  publicKey:
    "fb00870ccbf9c3db7790f76ca2470c41373f4ccced7ae646bad040274d717f7f44e6d37537dede5bbdae7410b32e7b67521b0f3cac077548d100612a0e8b65d66c00",
  message: hex(utf8("Message for Ed521 signing")),
  context: "",
  signature:
    "c2fb4f7d03dd31f25753b9972aeb650ac3632eef945e7f94e426a865bb95e66241149c7eed24d98fed2ee8b9ef949b83ba556d045b72df6e6b8b9026414b26463d0088d2ed5ea88fcc6b2f343d308209dacd5fadadac352d497d2049831eca3536e7be5a7faef56d6c6786c60415e0febee8a45f9971ae4872e0b6cf09cc0a9407342000",
};

describe("ECPy vectors", () => {
  test.each([ECPY_SELFTEST, ...vectors.ecpy].map((v, i) => [i, v] as const))("case %i", (_i, v) => {
    const sk = hexToBytes(v.secretKey);
    const msg = hexToBytes(v.message);
    const sig = hexToBytes(v.signature);
    const pub = hexToBytes(v.publicKey);
    const context = hexToBytes(v.context);
    expect(hex(ed521.getPublicKey(sk))).toBe(v.publicKey);
    expect(hex(ed521.sign(msg, sk, { context }))).toBe(v.signature);
    expect(ed521.verify(sig, msg, pub, { context })).toBe(true);
  });
});

describe("real TSE vectors", () => {
  test.each(vectors.tse.map((v) => [v.id, v] as const))("%s verifies", (_id, v) => {
    const msg = hexToBytes(v.message);
    const sig = hexToBytes(v.signature);
    const pub = hexToBytes(v.publicKey);
    expect(ed521.verify(sig, msg, pub)).toBe(true);
  });

  test.each(vectors.tse.map((v) => [v.id, v] as const))("%s rejects tampering", (_id, v) => {
    const msg = hexToBytes(v.message);
    const sig = hexToBytes(v.signature);
    const pub = hexToBytes(v.publicKey);

    const badSig = sig.slice();
    badSig[badSig.length - 1]! ^= 1;
    expect(ed521.verify(badSig, msg, pub)).toBe(false);

    const badMsg = msg.slice();
    badMsg[0]! ^= 1;
    expect(ed521.verify(sig, badMsg, pub)).toBe(false);

    const other = vectors.tse.find((o) => o.id !== v.id);
    expect(other).toBeDefined();
    expect(ed521.verify(sig, msg, hexToBytes(other!.publicKey))).toBe(false);
  });
});

describe("rejection", () => {
  const sk = hexToBytes(vectors.ecpy[0]!.secretKey);
  const pub = hexToBytes(vectors.ecpy[0]!.publicKey);
  const msg = utf8("boletim de urna");
  const sig = ed521.sign(msg, sk);

  test("a non-canonical S (S + n)", () => {
    let s = 0n;
    for (let i = 131; i >= 66; i--) s = (s << 8n) | BigInt(sig[i]!);
    const bad = sig.slice();
    let value = s + N;
    expect(value < 2n ** 528n).toBe(true); // still fits in 66 bytes
    for (let i = 66; i < 132; i++, value >>= 8n) bad[i] = Number(value & 0xffn);
    expect(ed521.verify(bad, msg, pub)).toBe(false);
  });

  test("wrong-length signatures and keys throw", () => {
    expect(() => ed521.verify(sig.subarray(1), msg, pub)).toThrow(/signature/);
    expect(() => ed521.verify(sig, msg, pub.subarray(1))).toThrow(/publicKey/);
  });
});

describe("context", () => {
  const sk = hexToBytes(vectors.ecpy[0]!.secretKey);
  const pub = hexToBytes(vectors.ecpy[0]!.publicKey);
  const msg = utf8("hello");
  const context = utf8("boletix");

  // ECPy has no context parameter. This vector comes from ECPy with its hardcoded
  // "SigEd521\x00\x00" prefix patched to dom5(0, "boletix") = "SigEd521\x00\x07boletix".
  test("matches patched ECPy for a non-empty context", () => {
    const v = ECPY_SELFTEST;
    const sig = ed521.sign(hexToBytes(v.message), hexToBytes(v.secretKey), { context });
    expect(hex(sig)).toBe(
      "d2ec38afb8d3c5f9767dd9460e40effab0861d9bb6814d6b8383b0f9417569453828c82613dda427b76125ab68dc200b53866f04dd9b95f619123df4aa0d872984804f18983e593488d59b175160772d38511f9c525c8be93b1047883b35b6351b82c22239d037e32a2fea0fc9875941e82b5dd430f50fc506274fdca0d9bcfc91197e00",
    );
  });

  test("round-trips with a context", () => {
    expect(ed521.verify(ed521.sign(msg, sk, { context }), msg, pub, { context })).toBe(true);
  });

  test("binds the signature to its context", () => {
    expect(ed521.verify(ed521.sign(msg, sk, { context }), msg, pub)).toBe(false);
    expect(ed521.verify(ed521.sign(msg, sk), msg, pub, { context })).toBe(false);
  });

  test("a 256-byte context is rejected", () => {
    const long = new Uint8Array(256);
    expect(() => ed521.sign(msg, sk, { context: long })).toThrow(
      "context must be smaller than 255",
    );
    // Checked after decoding, so use a valid signature and key.
    expect(() => ed521.verify(ed521.sign(msg, sk), msg, pub, { context: long })).toThrow(
      "context must be smaller than 255",
    );
  });
});
