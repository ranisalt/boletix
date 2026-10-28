import {
  type Bu,
  BuError,
  buErrorCode,
  type BuErrorCode,
  parseQr,
  type BuQr,
  type CertQr,
  type ParsedQr,
  sealSubmission,
  type BuSubmission,
  TSE_ROOTS,
} from "../bu";

export type ScanResult =
  | { status: "added" | "repeated"; kind: ParsedQr["kind"]; index: number; total: number }
  | { status: "rejected"; error: BuErrorCode };

export type Verification =
  | { ok: true; bu: Bu; submission: BuSubmission }
  | { ok: false; error: BuErrorCode };

/** Every urna certificate seen so far spans two QRs; the first QRCE scanned confirms the count. */
const EXPECTED_CERT_PARTS = 2;

function sameQr(a: ParsedQr, b: ParsedQr): boolean {
  return a.kind === "bu" && b.kind === "bu"
    ? a.content === b.content && a.hash === b.hash
    : JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The QRs of one BU and its urna certificate, scanned in any order. Slots are sized by the `i:n` in each
 * QR header: the first BU QR tells how many BU QRs there are.
 */
export class ScanSession {
  bu: (BuQr | undefined)[] = $state.raw([]);
  certs: (CertQr | undefined)[] = $state.raw(Array.from({ length: EXPECTED_CERT_PARTS }));
  #certsSized = false;

  complete = $derived(this.bu.length > 0 && this.bu.every(Boolean) && this.certs.every(Boolean));

  add(raw: string): ScanResult {
    let qr: ParsedQr;
    try {
      qr = parseQr(raw);
    } catch (error) {
      const code = buErrorCode(error);
      if (code) return { status: "rejected", error: code };
      throw error;
    }
    return qr.kind === "bu" ? this.#addBu(qr) : this.#addCert(qr);
  }

  #addBu(qr: BuQr): ScanResult {
    if (this.bu.length === 0) this.bu = Array.from({ length: qr.total });
    const slot = this.#place(this.bu, qr);
    if (slot.status === "added") this.bu = this.bu.with(qr.index - 1, qr);
    return slot;
  }

  #addCert(qr: CertQr): ScanResult {
    if (!this.#certsSized) {
      this.certs = Array.from({ length: qr.total });
      this.#certsSized = true;
    }
    const other = this.certs.find(Boolean);
    if (other && (other.idue !== qr.idue || other.mdue !== qr.mdue))
      return { status: "rejected", error: "QR_SET_MIXED" };
    const slot = this.#place(this.certs, qr);
    if (slot.status === "added") this.certs = this.certs.with(qr.index - 1, qr);
    return slot;
  }

  #place(slots: (ParsedQr | undefined)[], qr: ParsedQr): ScanResult {
    if (qr.total !== slots.length) return { status: "rejected", error: "QR_SET_MIXED" };
    const existing = slots[qr.index - 1];
    if (existing && !sameQr(existing, qr)) return { status: "rejected", error: "QR_SET_MIXED" };
    return {
      status: existing ? "repeated" : "added",
      kind: qr.kind,
      index: qr.index,
      total: qr.total,
    };
  }

  /** Checks HASH, certificate chain and ASSI locally, before anything is sent. */
  async verify(): Promise<Verification> {
    const parts = this.bu.filter((part): part is BuQr => part !== undefined);
    const certs = this.certs.filter((cert): cert is CertQr => cert !== undefined);
    try {
      if (!this.complete) throw new BuError("QR_SET_INCOMPLETE", "scan every QR first");
      const { bu, submission } = await sealSubmission(parts, certs, TSE_ROOTS);
      return { ok: true, bu, submission };
    } catch (error) {
      const code = buErrorCode(error);
      if (code) return { ok: false, error: code };
      throw error;
    }
  }

  reset(): void {
    this.bu = [];
    this.certs = Array.from({ length: EXPECTED_CERT_PARTS });
    this.#certsSized = false;
  }
}
