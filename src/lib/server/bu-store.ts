import { type BuCargo, type BuSubmission, type VerifiedSubmission } from "../bu";

export interface BuStoreEnv {
  DB: D1Database;
  ORIGINALS: R2Bucket;
}

export type StoreOutcome =
  | { status: "new" | "duplicate"; hash: string }
  | { status: "conflict"; hash: string; existingHash: string };

interface VoteRow {
  idel: number;
  cargo: number;
  kind: "nominal" | "legenda";
  code: string;
  votes: number;
}

function voteRows(cargos: BuCargo[]): VoteRow[] {
  return cargos.flatMap(({ idel, cargo, candidates, parties }) => [
    ...[candidates, ...parties.map((party) => party.candidates)].flatMap((votes) =>
      Object.entries(votes).map(([code, count]) => ({
        idel,
        cargo,
        kind: "nominal" as const,
        code,
        votes: count,
      })),
    ),
    ...parties
      .filter((party) => party.legenda > 0)
      .map((party) => ({
        idel,
        cargo,
        kind: "legenda" as const,
        code: String(party.party),
        votes: party.legenda,
      })),
  ]);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/.test(error.message);
}

/**
 * Stores a verified BU: the submission as received in R2, the votes in D1. A section already stored with
 * the same HASH is a duplicate and discarded; with a different HASH it is a conflict — the first BU is
 * kept and the incoming original is still written to R2 as evidence.
 */
export async function storeBu(
  env: BuStoreEnv,
  submission: BuSubmission,
  { bu, hash, signature }: VerifiedSubmission,
  electionId: string,
  receivedAt = Date.now(),
): Promise<StoreOutcome> {
  const { header } = bu;
  const section = [header.plei, header.uf, header.municipio, header.zona, header.secao] as const;
  const originalKey = `${electionId}/${section.join("/")}/${hash}.json`;

  const existing = () =>
    env.DB.prepare(
      "SELECT hash FROM bu WHERE plei = ? AND uf = ? AND municipio = ? AND zona = ? AND secao = ?",
    )
      .bind(...section)
      .first<string>("hash");

  const resolveExisting = async (existingHash: string): Promise<StoreOutcome> => {
    if (existingHash === hash) return { status: "duplicate", hash };
    await env.ORIGINALS.put(originalKey, JSON.stringify(submission));
    return { status: "conflict", hash, existingHash };
  };

  const stored = await existing();
  if (stored) return resolveExisting(stored);

  await env.ORIGINALS.put(originalKey, JSON.stringify(submission));
  const buId = "(SELECT id FROM bu WHERE hash = ?1)";
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO bu (election_id, plei, turno, fase, uf, municipio, zona, secao, agregadas, urna, hash,
                         algorithm, root, aptos, comparecimento, original_key, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        electionId,
        header.plei,
        header.turno,
        header.fase,
        header.uf,
        header.municipio,
        header.zona,
        header.secao,
        JSON.stringify(header.agregadas),
        header.urna,
        hash,
        signature.algorithm,
        signature.root,
        header.aptos ?? null,
        header.comparecimento ?? null,
        originalKey,
        receivedAt,
      ),
      env.DB.prepare(
        `INSERT INTO bu_cargo (bu_id, idel, cargo, tipo, apta, nominais, legenda, brancos, nulos, total)
         SELECT ${buId}, c.value ->> 'idel', c.value ->> 'cargo', c.value ->> 'tipo', c.value ->> 'apta',
                c.value ->> 'nominais', c.value ->> 'legenda', c.value ->> 'brancos', c.value ->> 'nulos',
                c.value ->> 'total'
           FROM json_each(?2) AS c`,
      ).bind(hash, JSON.stringify(bu.cargos)),
      env.DB.prepare(
        `INSERT INTO bu_vote (bu_id, idel, cargo, kind, code, votes)
         SELECT ${buId}, v.value ->> 'idel', v.value ->> 'cargo', v.value ->> 'kind', v.value ->> 'code',
                v.value ->> 'votes'
           FROM json_each(?2) AS v`,
      ).bind(hash, JSON.stringify(voteRows(bu.cargos))),
    ]);
  } catch (error) {
    // Another request stored this section between our lookup and insert.
    const winner = isUniqueViolation(error) ? await existing() : null;
    if (!winner) throw error;
    return resolveExisting(winner);
  }
  return { status: "new", hash };
}
