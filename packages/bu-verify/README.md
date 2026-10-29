# @boletix/bu-verify

Verify that a Brazilian _boletim de urna_ (BU) was signed by the voting machine that printed it, the
same check TSE's official "Boletim na Mão" app does. Runs in browsers, Node, Deno and Cloudflare
Workers: SHA-2 and ECDSA P-521 use WebCrypto, Ed521 uses
[`@boletix/ed521`](https://www.npmjs.com/package/@boletix/ed521).

Reading the QR codes is [`@boletix/bu-qr`](https://www.npmjs.com/package/@boletix/bu-qr)'s job;
this package takes its output.

## Install

```sh
npm install @boletix/bu-verify @boletix/bu-qr
```

## Usage

```ts
import { assembleBu, assembleCertificate } from "@boletix/bu-qr";
import { verifyBu } from "@boletix/bu-verify";
import { TSE_ROOTS } from "@boletix/bu-verify/roots";

const bu = await assembleBu(parts); // checks the HASH chain
const certificate = assembleCertificate(certs);

const { algorithm, root } = await verifyBu(bu, certificate, TSE_ROOTS);
// algorithm: "ed521" (MDUE 2020+) or "ecdsa-p521" (MDUE 2013/2015); root: e.g. "AC UE2020"
```

`verifyBu` checks, in order:

1. the BU carries a signature (ASSI);
2. the certificate is X.509 with an Ed521 or ECDSA key;
3. its subject is this BU's urna (CN `UEAO0<IDUE>`);
4. it was issued by one of `roots`;
5. ASSI signs the BU's HASH under it.

Every failure throws a `VerificationError` with a stable `code` and a human-readable `detail`:

| Code                    | Meaning                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `SIGNATURE_MISSING`     | The BU has no ASSI field.                                         |
| `CERT_INVALID`          | Not an X.509 certificate, or not issued by any of `roots`.        |
| `UNSUPPORTED_ALGORITHM` | The certificate key is neither Ed521 nor ECDSA.                   |
| `CERT_URNA_MISMATCH`    | The certificate belongs to another urna.                          |
| `SIGNATURE_INVALID`     | ASSI does not sign HASH (tampered, malformed or from another BU). |

A pinned root whose DER does not match its `sha256` throws a plain `Error`: that is a
configuration bug, not a property of the BU.

## Trust model

`TSE_ROOTS` (`@boletix/bu-verify/roots`) are the certification authorities embedded in the official
app, pinned by SHA-256 and trusted directly: `AC URNA` (ECDSA P-521), `AC UE2020` and `AC UE2022`
(Ed521). Like the official app, validity periods are **not** enforced: `AC URNA` expired on
2026-07-18 and still certifies the older urnas used in the 2026 elections.

Pass your own `TrustedRoot[]` to trust a different set.

## API

| Export                             | Description                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `verifyBu(bu, certificate, roots)` | Async. Resolves `{ algorithm, root }` or throws `VerificationError`.                   |
| `VerificationError`                | `code: VerificationErrorCode`, `detail: string`.                                       |
| `TSE_ROOTS` (from `/roots`)        | Frozen `TrustedRoot[]`: `{ name, sha256, derBase64, source }`.                         |
| Types                              | `TrustedRoot`, `SignatureVerification`, `SignatureAlgorithm`, `VerificationErrorCode`. |

## License

[BSD-3-Clause](LICENSE)
