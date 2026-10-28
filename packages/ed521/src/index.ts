/**
 * Ed521: EdDSA over E-521 with SHAKE256, in the style of RFC 8032 Ed448.
 *
 * Neither RFC 8032 nor any IETF draft defines Ed521. This module follows the de-facto
 * definition shipped in ECPy (https://github.com/cslashm/ECPy, `ecpy/eddsa.py`), which is what
 * the Brazilian electoral court (TSE) uses to sign voting-machine (urna) bulletins since 2020:
 *
 * - Curve: E-521 (Aranha, Barreto, Pereira, Ricardini, 2013; listed in SafeCurves), untwisted Edwards,
 *   `x² + y² = 1 + d·x²·y²` over `p = 2⁵²¹ - 1`, `d = -376014`, cofactor 4.
 * - Hash: `SHAKE256(·, 132)`. The secret key is 66 bytes; its hash splits into a 66-byte scalar
 *   half and a 66-byte prefix half.
 * - Clamping: clear the 2 low bits of byte 0 and set byte 65 to `0x80`, so the scalar is a
 *   multiple of the cofactor with bit 527 set.
 * - Domain separation: `dom5(phflag, ctx) = "SigEd521" || phflag || len(ctx) || ctx`, mirroring
 *   Ed448's `dom4`. ECPy only implements the pure, empty-context case `"SigEd521\0\0"`.
 * - Encoding: 66-byte little-endian points (y with the x sign in bit 527) and scalars,
 *   132-byte signatures `R || S`.
 *
 * Verification is cofactored (`[8][S]B = [8]R + [8][k]A`), like the rest of noble's EdDSA. ECPy
 * verifies without the cofactor; both agree on every honestly generated signature.
 * @module
 */
/*! @boletix/ed521 - MIT License (c) 2026 Ranieri Althoff */
import { eddsa, edwards, type EdDSA, type EdwardsOpts } from "@noble/curves/abstract/edwards.js";
import { Field } from "@noble/curves/abstract/modular.js";
import { asciiToBytes, type TArg, type TRet } from "@noble/curves/utils.js";
import { shake256 } from "@noble/hashes/sha3.js";
import { concatBytes, createHasher } from "@noble/hashes/utils.js";

// E-521
// a = 1n
// d = Fp.neg(376014n)
// Finite field 2n**521n - 1n
// Subgroup order
// 2n**519n - 337554763258501705789107630418782636071904961214051226618635150085779108655765n
const ed521_CURVE_p =
  0x1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
const ed521_CURVE: EdwardsOpts = {
  p: ed521_CURVE_p,
  n: 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd15b6c64746fc85f736b8af5e7ec53f04fbd8c4569a8f1f4540ea2435f5180d6bn,
  h: 4n,
  a: 1n,
  d: ed521_CURVE_p - 376014n,
  Gx: 0x752cb45c48648b189df90cb2296b2878a3bfd9f42fc6c818ec8bf3c9c0c6203913f6ecc5ccc72434b1ae949d568fc99c6059d0fb13364838aa302a940a2f19ba6cn,
  Gy: 12n,
};

const shake256_132 = /* @__PURE__ */ createHasher(() => shake256.create({ dkLen: 132 }));

// Field and scalar elements are both encoded in 66 bytes. The subgroup order is only 519 bits,
// so Fn is widened to the field's 521-bit storage like Ed448 widens both to 456 bits.
const Fp = /* @__PURE__ */ (() => Field(ed521_CURVE_p, { BITS: 521, isLE: true }))();
const Fn = /* @__PURE__ */ (() => Field(ed521_CURVE.n, { BITS: 521, isLE: true }))();

// Mutates and returns the provided buffer in place.
function adjustScalarBytes(bytes: TArg<Uint8Array>): TRet<Uint8Array> {
  // ECPy: clear the two least significant bits of the first byte (cofactor 4),
  bytes[0]! &= 252; // 0b11111100
  // and replace the last byte with 0x80: bits 520..526 cleared, bit 527 set.
  bytes[65] = 128; // 0b10000000
  return bytes as TRet<Uint8Array>;
}

// SHAKE256(dom5(phflag,context)||x, 132)
// Same layout as RFC 8032 `dom4`. Empty contexts are valid; the accepted length range is
// 0..255 octets inclusive.
function dom5(data: TArg<Uint8Array>, ctx: TArg<Uint8Array>, phflag: boolean): TRet<Uint8Array> {
  if (ctx.length > 255) throw new Error("context must be smaller than 255, got: " + ctx.length);
  return concatBytes(
    asciiToBytes("SigEd521"),
    new Uint8Array([phflag ? 1 : 0, ctx.length]),
    ctx,
    data,
  ) as TRet<Uint8Array>;
}

const ed521_Point = /* @__PURE__ */ edwards(ed521_CURVE, { Fp, Fn });

/**
 * ed521 EdDSA curve and methods: pure Ed521 with optional context.
 *
 * There is no `ed521ph`: no deployment or reference implementation defines its prehash.
 * @example
 * Generate one Ed521 keypair, sign a message, and verify it.
 *
 * ```js
 * import { ed521 } from '@boletix/ed521';
 * const { secretKey, publicKey } = ed521.keygen();
 * // const publicKey = ed521.getPublicKey(secretKey);
 * const msg = new TextEncoder().encode('hello noble');
 * const sig = ed521.sign(msg, secretKey);
 * const isValid = ed521.verify(sig, msg, publicKey);
 * ```
 */
export const ed521: EdDSA = /* @__PURE__ */ eddsa(ed521_Point, shake256_132, {
  adjustScalarBytes,
  domain: dom5,
});
