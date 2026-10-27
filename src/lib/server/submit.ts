import {
  BuError,
  MAX_QR_CHARS,
  MAX_QR_CODES,
  verifySubmission,
  type Bu,
  type BuSubmission,
  TSE_ROOTS,
} from "../bu";
import { findElection } from "../elections";
import { storeBu, type BuStoreEnv, type StoreOutcome } from "./bu-store";

/** Every QR at full length plus the certificate (hex DER, at most 8192 chars), JSON overhead included. */
export const MAX_BODY_BYTES = MAX_QR_CODES * (MAX_QR_CHARS + 16) + 16 * 1024;

/** The whole body, or undefined as soon as it outgrows the limit, without buffering the rest. */
async function readLimited(request: Request, limit: number): Promise<Uint8Array | undefined> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

const BAD_REQUEST_CODES = new Set<BuError["code"]>([
  "INVALID_FIELD",
  "UNEXPECTED_FIELD",
  "MISSING_FIELD",
  "MALFORMED_TOKEN",
]);

export interface SubmitEnv extends BuStoreEnv {
  SUBMIT_LIMITER: Pick<RateLimit, "limit">;
  /** "true" also accepts simulated (S) and training (T) BUs, for previews fed with TSE samples. */
  ALLOW_TEST_FASES?: string;
}

export function assertPhaseAllowed(
  fase: Bu["header"]["fase"],
  env: Pick<SubmitEnv, "ALLOW_TEST_FASES">,
): void {
  if (fase !== "O" && env.ALLOW_TEST_FASES !== "true") {
    throw new BuError("TEST_PHASE_REJECTED", `FASE:${fase} is not the official vote`);
  }
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
  { clientAddress, report, store = storeBu }: SubmitOptions,
): Promise<Response> {
  if (!(await env.SUBMIT_LIMITER.limit({ key: clientAddress })).success) {
    return json(429, { error: "RATE_LIMITED" });
  }
  // Content-Length can be absent or wrong, so the stream is also cut off at the limit.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: "PAYLOAD_TOO_LARGE" });
  }
  const raw = await readLimited(request, MAX_BODY_BYTES);
  if (!raw) return json(413, { error: "PAYLOAD_TOO_LARGE" });

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json(400, { error: "INVALID_JSON" });
  }

  let outcome: StoreOutcome;
  try {
    const verified = verifySubmission(body, TSE_ROOTS);
    const { proc, plei, turno, fase } = verified.bu.header;
    assertPhaseAllowed(fase, env);
    const election = findElection(proc, plei, turno, "6.0");
    if (!election)
      throw new BuError(
        "UNSUPPORTED_ELECTION",
        `no election for PROC ${proc} PLEI ${plei} TURN ${turno}`,
      );

    outcome = await store(env, body as BuSubmission, verified, election.id);
    if (outcome.status === "conflict") {
      const { uf, municipio, zona, secao } = verified.bu.header;
      report({
        uf,
        municipio,
        zona,
        secao,
        hash: outcome.hash,
        existingHash: outcome.existingHash,
      });
    }
  } catch (error) {
    if (!(error instanceof BuError)) throw error;
    return json(BAD_REQUEST_CODES.has(error.code) ? 400 : 422, { error: error.code });
  }

  const status = { new: 201, duplicate: 200, conflict: 409 }[outcome.status];
  return json(status, { status: outcome.status, hash: outcome.hash });
}
