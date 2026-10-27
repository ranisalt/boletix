// Ed521 (E-521 Edwards curve, SHAKE256-132, "SigEd521" domain) as used by TSE urnas since MDUE 2020.
// Curve and domain taken from the official "Boletim na Mão" app; see docs/tse/2026/ED521.md.
import { eddsa, edwards, type EdwardsOpts } from "@noble/curves/abstract/edwards.js";
import { Field } from "@noble/curves/abstract/modular.js";
import { shake256 } from "@noble/hashes/sha3.js";

const ED521_P = BigInt(
  "0x1ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

const ED521_CURVE: EdwardsOpts = {
  p: ED521_P,
  n: BigInt(
    "0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd15b6c64746fc85f736b8af5e7ec53f04fbd8c4569a8f1f4540ea2435f5180d6b",
  ),
  h: 4n,
  a: 1n,
  d: ED521_P - 376014n, // d = -376014 mod p
  Gx: BigInt(
    "0x752cb45c48648b189df90cb2296b2878a3bfd9f42fc6c818ec8bf3c9c0c6203913f6ecc5ccc72434b1ae949d568fc99c6059d0fb13364838aa302a940a2f19ba6c",
  ),
  Gy: 12n,
};

const shake256_132 = Object.assign((data: Uint8Array) => shake256(data, { dkLen: 132 }), {
  outputLen: 132,
});

const ED521_DOMAIN = new TextEncoder().encode("SigEd521\0\0");

const ed521 = eddsa(
  // The E-521 subgroup order is 519 bits, but EdDSA encodes S in 66 bytes.
  edwards(ED521_CURVE, { FpFnLE: true, Fn: Field(ED521_CURVE.n, { BITS: 521, isLE: true }) }),
  shake256_132,
  {
    domain: (data: Uint8Array, _context: Uint8Array, phflag: boolean): Uint8Array => {
      if (phflag) throw new Error("TSE signatures use PureEdDSA");
      const prefixed = new Uint8Array(ED521_DOMAIN.length + data.length);
      prefixed.set(ED521_DOMAIN);
      prefixed.set(data, ED521_DOMAIN.length);
      return prefixed;
    },
  },
);

/** PureEdDSA verification over `message` as-is; malformed inputs return false. */
export function verifyEd521(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  if (publicKey.length !== 66 || signature.length !== 132) return false;
  try {
    return ed521.verify(signature, message, publicKey);
  } catch {
    // The library throws on malformed points or encodings: still just an invalid signature.
    return false;
  }
}
