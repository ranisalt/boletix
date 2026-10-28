import { describe, expect, test } from "vitest";
import { hexToBytes } from "@noble/curves/utils.js";
import vectors from "./vectors/ed521.json" with { type: "json" };
import { ed521 } from "../src/index.ts";

const P = 2n ** 521n - 1n;
const N = 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd15b6c64746fc85f736b8af5e7ec53f04fbd8c4569a8f1f4540ea2435f5180d6bn;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

describe("curve parameters", () => {
  test("d = p - 376014", () => {
    expect(ed521.Point.CURVE().d).toBe(P - 376014n);
  });

  test("base point is valid and has order n", () => {
    expect(() => ed521.Point.BASE.assertValidity()).not.toThrow();
    expect(ed521.Point.BASE.multiplyUnsafe(N).is0()).toBe(true);
    expect(ed521.Point.CURVE().n).toBe(N);
  });

  test("66-byte field and scalar encodings", () => {
    expect(ed521.Point.Fp.BYTES).toBe(66);
    expect(ed521.Point.Fn.BYTES).toBe(66);
  });

  test("ed521 exposes the EdDSA API", () => {
    expect(typeof ed521.keygen).toBe("function");
    expect(typeof ed521.getPublicKey).toBe("function");
    expect(typeof ed521.sign).toBe("function");
    expect(typeof ed521.verify).toBe("function");
  });
});

describe("ECPy vectors", () => {
  test.each(vectors.ecpy.map((v, i) => [i, v] as const))("case %i", (_i, v) => {
    const sk = hexToBytes(v.secretKey);
    const msg = hexToBytes(v.message);
    const sig = hexToBytes(v.signature);
    const pub = hexToBytes(v.publicKey);
    const context = hexToBytes(v.context);
    expect(hex(ed521.getPublicKey(sk))).toBe(v.publicKey);
    expect(hex(ed521.sign(msg, sk, { context }))).toBe(v.signature);
    expect(ed521.verify(sig, msg, pub, { context })).toBe(true);
  });

  test("covers message lengths 0, 1, 64 and 1023", () => {
    const lengths = new Set(vectors.ecpy.map((v) => v.message.length / 2));
    for (const len of [0, 1, 64, 1023]) expect(lengths.has(len)).toBe(true);
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

describe("context", () => {
  test("a 256-byte context is rejected", () => {
    const sk = hexToBytes(vectors.ecpy[0]!.secretKey);
    const context = new Uint8Array(256);
    expect(() => ed521.sign(new Uint8Array(0), sk, { context })).toThrow(
      "context must be smaller than 255",
    );
    expect(() => ed521.verify(new Uint8Array(132), new Uint8Array(0), new Uint8Array(66), { context })).toThrow(
      "context must be smaller than 255",
    );
  });
});
