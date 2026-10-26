import { describe, expect, it } from 'vitest';
import { BuError } from './errors';
import { loadBuFixture, loadBuFixtures } from './fixtures';
import { parseQr, type BuQr, type CertQr } from './parse';
import { toSubmission, verifySubmission, type BuSubmission } from './submission';
import { TSE_ROOTS } from './tse-roots';
import { chainHashes } from './verify';

/** What an attacker would do: alter the contents and send their recomputed HASH. */
function withContents(submission: BuSubmission, contents: string[]): BuSubmission {
  return { ...submission, contents, hash: chainHashes(contents).at(-1)! };
}

function scan(name: string): { parts: BuQr[]; certs: CertQr[] } {
  const fixture = loadBuFixture(name);
  return {
    parts: fixture.qrbu.map((raw) => parseQr(raw) as BuQr),
    certs: fixture.qrce.map((raw) => parseQr(raw) as CertQr)
  };
}

function submissionFor(name: string): BuSubmission {
  const { parts, certs } = scan(name);
  return toSubmission(parts, certs);
}

function expectErrorCode(action: () => unknown, code: BuError['code']): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(BuError);
  expect((thrown as BuError).code).toBe(code);
}

const ED521 = 'df-97012-11-178';
const ECDSA = 'zz-29386-1-1709';

describe('toSubmission', () => {
  it('keeps only each QR content, the final HASH, the ASSI and the certificate as DER hex', () => {
    const { parts } = scan(ECDSA);
    const submission = submissionFor(ECDSA);

    expect(Object.keys(submission).sort()).toEqual(['assi', 'certDer', 'contents', 'hash']);
    expect(submission.contents).toEqual([parts[0]!.content.trimEnd()]);
    expect(submission.hash).toBe(parts[0]!.hash.toUpperCase());
    expect(submission.assi).toBe(parts[0]!.assi);
    expect(submission.certDer).toMatch(/^30[0-9a-f]+$/);
  });

  it('converts a PEM-printed certificate to DER', () => {
    expect(submissionFor(ED521).certDer).toMatch(/^30[0-9a-f]+$/);
  });

  it('refuses to build a submission before every certificate QR is scanned', () => {
    const { parts, certs } = scan(ECDSA);
    expectErrorCode(() => toSubmission(parts, certs.slice(1)), 'QR_SET_INCOMPLETE');
  });
});

describe('verifySubmission', () => {
  it.each(loadBuFixtures().filter((f) => f.qrce.length > 0).map((f) => f.name))(
    'accepts the real BU %s and returns the assembled BU',
    (name) => {
      const { parts } = scan(name);
      const result = verifySubmission(submissionFor(name), TSE_ROOTS);

      expect(result.hash).toBe(parts.at(-1)!.hash.toUpperCase());
      expect(result.bu.header.urna).toBe(parts[0]!.tokens.find(([key]) => key === 'IDUE')?.[1]);
      expect(result.signature.algorithm).toMatch(/^(ed521|ecdsa-p521)$/);
    }
  );

  it('survives a JSON round trip', () => {
    const wire = JSON.parse(JSON.stringify(submissionFor(ED521)));
    expect(verifySubmission(wire, TSE_ROOTS).signature.algorithm).toBe('ed521');
  });

  it('rejects client-supplied fields beyond the signed data', () => {
    expectErrorCode(
      () => verifySubmission({ ...submissionFor(ECDSA), verified: true }, TSE_ROOTS),
      'UNEXPECTED_FIELD'
    );
    expectErrorCode(
      () => verifySubmission({ ...submissionFor(ECDSA), votes: { '13': 1 } }, TSE_ROOTS),
      'UNEXPECTED_FIELD'
    );
  });

  it('rejects a HASH that does not match the submitted contents', () => {
    expectErrorCode(
      () => verifySubmission({ ...submissionFor(ECDSA), hash: 'A'.repeat(128) }, TSE_ROOTS),
      'HASH_MISMATCH'
    );
  });

  it('rejects malformed payloads', () => {
    const valid = submissionFor(ECDSA);
    for (const bad of [
      null,
      'x',
      { ...valid, contents: [] },
      { ...valid, contents: 'ORIG:VOTA' },
      { ...valid, assi: 'not hex' },
      { ...valid, hash: 'ABC' },
      { ...valid, certDer: '' },
      { assi: valid.assi, certDer: valid.certDer }
    ]) {
      expectErrorCode(() => verifySubmission(bad, TSE_ROOTS), 'INVALID_FIELD');
    }
  });

  it('rejects altered vote content as a bad signature', () => {
    const valid = submissionFor(ECDSA);
    const content = valid.contents[0]!.replace(/APTA:(\d+)/, (_: string, n: string) => `APTA:${Number(n) + 1}`);
    expect(content).not.toBe(valid.contents[0]);
    expectErrorCode(
      () => verifySubmission(withContents(valid, [content]), TSE_ROOTS),
      'SIGNATURE_INVALID'
    );
  });

  it('rejects content split at boundaries the urna did not print', () => {
    const valid = submissionFor(ECDSA);
    const tokens = valid.contents[0]!.split(' ');
    const half = Math.floor(tokens.length / 2);
    const resplit = [tokens.slice(0, half).join(' '), tokens.slice(half).join(' ')];
    expectErrorCode(
      () => verifySubmission(withContents(valid, resplit), TSE_ROOTS),
      'SIGNATURE_INVALID'
    );
  });

  it("rejects another urna's certificate", () => {
    const valid = submissionFor(ECDSA);
    const other = submissionFor('zz-29386-1-1710');
    expectErrorCode(
      () => verifySubmission({ ...valid, certDer: other.certDer }, TSE_ROOTS),
      'CERT_URNA_MISMATCH'
    );
  });

  it('rejects a certificate that is not issued by a pinned TSE root', () => {
    expectErrorCode(() => verifySubmission(submissionFor(ECDSA), []), 'CERT_INVALID');
  });

  it('rejects a certificate that is not X.509', () => {
    expectErrorCode(
      () => verifySubmission({ ...submissionFor(ECDSA), certDer: '3003020101' }, TSE_ROOTS),
      'CERT_INVALID'
    );
  });
});
