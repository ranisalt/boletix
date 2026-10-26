# Empirical findings from real BUs

## Hash content (verified on both 2026 VRQR 6.0 and 2022 VRQR 1.5 single-QR samples)
- `HASH = SHA-512(content)`, uppercase hex.
- `content` = all tokens AFTER the QR header tokens (`QRBU`, `VRQR`, and `VRCH` when present) up to, but not including, ` HASH:`, joined by single spaces.
- `VRCH` (2022 only) is a header token. It is NOT in the 2026 manual.
- The multi-QR chain rule is still unverified: we are waiting on a multi-QR sample.

## Signature
- Neither sample has QRCE (certificate) QRs. Single-QR BUs are signed by a TSE key, not by the urna cert.
- 2026: ASSI is DER `SEQUENCE{INTEGER r(66B), INTEGER s(66B)}`, i.e. **ECDSA P-521**. Key: `s99999br-av.js` (user-confirmed).
- 2022: ASSI is 64 raw bytes, i.e. **Ed25519**. The key is probably a different (2022) TSE key, still to be found.
- Signed message (prehash or not) is unverified: we need the key file. TSE's Akamai blocks curl from here.

## s99999br-av.js key (supplied by the user)
- SPKI: `AlgorithmIdentifier{ OID 1.3.101.100 (2B 65 64), params 0A 01 01 = ENUMERATED 1 }` + a 32-byte key. This is NOT the standard Ed25519 OID (1.3.101.112).
- It is a 32-byte EdDSA key, so it can NOT verify the 2026 ASSI, which is DER ECDSA with 66-byte P-521 integers.
- Tried Ed25519 verify of the 2022 ASSI (64 B) with this key over: the raw hash, sha512(hash), hash hex upper/lower, the content, the full QR without HASH, and with HASH. **None verified.**
- Conclusion: this key signs the names JSON (manual p. 32), not the BUs. BU signatures need another key (urna cert / per-election key).

## BU signature: 2022 VERIFIED
- Key URL pattern: `https://qrcodenobu.tse.jus.br/tse.qrcodebu/{VRCH}/LEGAL/{f}{uf}qrcode.pub`, where `f` is o=oficial or s=simulado and `uf` is lowercase, `zz` for exterior. The file is a raw 32-byte Ed25519 public key.
- 2022 ZZ: `tse.qrcodebu/20220829/LEGAL/ozzqrcode.pub` = `4e24b29d3cd53fb397d938c8c5e60338c9774aa9a90fc72ee246cf0ad8283263` (archive.org snapshot 20260618113228).
- **Signed message = raw bytes of the HASH (hex-decoded, 64 bytes); Ed25519. Verified against fixtures/2022/zz-30198-1-265.**
- One key per (fase, UF), so the key must be chosen by `UNFE`.
- Archived directories: `20180618`, `20220829`, `20240507`. Nothing for 2026 is archived. The 2026 BU has no `VRCH`, and its ASSI is ECDSA P-521 DER, so the 2026 key location and format are still unknown.
- `qrcode-bu/chavesqrcodeoficial.zip` (archived 2022) holds 2016-era keys, so it is obsolete.

## Boletim na Mão 4.0.5 APK: findings (from the bundle `assets/public/7176.*.js`)
Two verification paths exist in the app:
1. **Legacy, VRCH present (≤2022):**
   - Key: `GET https://qrcodenobu.tse.jus.br/tse.qrcodebu/${VRCH ?? 'v15'}/LEGAL/${FASE.lower}${UNFE.lower}qrcode.pub`, a raw 32-byte Ed25519 key.
   - Check: `nacl.sign.detached.verify(unhex(HASH), unhex(ASSI), key)`. Verified on the 2022 fixture.
   - Note that the file prefix is the FASE token (`O` gives `o`).
2. **V6 (2026):** the ASSI is checked against the **urna certificate carried in the QRCE QR codes**. The app's function `ap()`:
   - Recompute HASH from the QRBU segments; a mismatch is invalid.
   - Concatenate the `CERT` hex of every `QRCE:i:n` in order of i, then parse it as X.509.
   - Algorithm by SPKI OID: `1.3.6.1.4.1.44588.2.1` is Ed521; `1.2.840.10045.2.1` is ECDSA secp521r1.
   - Chain: the certificate's signature over its TBS must verify under one of the embedded TSE CA certs (`fixtures/tse-roots/`). For ECDSA the message is `sha512(tbs)`, verified with `prehash:false, lowS:false, format:'der'`, which is plain ECDSA-SHA512. For Ed521 the message is the TBS itself.
   - ASSI: for ECDSA, `p521.verify(ASSI_der, sha512(unhex(HASH)), certPub, {prehash:false, lowS:false})`, i.e. ECDSA-SHA512 over the raw HASH bytes. For Ed521, Ed521-verify over `unhex(HASH)` with context `SigEd521`.
   - With no QRCE the app reports the signature as incomplete ("QRCE necessário"). It also has a server fallback: `POST https://etitulo.tse.jus.br/proxy/api/api/bu/assinatura/verificar`.
- Embedded CA certs (keys 2013=2015, 2020, 2022):
  - AC URNA (issued by AC RAIZ UE; expires 2026-07-18), sha256 `DC:20:A4…731D`.
  - AC UE2020 (issued by AC URNA v2), sha256 `77:F3:1B…0376`.
  - AC UE2022 (issued by AC URNA v2), sha256 `6A:E6:57…A293`.
  - These are intermediates; the app trusts them directly.
- So the single-QR 2026 fixture cannot be verified without its QRCE codes. A full multi-QR example is needed.

## Akamai blocking: diagnosed
Akamai filters on the User-Agent. Browser UAs, `okhttp` and an empty UA get 403. `Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/AP2A)` gets 200 reliably from our Swedish IP. Live data confirms:
- `20220829/LEGAL/ozzqrcode.pub` = `4e24b29d…3263`, which matches the archive and verifies.
- `20240507` = `b39111e0…06a2`. This equals `~/Downloads/ozzqrcode.pub`, so the user's file is the 2024 key, not the 2022 one.
- A Worker fetching these files must send a Dalvik-like UA, or the files must be pinned in the repo, which is preferred.

## Verified against 12 real 2026 BUs (photos/ → fixtures/2026/*) — authoritative
All 12 pass: HASH recomputation, certificate chain, ASSI. Two urna-certificate families coexist in 2026:

| MDUE | QRCE `CERT` hex decodes to | Leaf key / sig | Issuer (pinned in fixtures/tse-roots) | ASSI |
|---|---|---|---|---|
| 2013, 2015 | **DER** (946 hex chars/part) | ECDSA P-521, `ecdsa-with-SHA512` | AC URNA (`2013.pem`, P-521, notAfter 2026-07-18) | DER ECDSA, 139 B; verify ECDSA-SHA512 over **raw HASH bytes** (= P-521 `prehash:true` on HASH bytes, or `prehash:false` on sha512(HASH bytes)) |
| 2020 | **PEM text** (1034 hex chars/part) | Ed521 (OID 1.3.6.1.4.1.44588.2.1) | AC UE2020 (`2020.pem`, Ed521) | raw R‖S 132 B; Ed521 PureEdDSA (`SigEd521\0\0` dom) over **sha512(HASH bytes)** |

- Leaf cert signature: Ed521 over raw TBS bytes (not prehashed) for AC UE2020; standard ecdsa-with-SHA512 for AC URNA.
- AC URNA expired 2026-07-18 but still certifies most 2026 urnas (leaf notAfter 2027/2030) → do NOT enforce issuer expiry; trust the pinned certs directly (as the TSE app does).
- No AC UE2022-issued urna seen yet (MDUE 2022 expected to be Ed521 like 2020 — unconfirmed).
- QRCE always 2 parts here; IDUE in QRCE equals the BU's IDUE; leaf CN = `UEAO0<IDUE>` / `ueao0<IDUE>`.
- All 12 are single-QR BUs (QRBU:1:1); multi-QR hash chaining still unconfirmed.
- asn1-schema pitfall: never pass a Node `Buffer` view (pooled); copy to a fresh `Uint8Array` first.
