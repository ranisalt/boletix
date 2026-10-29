# @boletix/ed521

Ed521 signatures (EdDSA over the E-521 curve with SHAKE256), built on
[`@noble/curves`](https://github.com/paulmillr/noble-curves). It has the same API as noble's
`ed448`, because it is the same construction scaled up to a 521-bit field.

Ed521 is not in RFC 8032. This package follows [ECPy](https://github.com/cslashm/ECPy), the
reference the Brazilian electoral court (TSE) points to for the signatures its voting machines
(urnas) put on every _boletim de urna_ since 2020. It is tested against ECPy-generated vectors and
against real urna signatures.

## Install

```sh
npm install @boletix/ed521
```

## Usage

```ts
import { ed521 } from "@boletix/ed521";

const { secretKey, publicKey } = ed521.keygen(); // 66 bytes each
const message = new TextEncoder().encode("hello");
const signature = ed521.sign(message, secretKey); // 132 bytes
ed521.verify(signature, message, publicKey); // true

// Optional context (0..255 bytes), as in Ed448:
const context = new TextEncoder().encode("my-protocol");
ed521.verify(ed521.sign(message, secretKey, { context }), message, publicKey, { context });
```

`ed521` is a noble `EdDSA` object: `keygen`, `getPublicKey`, `sign`, `verify`, `utils`, `Point`
and `lengths`. See the [noble-curves docs](https://github.com/paulmillr/noble-curves#ed25519-ed448).

As in noble, `verify` returns `false` for a well-formed signature that does not verify. It throws
on malformed arguments (wrong lengths, non-`Uint8Array`, context over 255 bytes).

## Parameters

|              |                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| Curve        | E-521: `x² + y² = 1 + d·x²·y²` over `p = 2⁵²¹ − 1`, `d = −376014`, cofactor 4                              |
| Base point   | `y = 12`, `x` even                                                                                         |
| Hash         | `SHAKE256(·, 132 bytes)`                                                                                   |
| Secret key   | 66 bytes, hashed and split into a 66-byte scalar half and a 66-byte prefix                                 |
| Clamping     | `s[0] &= 0xFC`, `s[65] = 0x80`                                                                             |
| Domain       | `dom5(phflag, ctx) = "SigEd521" ‖ phflag ‖ len(ctx) ‖ ctx`; pure Ed521 with no context is `"SigEd521\0\0"` |
| Encodings    | 66-byte little-endian points and scalars, 132-byte signatures `R ‖ S`                                      |
| Verification | Cofactored, rejects non-canonical `S`, strict (non-ZIP-215) point decoding                                 |

There is no `ed521ph`. No deployment or reference implementation defines a prehash for Ed521.

## Compatibility notes

- **ECPy** only implements pure Ed521 with an empty context. A non-empty context is tested
  against ECPy with its hardcoded `"SigEd521\0\0"` prefix patched to the `dom5` encoding.
- **ECPy verifies without the cofactor** (`[S]B = R + [k]A`) and noble verifies with it. The two
  agree on every honestly generated signature. They can only disagree on crafted signatures with
  small-order components.
- **ECPy hashes `d.to_bytes(66, "big")`** as the secret key. Pass that byte string to this
  package, not the integer's little-endian encoding.

## License

[BSD-3-Clause](LICENSE)
