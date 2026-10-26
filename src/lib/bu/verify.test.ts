import { describe, expect, it } from 'vitest';
import { BuError } from './errors';
import { loadBuFixture, loadBuFixtures } from './fixtures';
import { parseQr, type BuQr, type CertQr } from './parse';
import { TSE_ROOTS } from './tse-roots';
import { verifyBuSignature } from './verify';

function parsed(name: string) {
  const fixture = loadBuFixture(name);
  return {
    parts: fixture.qrbu.map((raw) => parseQr(raw) as BuQr),
    certs: fixture.qrce.map((raw) => parseQr(raw) as CertQr)
  };
}

function expectBuError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(BuError);
    expect((error as BuError).code).toBe(code);
    return;
  }
  expect.fail(`expected BuError ${code}`);
}

const ED521 = 'df-97012-11-178'; // MDUE 2020, Ed521 urna cert issued by AC UE2020
const P521 = 'zz-29386-1-1709'; // MDUE 2013, P-521 urna cert issued by AC URNA

describe('verifyBuSignature', () => {
  it('has signed fixtures for both urna certificate families', () => {
    const withCerts = loadBuFixtures().filter((f) => f.qrce.length > 0);
    expect(withCerts.length).toBe(12);
  });

  it.each(loadBuFixtures().filter((f) => f.qrce.length > 0).map((f) => f.name))(
    'accepts the real BU %s',
    (name) => {
      const { parts, certs } = parsed(name);
      expect(() => verifyBuSignature(parts, certs, TSE_ROOTS)).not.toThrow();
    }
  );

  it('reports Ed521 and the AC UE2020 issuer for an MDUE 2020 urna', () => {
    const { parts, certs } = parsed(ED521);
    expect(verifyBuSignature(parts, certs, TSE_ROOTS)).toEqual({
      algorithm: 'ed521',
      root: 'AC UE2020'
    });
  });

  it('reports ECDSA P-521 and the AC URNA issuer for an MDUE 2013 urna', () => {
    const { parts, certs } = parsed(P521);
    expect(verifyBuSignature(parts, certs, TSE_ROOTS)).toEqual({
      algorithm: 'ecdsa-p521',
      root: 'AC URNA'
    });
  });

  it.each([ED521, P521])('rejects a tampered vote count in %s', (name) => {
    const { parts, certs } = parsed(name);
    const tampered = { ...parts[0]!, content: parts[0]!.content.replace(/APTA:(\d)/, (_, d) => `APTA:${(Number(d) + 1) % 10}`) };
    expectBuError(() => verifyBuSignature([tampered], certs, TSE_ROOTS), 'HASH_MISMATCH');
  });

  it.each([ED521, P521])('rejects a HASH re-signed by nobody in %s', (name) => {
    const { parts, certs } = parsed(name);
    const last = parts.at(-1)!;
    const flipped = last.assi!.slice(0, -2) + (last.assi!.endsWith('00') ? '01' : '00');
    expectBuError(() => verifyBuSignature([{ ...last, assi: flipped }], certs, TSE_ROOTS), 'SIGNATURE_INVALID');
  });

  it('requires ASSI on the BU', () => {
    const { parts, certs } = parsed(ED521);
    const { assi: _assi, ...unsigned } = parts[0]!;
    expectBuError(() => verifyBuSignature([unsigned], certs, TSE_ROOTS), 'SIGNATURE_MISSING');
  });

  it('requires the urna certificate QRs', () => {
    const { parts } = parsed(ED521);
    expectBuError(() => verifyBuSignature(parts, [], TSE_ROOTS), 'CERT_MISSING');
  });

  it('requires every certificate part', () => {
    const { parts, certs } = parsed(ED521);
    expectBuError(() => verifyBuSignature(parts, certs.slice(0, 1), TSE_ROOTS), 'QR_SET_INCOMPLETE');
  });

  it('rejects the certificate of a different urna', () => {
    const { parts } = parsed(P521);
    const { certs } = parsed('zz-29386-1-1710');
    expectBuError(() => verifyBuSignature(parts, certs, TSE_ROOTS), 'CERT_URNA_MISMATCH');
  });

  it.each([ED521, P521])('rejects a certificate not issued by a pinned TSE root (%s)', (name) => {
    const { parts, certs } = parsed(name);
    expectBuError(() => verifyBuSignature(parts, certs, []), 'CERT_INVALID');
  });

  it('rejects certificate bytes that are not X.509', () => {
    const { parts, certs } = parsed(ED521);
    const junk = certs.map((c) => ({ ...c, cert: 'DEADBEEF' }));
    expectBuError(() => verifyBuSignature(parts, junk, TSE_ROOTS), 'CERT_INVALID');
  });
});
