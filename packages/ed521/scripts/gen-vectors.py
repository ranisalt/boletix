#!/usr/bin/env python3
"""Generate test/vectors/ed521.json.

Reference implementation: ECPy (https://github.com/cslashm/ECPy) at commit
8143d9ac017de0cb7f980bedaf56cefe6b4d9180, the revision pinned by the TSE
manual (manual-do-qr-code-no-boletim-de-urna.pdf, §1.6.3.1, pp. 22-23).

Not published. Run from a scratch venv that has ECPy and asn1crypto:

    python3 -m venv $SCRATCH/ecpy-venv
    $SCRATCH/ecpy-venv/bin/pip install \
        "git+https://github.com/cslashm/ECPy.git@8143d9ac017de0cb7f980bedaf56cefe6b4d9180" \
        asn1crypto
    $SCRATCH/ecpy-venv/bin/python packages/ed521/scripts/gen-vectors.py

Output is deterministic: keys and messages come from a fixed PRNG seed.
"""

import base64
import hashlib
import json
import random
import re
from pathlib import Path

from ecpy.curves import Curve
from ecpy.eddsa import EDDSA
from ecpy.keys import ECPrivateKey, ECPublicKey

PKG = Path(__file__).resolve().parents[1]
FIXTURES = PKG.parents[1] / "fixtures" / "2026"
OUT = PKG / "test" / "vectors" / "ed521.json"

ED521_OID = "1.3.6.1.4.1.44588.2.1"
CURVE = Curve.get_curve("Ed521")
SIZE = 66  # coordinate and scalar width in bytes
SIG_SIZE = 2 * SIZE
DIGEST = hashlib.shake_256
DIGEST_LEN = 2 * SIZE  # 132 bytes: SHAKE256 output split into scalar || prefix


def ecpy_sign_vector(rng: random.Random, msg_len: int) -> dict:
    seed = bytes(rng.getrandbits(8) for _ in range(SIZE))
    msg = bytes(rng.getrandbits(8) for _ in range(msg_len))
    d = int.from_bytes(seed, "big")  # ECPy: k = d.to_bytes(66, "big") == seed
    sk = ECPrivateKey(d, CURVE)
    ed = EDDSA(DIGEST, hash_len=DIGEST_LEN)
    pub = EDDSA.get_public_key(sk, DIGEST, DIGEST_LEN)
    pub_bytes = CURVE.encode_point(pub.W)
    sig = ed.sign(msg, sk)
    assert ed.verify(msg, sig, pub), "ECPy failed to verify its own signature"
    assert len(pub_bytes) == SIZE and len(sig) == SIG_SIZE
    return {
        "secretKey": seed.hex(),
        "publicKey": pub_bytes.hex(),
        "message": msg.hex(),
        "context": "",
        "signature": bytes(sig).hex(),
    }


def der_children(buf: bytes) -> list[tuple[int, bytes]]:
    """Split a DER constructed value into (tag, content) pairs."""
    out, i = [], 0
    while i < len(buf):
        tag = buf[i]
        length, i = buf[i + 1], i + 2
        if length & 0x80:
            n = length & 0x7F
            length, i = int.from_bytes(buf[i : i + n], "big"), i + n
        out.append((tag, buf[i : i + length]))
        i += length
    return out


def spki_from_cert(der: bytes) -> tuple[str, bytes]:
    """Return (algorithm OID, subjectPublicKey bytes) of an X.509 certificate."""
    cert = der_children(der)[0][1]  # Certificate SEQUENCE
    tbs = der_children(cert)[0][1]  # TBSCertificate SEQUENCE
    spki = der_children(der_children(tbs)[6][1])  # subjectPublicKeyInfo fields
    oid_tag, oid = der_children(spki[0][1])[0]
    assert oid_tag == 0x06
    bits_tag, bits = spki[1]
    assert bits_tag == 0x03 and bits[0] == 0, "BIT STRING with unused bits"
    return decode_oid(oid), bits[1:]


def decode_oid(raw: bytes) -> str:
    parts = [raw[0] // 40, raw[0] % 40]
    value = 0
    for b in raw[1:]:
        value = (value << 7) | (b & 0x7F)
        if not b & 0x80:
            parts.append(value)
            value = 0
    return ".".join(map(str, parts))


def fields(path: Path) -> dict:
    out = {}
    for token in path.read_text().split():
        key, _, value = token.partition(":")
        out.setdefault(key, value)
    return out


def tse_vectors() -> list[dict]:
    vectors = []
    for bu in sorted(FIXTURES.glob("*/qrbu-1.txt")):
        d = bu.parent
        qrce = sorted(d.glob("qrce-*.txt"))
        if not qrce or fields(qrce[0]).get("MDUE") != "2020":
            continue  # only Ed521 cert chains (MDUE 2020); P-521 is WebCrypto
        cert_hex = "".join(fields(p)["CERT"] for p in qrce)
        pem = bytes.fromhex(cert_hex).decode("ascii")
        body = re.sub(r"-----[^-]+-----|\s", "", pem)
        alg_oid, pub = spki_from_cert(base64.b64decode(body))
        assert alg_oid == ED521_OID, bu
        hash_hex = fields(bu)["HASH"]
        asn = fields(bu)["ASSI"]
        sig = bytes.fromhex(asn)
        msg = hashlib.sha512(bytes.fromhex(hash_hex)).digest()
        assert len(pub) == SIZE and len(sig) == SIG_SIZE, bu
        pub_pt = CURVE.decode_point(pub)
        assert EDDSA(DIGEST, hash_len=DIGEST_LEN).verify(msg, sig, ECPublicKey(pub_pt)), bu
        vectors.append(
            {
                "id": d.name,
                "publicKey": pub.hex(),
                "message": msg.hex(),
                "signature": sig.hex(),
            }
        )
    # fixtures/2026 holds only two MDUE:2020 (Ed521) BUs; the plan asked for >=3.
    assert len(vectors) >= 2, f"expected >=2 Ed521 TSE vectors, got {len(vectors)}"
    return vectors


def main() -> None:
    rng = random.Random(0x521)
    ecpy = []
    for msg_len in (0, 1, 64, 1023):
        for _ in range(2):
            ecpy.append(ecpy_sign_vector(rng, msg_len))
    doc = {
        "$source": "ECPy 8143d9ac017de0cb7f980bedaf56cefe6b4d9180 (scripts/gen-vectors.py)",
        "ecpy": ecpy,
        "tse": tse_vectors(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"wrote {OUT}: {len(ecpy)} ECPy, {len(doc['tse'])} TSE vectors")


if __name__ == "__main__":
    main()
