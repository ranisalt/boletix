# Findings from real 2026 BUs

The TSE manual leaves some details out. These notes record what was checked against 12 real 2026 BUs (`fixtures/2026`) and against the official Boletim na Mão app (4.0.5). All 12 pass the HASH recomputation, the certificate chain and the ASSI check.

## HASH

- `HASH = SHA-512(content)`, in uppercase hex.
- `content` is every token after the `QRBU` and `VRQR` header tokens, up to but not including ` HASH:`, joined by single spaces.
- All 12 samples are single-QR BUs (`QRBU:1:1`). The chain rule for multi-QR BUs follows the manual and hasn't been checked on a real BU yet.

## Signature and certificate

The urna signs the BU with the key in its own certificate, which it prints in the `QRCE` QR codes. Without the `QRCE` codes the signature can't be checked, and the official app shows "QRCE necessário".

To verify a BU, the official app:

1. Recomputes HASH from the BU parts. A mismatch makes the BU invalid.
2. Joins the `CERT` hex of every `QRCE:i:n` in order of `i` and parses the result as X.509.
3. Picks the algorithm from the SPKI OID: `1.3.6.1.4.1.44588.2.1` is Ed521 and `1.2.840.10045.2.1` is ECDSA P-521.
4. Checks the certificate against one of the CA certificates it embeds, pinned in `fixtures/tse-roots/`.
5. Checks ASSI against the certificate key.

Two certificate families coexist in 2026:

| MDUE       | `CERT` hex decodes to              | Leaf key                         | Issuer                 | ASSI                                                                                        |
| ---------- | ---------------------------------- | -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| 2013, 2015 | DER (946 hex chars per part)       | ECDSA P-521, `ecdsa-with-SHA512` | AC URNA (`2013.pem`)   | DER ECDSA, 139 bytes. ECDSA-SHA512 over the raw HASH bytes                                  |
| 2020       | PEM text (1034 hex chars per part) | Ed521                            | AC UE2020 (`2020.pem`) | Raw `R ‖ S`, 132 bytes. Pure Ed521 with the `SigEd521\0\0` domain over `sha512(HASH bytes)` |

- AC UE2020 signs urna certificates with Ed521 over the raw TBS bytes. AC URNA uses standard `ecdsa-with-SHA512`.
- AC URNA expired on 2026-07-18 but still certifies most 2026 urnas, whose own certificates run until 2027 or 2030. Like the official app, Boletix trusts the pinned CA certificates directly and doesn't enforce their expiry.
- The app also embeds AC UE2022. No urna certified by it has turned up yet. MDUE 2022 urnas probably use Ed521 like 2020.
- In every sample `QRCE` has 2 parts, its `IDUE` equals the BU's `IDUE`, and the certificate CN is `UEAO0<IDUE>` or `ueao0<IDUE>`.
- Urnas don't normalise P-521 signatures to low S, so verification must use `lowS: false`.

## Pitfall

When parsing certificates with asn1-schema, never pass a Node `Buffer` view, which may point into a shared pool. Copy it to a fresh `Uint8Array` first.
