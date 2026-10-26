import { BuError } from '../bu/errors';
import { verifySubmission, type BuSubmission } from '../bu/submission';
import { TSE_ROOTS } from '../bu/tse-roots';
import { findElection } from '../elections';
import { storeBu, type BuStoreEnv, type StoreOutcome } from './bu-store';

/** 64 QRs of at most 1100 characters plus the certificate, with room to spare. */
export const MAX_BODY_BYTES = 128 * 1024;

const BAD_REQUEST_CODES = new Set<BuError['code']>(['INVALID_FIELD', 'UNEXPECTED_FIELD', 'MISSING_FIELD', 'MALFORMED_TOKEN']);

export interface SubmitEnv extends BuStoreEnv {
  SUBMIT_LIMITER: Pick<RateLimit, 'limit'>;
}

export interface ConflictReport {
  uf: string;
  municipio: number;
  zona: number;
  secao: number;
  hash: string;
  existingHash: string;
}

export interface SubmitOptions {
  clientAddress: string;
  /** Raises the "should be impossible" case — two different signed BUs for one section. */
  report: (conflict: ConflictReport) => void;
  store?: typeof storeBu;
}

const json = (status: number, body: object) => Response.json(body, { status });

export async function handleSubmission(
  request: Request,
  env: SubmitEnv,
  { clientAddress, report, store = storeBu }: SubmitOptions
): Promise<Response> {
  if (!(await env.SUBMIT_LIMITER.limit({ key: clientAddress })).success) {
    return json(429, { error: 'RATE_LIMITED' });
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: 'PAYLOAD_TOO_LARGE' });
  }
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) return json(413, { error: 'PAYLOAD_TOO_LARGE' });

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json(400, { error: 'INVALID_JSON' });
  }

  let outcome: StoreOutcome;
  try {
    const verified = verifySubmission(body, TSE_ROOTS);
    const { proc, plei } = verified.bu.header;
    const election = findElection(proc, plei, '6.0');
    if (!election) throw new BuError('UNSUPPORTED_ELECTION', `no election for PROC ${proc} PLEI ${plei}`);

    outcome = await store(env, body as BuSubmission, verified, election.id);
    if (outcome.status === 'conflict') {
      const { uf, municipio, zona, secao } = verified.bu.header;
      report({ uf, municipio, zona, secao, hash: outcome.hash, existingHash: outcome.existingHash });
    }
  } catch (error) {
    if (!(error instanceof BuError)) throw error;
    return json(BAD_REQUEST_CODES.has(error.code) ? 400 : 422, { error: error.code });
  }

  const status = { new: 201, duplicate: 200, conflict: 409 }[outcome.status];
  return json(status, { status: outcome.status, hash: outcome.hash });
}
