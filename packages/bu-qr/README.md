# @boletix/bu-qr

Parse the QR codes printed on Brazilian _boletins de urna_ (BU), the per-section vote tallies every
voting machine prints when the polls close. Zero runtime dependencies; runs in browsers, Node,
Deno and Cloudflare Workers (hashing uses WebCrypto).

Supports the **VRQR 6.0** layout from the TSE _Manual do QR Code no Boletim de Urna_ (2026
elections). Older layouts are rejected with `UNSUPPORTED_VERSION`.

To verify the signature and the urna certificate, use
[`@boletix/bu-verify`](https://www.npmjs.com/package/@boletix/bu-verify).

## Install

```sh
npm install @boletix/bu-qr
```

## Usage

```ts
import { assembleBu, assembleCertificate, chainHashes, parseQr, type BuQr } from "@boletix/bu-qr";

// One string per scanned QR code, in any order.
const parsed = scanned.map(parseQr);
const parts = parsed.filter((qr): qr is BuQr => qr.kind === "bu");
const certs = parsed.filter((qr) => qr.kind === "cert");

const bu = assembleBu(parts);
bu.header.municipio; // 29688
bu.cargos[0]?.candidates; // { "13": 120, "22": 98, ... }

// The HASH chain: the last value is what the urna signed (ASSI).
const sorted = parts.toSorted((a, b) => a.index - b.index);
const hashes = await chainHashes(sorted.map((part) => part.content));
hashes.at(-1) === sorted.at(-1)?.hash; // true for an untampered BU

// The urna's X.509 certificate (DER), printed in the QRCE codes.
const der = assembleCertificate(certs);
```

Every failure throws a `BuError` with a stable `code` (`BuErrorCode`) and a human-readable `detail`:

```ts
import { BuError } from "@boletix/bu-qr";

try {
  parseQr(raw);
} catch (error) {
  if (error instanceof BuError && error.code === "UNSUPPORTED_VERSION") {
    // a BU from another election
  }
}
```

## API

| Export                                        | Description                                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `parseQr(raw)`                                | Decodes one QR: a BU part (`kind: "bu"`) or a certificate part (`kind: "cert"`).                                                    |
| `assembleBu(parts)`                           | Joins all parts of one BU (any order) and decodes header and cargos. Checks that the printed totals add up (`TOTALS_INCONSISTENT`). |
| `chainHashes(contents)`                       | SHA-512 HASH chain over the parts' `content`, in index order. Async (WebCrypto). Returns uppercase hex.                             |
| `assembleCertificate(certs)`                  | Joins the QRCE parts of one urna into the certificate DER (accepts DER or PEM inside `CERT`).                                       |
| `bytesToHex(bytes)`, `hexToBytes(hex)`        | Strict hex helpers; `hexToBytes` rejects odd length and non-hex characters with `INVALID_FIELD`.                                    |
| `BuError`, `BuErrorCode`                      | The error type shared with `@boletix/bu-verify`.                                                                                    |
| `MAX_QR_CHARS`, `MAX_QR_CODES`                | Limits: 1100 characters per QR (manual), 32 QRs per BU (sanity bound; the longest real BU spans 9).                                 |
| `Bu`, `BuCargo`, `BuQr`, `CertQr`, `ParsedQr` | Types. Field names follow the manual; doc comments note the QR key each field comes from.                                           |

## Format rules

These were verified against real 2026 BUs, not just the manual.

- **Tokens.** A QR is `KEY:VALUE` tokens separated by single spaces, in the QR alphanumeric
  alphabet (`0-9 A-Z $%*+-./:` and space). Values split on the first colon only (`HICA:1:8027`).
- **Header.** `QRBU:<i>:<n> VRQR:<version>` starts every BU part; `QRCE:<i>:<n> IDUE MDUE CERT`
  every certificate part. Which header keys a BU may carry depends on `ORIG` (`VOTA`, `RED`, `SA`).
- **HASH.** Each part ends in `HASH:<128 hex>`, optionally followed by `ASSI:<hex>` on the last
  part only. A part's `content` is the exact text between the `QRBU`/`VRQR` header and ` HASH:`.
- **HASH chain.** `HASH₁ = SHA-512(content₁)`, and for each following part
  `HASHᵢ = SHA-512(textᵢ₋₁ + " HASH:" + HASHᵢ₋₁ + " " + contentᵢ)`, where `textᵢ` is the string
  hashed for part _i_. Only the last HASH is signed, and it covers the whole BU.
- **Certificate.** `CERT` is hex. Urnas from 2013/2015 print the DER directly; 2020 and later
  print PEM text, which `assembleCertificate` decodes to DER.

## License

MIT
