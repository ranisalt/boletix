# Proposing Ed521 to @noble/curves

Not published. These are notes for an upstream PR adding `src/ed521.ts` next to `src/ed448.ts`.

## What would move

`src/index.ts` is written as a drop-in noble module:

- Same structure as `ed448.ts`: curve constants in an `EdwardsOpts` object, `Fp`/`Fn` fields,
  `adjustScalarBytes`, a `domN` helper, `edwards()` + `eddsa()`, and `/* @__PURE__ */` annotations.
- Imports become relative (`./abstract/edwards.ts`, `./utils.ts`). `concatBytes` and
  `createHasher` come from `@noble/hashes/utils.js`, as in `ed448.ts`.
- The tests in `test/ed521.test.ts` and the vectors in `test/vectors/ed521.json` map onto noble's
  `test/ed448.test.ts` and `test/vectors/`.

## Open questions for the maintainer

1. **No standard.** Ed521 exists only in ECPy and in deployments that follow it, mainly TSE's
   urnas (about 500k devices). noble has included non-RFC curves before, in `misc.ts`. Ed521 may
   belong there rather than in its own module.
2. **Clamping.** ECPy sets `s[65] = 0x80`, the same pattern as Ed448's `s[55] |= 0x80; s[56] = 0`.
   This is not "the highest bit below the order". It is kept for ECPy compatibility.
3. **Context.** ECPy hardcodes `"SigEd521\0\0"`. `dom5` generalizes it the way `dom4` does for
   Ed448. Only the empty context is backed by a real implementation; the non-empty case is
   covered by a vector from a patched ECPy.
4. **No `ed521ph`, no X521, no hash-to-curve.** None has a reference implementation.

## Vectors

- `scripts/gen-vectors.py` regenerates `test/vectors/ed521.json` from ECPy at commit
  `8143d9ac017de0cb7f980bedaf56cefe6b4d9180`: 8 deterministic sign/verify cases (messages of 0,
  1, 64 and 1023 bytes) and 2 real TSE urna signatures.
- ECPy's own Ed521 self-test vector is inlined in the test file.
