import { describe, expect, it } from 'vitest';
import { loadBuFixture } from '../bu/fixtures';
import { chainHashes } from '../bu/verify';
import { ScanSession } from './scan-session.svelte';

const fixture = loadBuFixture('df-97012-11-178');
const [buQr] = fixture.qrbu as [string];
const [cert1, cert2] = fixture.qrce as [string, string];

/** The fixture's content re-split over `total` QRs, with a valid hash chain (but no valid ASSI). */
function multiPart(total: number): string[] {
  const body = buQr.replace(/^QRBU:1:1 VRQR:6\.0 /, '').replace(/ HASH:.*$/, '');
  const tokens = body.split(' ');
  const size = Math.ceil(tokens.length / total);
  const contents = Array.from({ length: total }, (_, i) => tokens.slice(i * size, (i + 1) * size).join(' '));
  const hashes = chainHashes(contents);
  return contents.map((content, i) => `QRBU:${i + 1}:${total} VRQR:6.0 ${content} HASH:${hashes[i]}${i === total - 1 ? ' ASSI:00' : ''}`);
}

describe('ScanSession', () => {
  it('starts with unknown BU slots and two certificate slots', () => {
    const session = new ScanSession();

    expect(session.bu).toEqual([]);
    expect(session.certs).toEqual([undefined, undefined]);
    expect(session.complete).toBe(false);
  });

  it('sizes the BU slots from the first BU QR, whichever part it is', () => {
    const session = new ScanSession();
    const parts = multiPart(3);

    expect(session.add(parts[1]!)).toEqual({ status: 'added', kind: 'bu', index: 2, total: 3 });
    expect(session.bu.map(Boolean)).toEqual([false, true, false]);

    session.add(parts[2]!);
    session.add(parts[0]!);
    expect(session.bu.map((part) => part?.index)).toEqual([1, 2, 3]);
  });

  it('fills certificate slots in any order', () => {
    const session = new ScanSession();

    expect(session.add(cert2)).toEqual({ status: 'added', kind: 'cert', index: 2, total: 2 });
    expect(session.certs.map(Boolean)).toEqual([false, true]);
    session.add(cert1);
    expect(session.certs.map((cert) => cert?.index)).toEqual([1, 2]);
  });

  it('is complete only once every BU and certificate QR is in', () => {
    const session = new ScanSession();
    session.add(cert1);
    session.add(buQr);
    expect(session.complete).toBe(false);

    session.add(cert2);
    expect(session.complete).toBe(true);
  });

  it('treats a QR scanned twice as repeated', () => {
    const session = new ScanSession();
    session.add(buQr);

    expect(session.add(buQr)).toEqual({ status: 'repeated', kind: 'bu', index: 1, total: 1 });
  });

  it('rejects QRs that belong to another BU or certificate', () => {
    const session = new ScanSession();
    session.add(multiPart(3)[0]!);
    expect(session.add(multiPart(2)[1]!)).toEqual({ status: 'rejected', error: 'QR_SET_MIXED' });
    expect(session.add(multiPart(4)[0]!)).toEqual({ status: 'rejected', error: 'QR_SET_MIXED' });

    session.add(cert1);
    const otherCert = loadBuFixture('zz-29386-1-1709').qrce[1]!;
    expect(session.add(otherCert)).toEqual({ status: 'rejected', error: 'QR_SET_MIXED' });
    expect(session.certs.map(Boolean)).toEqual([true, false]);
  });

  it('does not overwrite a filled slot with a different QR', () => {
    const session = new ScanSession();
    const first = multiPart(2)[0]!;
    session.add(first);

    const impostor = first.replace(/HASH:[0-9A-F]+/, `HASH:${'A'.repeat(128)}`);
    expect(session.add(impostor)).toEqual({ status: 'rejected', error: 'QR_SET_MIXED' });
    expect(session.bu[0]?.hash).toBe(first.match(/HASH:([0-9A-F]+)/)![1]);
  });

  it('rejects text that is not a BU or certificate QR', () => {
    expect(new ScanSession().add('https://example.com')).toMatchObject({ status: 'rejected' });
  });

  it('verifies a complete scan and builds the submission', () => {
    const session = new ScanSession();
    for (const raw of [cert2, buQr, cert1]) session.add(raw);

    const result = session.verify();
    expect(result).toMatchObject({
      ok: true,
      bu: { header: { uf: 'DF', zona: 11, secao: 178 } },
      submission: { hash: expect.stringMatching(/^[0-9A-F]{128}$/) }
    });
  });

  it('reports why a complete scan fails verification', () => {
    const session = new ScanSession();
    const other = loadBuFixture('zz-29386-1-1709').qrce;
    for (const raw of [buQr, ...other]) session.add(raw);

    expect(session.verify()).toEqual({ ok: false, error: 'CERT_URNA_MISMATCH' });
  });

  it('starts over on reset', () => {
    const session = new ScanSession();
    session.add(buQr);
    session.add(cert1);
    session.reset();

    expect(session.bu).toEqual([]);
    expect(session.certs).toEqual([undefined, undefined]);
  });
});
