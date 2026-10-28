import { chainHashes } from "./chain.ts";
import { BuError } from "./errors.ts";
import type { BuQr } from "./parse.ts";
import { tokenize } from "./tokenize.ts";

// Field names follow the TSE "Manual do QR Code no Boletim de Urna" (docs/tse/2026); the QR key each
// one comes from is noted where the name alone doesn't say it.

/** One office (cargo) of one election inside the BU. */
export type BuCargo = {
  /** IDEL: the election this cargo belongs to; a BU can carry several. */
  idel: number;
  cargo: number;
  /** TIPO: 0 majoritário, 1 proporcional (votes grouped by party), 2 consulta. */
  tipo: 0 | 1 | 2;
  /** VERC: version of the candidate data package loaded on the urna. */
  verc: string;
  /** Proporcional only; majoritário and consulta use `candidates`. */
  parties: { party: number; candidates: Record<string, number>; legenda: number; total: number }[];
  candidates: Record<string, number>;
  /** APTA: electors eligible for this cargo. */
  apta: number;
  /** NOMI: votes for a candidate number (as opposed to legenda, branco or nulo). */
  nominais: number;
  legenda: number;
  brancos: number;
  nulos: number;
  total: number;
};

export type Bu = {
  header: {
    /** ORIG: printed by the urna (VOTA), by the Recuperador de Dados (RED) or by the Sistema de Apuração (SA). */
    orig: "VOTA" | "RED" | "SA";
    proc: number;
    plei: number;
    turno: 1 | 2;
    /** FASE: oficial, simulado or treinamento. */
    fase: "O" | "S" | "T";
    dtpl: string;
    uf: string;
    municipio: number;
    zona: number;
    secao: number;
    agregadas: number[];
    /** IDUE: urna serial number. */
    urna: string;
    /** IDCA: identifier of the software/data load (carga) on the urna. */
    idca: string;
    /** VERS: urna software version. */
    vers: string;
    aptos?: number;
    comparecimento?: number;
    faltosos?: number;
  };
  cargos: BuCargo[];
};

type Token = [string, string];
type Origin = Bu["header"]["orig"];

// --- Header field rules: which keys each ORIG may carry, and which must be numeric ----------

const COMMON_HEADER_KEYS = new Set([
  "ORIG",
  "ORLC",
  "PROC",
  "DTPL",
  "PLEI",
  "TURN",
  "FASE",
  "UNFE",
  "MUNI",
  "ZONA",
  "SECA",
  "AGRE",
  "IDUE",
  "IDCA",
  "HIQT",
  "HICA",
  "VERS",
]);
const VOTA_RED_HEADER_KEYS = new Set([
  "LOCA",
  "APTO",
  "APTS",
  "APTT",
  "COMP",
  "FALT",
  "HBBM",
  "HBBG",
  "HBSB",
  "DTAB",
  "HRAB",
  "DTFC",
  "HRFC",
]);
const SA_HEADER_KEYS = new Set(["JUNT", "TURM"]);
// Emission date/time: printed by RED and SA, never by the urna itself.
const SA_RED_HEADER_KEYS = new Set(["DTEM", "HREM"]);
// HICA is the load history, one entry per load (count in HIQT).
const REPEATED_HEADER_KEYS = new Set(["HICA"]);
const NUMBER_FIELDS = new Set([
  "PROC",
  "PLEI",
  "TURN",
  "MUNI",
  "ZONA",
  "SECA",
  "IDUE",
  "HIQT",
  "LOCA",
  "APTO",
  "APTS",
  "APTT",
  "COMP",
  "FALT",
  "HBBM",
  "HBBG",
  "HBSB",
  "JUNT",
  "TURM",
  "DTPL",
  "DTAB",
  "HRAB",
  "DTFC",
  "HRFC",
  "DTEM",
  "HREM",
]);
// The first of these ends a cargo's candidate list.
const CARGO_SUMMARY_KEYS = new Set([
  "APTA",
  "APTS",
  "APTT",
  "CSEC",
  "NOMI",
  "LEGC",
  "BRAN",
  "NULO",
  "TOTC",
]);

// --- Token cursor helpers ------------------------------------------------------------------

function failMissing(key: string): never {
  throw new BuError("MISSING_FIELD", `missing ${key}`);
}

function failUnexpected(key: string, context: string): never {
  throw new BuError("UNEXPECTED_FIELD", `unexpected ${key} in ${context}`);
}

function parseNumber(value: string, field: string): number {
  if (!/^\d+$/.test(value) || value.length > 9) {
    throw new BuError("INVALID_FIELD", `${field} must be at most 9 digits`);
  }
  return Number(value);
}

function requireValue(
  tokens: Token[],
  cursor: number,
  key: string,
): { value: string; next: number } {
  const token = tokens[cursor];
  if (!token) return failMissing(key);
  if (token[0] !== key) return failMissing(key);
  return { value: token[1], next: cursor + 1 };
}

function requireNumber(
  tokens: Token[],
  cursor: number,
  key: string,
): { value: number; next: number } {
  const found = requireValue(tokens, cursor, key);
  return { value: parseNumber(found.value, key), next: found.next };
}

function optionalNumber(
  tokens: Token[],
  cursor: number,
  key: string,
): { value?: number; next: number } {
  if (tokens[cursor]?.[0] !== key) return { next: cursor };
  const found = requireNumber(tokens, cursor, key);
  return { value: found.value, next: found.next };
}

function allowedHeaderKey(key: string, origin: Origin): boolean {
  return (
    COMMON_HEADER_KEYS.has(key) ||
    (origin !== "SA" && VOTA_RED_HEADER_KEYS.has(key)) ||
    (origin === "SA" && SA_HEADER_KEYS.has(key)) ||
    (origin !== "VOTA" && SA_RED_HEADER_KEYS.has(key))
  );
}

// --- Header ---------------------------------------------------------------------------------

// APTS/APTT are kept beside the header only to cross-check APTO.
type ParsedHeader = { header: Bu["header"]; apts?: number; aptt?: number };

function parseHeader(tokens: Token[], electionIndex: number): ParsedHeader {
  const headerTokens = tokens.slice(0, electionIndex);
  const originEntry = headerTokens[0];
  if (!originEntry || originEntry[0] !== "ORIG") failMissing("ORIG at the start of the BU header");

  const origin = originEntry[1];
  if (origin !== "VOTA" && origin !== "RED" && origin !== "SA") {
    throw new BuError("INVALID_FIELD", `unsupported ORIG:${origin}`);
  }

  const values = new Map<string, string>();
  for (const [key, value] of headerTokens) {
    if (!allowedHeaderKey(key, origin)) failUnexpected(key, "BU header");
    if (values.has(key) && !REPEATED_HEADER_KEYS.has(key))
      failUnexpected(key, "duplicate BU header field");
    values.set(key, value);

    if (NUMBER_FIELDS.has(key)) parseNumber(value, key);
  }

  const requiredKeys = [
    "PROC",
    "DTPL",
    "PLEI",
    "TURN",
    "FASE",
    "UNFE",
    "MUNI",
    "ZONA",
    "SECA",
    "IDUE",
    "IDCA",
    "VERS",
  ];
  for (const key of requiredKeys) if (!values.has(key)) failMissing(key);
  for (const key of ["HIQT", "HICA"]) if (!values.has(key)) failMissing(key);
  if (origin !== "SA") {
    for (const key of ["APTS", "APTT"]) if (!values.has(key)) failMissing(key);
  }

  const turno = parseNumber(values.get("TURN")!, "TURN");
  if (turno !== 1 && turno !== 2) throw new BuError("INVALID_FIELD", "TURN must be 1 or 2");
  const fase = values.get("FASE");
  if (fase !== "O" && fase !== "S" && fase !== "T") {
    throw new BuError("INVALID_FIELD", "FASE must be O, S, or T");
  }
  const dtpl = values.get("DTPL")!;
  if (!/^\d{8}$/.test(dtpl)) throw new BuError("INVALID_FIELD", "DTPL must be YYYYMMDD");
  if (values.has("ORLC") && values.get("ORLC") !== "LEG" && values.get("ORLC") !== "COM") {
    throw new BuError("INVALID_FIELD", "ORLC must be LEG or COM");
  }
  const uf = values.get("UNFE")!;
  if (!/^[A-Z]{2}$/.test(uf))
    throw new BuError("INVALID_FIELD", "UNFE must be a two-letter UF code");
  const idca = values.get("IDCA")!;
  if (!/^\d{24}$/.test(idca)) throw new BuError("INVALID_FIELD", "IDCA must contain 24 digits");
  const vers = values.get("VERS")!;
  if (!/^\d+(?:\.\d+)*$/.test(vers))
    throw new BuError("INVALID_FIELD", "VERS must contain digits and dots");

  let agregadas: number[] = [];
  const agregadasRaw = values.get("AGRE");
  if (agregadasRaw) agregadas = agregadasRaw.split(".").map((value) => parseNumber(value, "AGRE"));

  const header: Bu["header"] = {
    orig: origin,
    proc: parseNumber(values.get("PROC")!, "PROC"),
    plei: parseNumber(values.get("PLEI")!, "PLEI"),
    turno,
    fase,
    dtpl,
    uf,
    municipio: parseNumber(values.get("MUNI")!, "MUNI"),
    zona: parseNumber(values.get("ZONA")!, "ZONA"),
    secao: parseNumber(values.get("SECA")!, "SECA"),
    agregadas,
    urna: values.get("IDUE")!,
    idca,
    vers,
  };

  if (values.has("APTO")) header.aptos = parseNumber(values.get("APTO")!, "APTO");
  if (values.has("COMP")) header.comparecimento = parseNumber(values.get("COMP")!, "COMP");
  if (values.has("FALT")) header.faltosos = parseNumber(values.get("FALT")!, "FALT");

  return {
    header,
    ...(values.has("APTS") ? { apts: parseNumber(values.get("APTS")!, "APTS") } : {}),
    ...(values.has("APTT") ? { aptt: parseNumber(values.get("APTT")!, "APTT") } : {}),
  };
}

// --- Cargo body -----------------------------------------------------------------------------

function parseCargo(tokens: Token[], cursor: number): { cargo: BuCargo; next: number } {
  const cargoValue = requireNumber(tokens, cursor, "CARG");
  const tipoValue = requireNumber(tokens, cargoValue.next, "TIPO");
  if (tipoValue.value !== 0 && tipoValue.value !== 1 && tipoValue.value !== 2) {
    throw new BuError("INVALID_FIELD", "TIPO must be 0, 1, or 2");
  }
  const vercValue = requireValue(tokens, tipoValue.next, "VERC");
  if (!/^\d+$/.test(vercValue.value))
    throw new BuError("INVALID_FIELD", "VERC must contain digits");

  const tipo = tipoValue.value as 0 | 1 | 2;
  let next = vercValue.next;
  const parties: BuCargo["parties"] = [];
  const candidates: Record<string, number> = {};

  if (tipo === 1) {
    while (tokens[next]?.[0] === "PART") {
      const partyValue = requireNumber(tokens, next, "PART");
      next = partyValue.next;
      const partyCandidates: Record<string, number> = {};

      while (tokens[next] && tokens[next]![0] !== "LEGP") {
        const [key, value] = tokens[next]!;
        if (!/^\d+$/.test(key)) failUnexpected(key, "proportional party candidates");
        if (key in partyCandidates) failUnexpected(key, "duplicate candidate");
        partyCandidates[key] = parseNumber(value, `candidate ${key}`);
        next += 1;
      }

      const legendaValue = requireNumber(tokens, next, "LEGP");
      const totalValue = requireNumber(tokens, legendaValue.next, "TOTP");
      parties.push({
        party: partyValue.value,
        candidates: partyCandidates,
        legenda: legendaValue.value,
        total: totalValue.value,
      });
      next = totalValue.next;
    }
  } else {
    while (tokens[next] && !CARGO_SUMMARY_KEYS.has(tokens[next]![0])) {
      const [key, value] = tokens[next]!;
      if (!/^\d+$/.test(key)) failUnexpected(key, "majoritarian or consultation candidates");
      if (key in candidates) failUnexpected(key, "duplicate candidate");
      candidates[key] = parseNumber(value, `candidate ${key}`);
      next += 1;
    }
  }

  // Summary keys come in this fixed order; CSEC and LEGC are optional (manual: LEGC only for proportional cargos).
  const aptaValue = requireNumber(tokens, next, "APTA");
  next = aptaValue.next;
  const aptsValue = optionalNumber(tokens, next, "APTS");
  next = aptsValue.next;
  const apttValue = optionalNumber(tokens, next, "APTT");
  next = apttValue.next;
  if (aptsValue.value === undefined || apttValue.value === undefined) {
    failMissing("APTS/APTT");
  }
  const csecValue = optionalNumber(tokens, next, "CSEC");
  next = csecValue.next;
  const nomiValue = requireNumber(tokens, next, "NOMI");
  next = nomiValue.next;
  const legcValue = optionalNumber(tokens, next, "LEGC");
  next = legcValue.next;
  const branValue = requireNumber(tokens, next, "BRAN");
  const nuloValue = requireNumber(tokens, branValue.next, "NULO");
  const totalValue = requireNumber(tokens, nuloValue.next, "TOTC");

  return {
    cargo: {
      idel: 0,
      cargo: cargoValue.value,
      tipo,
      verc: vercValue.value,
      parties,
      candidates,
      apta: aptaValue.value,
      nominais: nomiValue.value,
      legenda: legcValue.value ?? 0,
      brancos: branValue.value,
      nulos: nuloValue.value,
      total: totalValue.value,
    },
    next: totalValue.next,
  };
}

// --- Arithmetic consistency: the printed totals must add up -----------------------------------

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function assertTotals(condition: boolean, detail: string): void {
  if (!condition) throw new BuError("TOTALS_INCONSISTENT", detail);
}

function checkCargoTotals(cargo: BuCargo): void {
  if (cargo.tipo === 1) {
    for (const party of cargo.parties) {
      assertTotals(
        sum(Object.values(party.candidates)) + party.legenda === party.total,
        `party ${party.party} candidates plus LEGP do not equal TOTP`,
      );
    }
  }

  const reportedNominalAndPartyVotes = cargo.nominais + cargo.legenda;
  const reportedNominalAndPartyAggregate =
    cargo.tipo === 1
      ? sum(cargo.parties.map((party) => party.total))
      : sum(Object.values(cargo.candidates));
  assertTotals(
    reportedNominalAndPartyAggregate === reportedNominalAndPartyVotes,
    `cargo ${cargo.cargo} candidate/party votes do not equal NOMI plus LEGC`,
  );
  assertTotals(
    cargo.nominais + cargo.legenda + cargo.brancos + cargo.nulos === cargo.total,
    `cargo ${cargo.cargo} totals do not equal TOTC`,
  );
}

function checkHeaderTotals(parsedHeader: ParsedHeader): void {
  const { header, apts, aptt } = parsedHeader;
  if (header.orig !== "VOTA") return;

  if (
    header.aptos !== undefined &&
    header.comparecimento !== undefined &&
    header.faltosos !== undefined
  ) {
    assertTotals(
      header.comparecimento + header.faltosos === header.aptos,
      "COMP plus FALT does not equal APTO",
    );
  }

  if (apts !== undefined || aptt !== undefined) {
    assertTotals(
      header.aptos !== undefined &&
        apts !== undefined &&
        aptt !== undefined &&
        apts + aptt === header.aptos,
      "APTS plus APTT does not equal APTO",
    );
  }
}

// --- Entry point ----------------------------------------------------------------------------

/** A decoded BU whose content matches its HASH chain. Only `hash` and `assi` are signed. */
export type AssembledBu = {
  bu: Bu;
  /** HASH of the last QR: covers the whole BU and is what ASSI signs. */
  hash: string;
  /** Signature over `hash`, if the last QR carries one. */
  assi?: Uint8Array;
};

/**
 * Joins the parsed QR parts of one BU (in any order), checks every printed HASH against the
 * chain recomputed from the content, and decodes it, rejecting anything outside the 2026 layout.
 */
export async function assembleBu(parts: readonly BuQr[]): Promise<AssembledBu> {
  if (parts.length === 0) throw new BuError("QR_SET_INCOMPLETE", "no BU QR parts were supplied");

  const total = parts[0]!.total;
  if (parts.some((part) => part.total !== total)) {
    throw new BuError("QR_SET_MIXED", "BU QR parts have different totals");
  }

  const sorted = parts.toSorted((left, right) => left.index - right.index);
  if (sorted.length !== total || sorted.some((part, index) => part.index !== index + 1)) {
    throw new BuError("QR_SET_INCOMPLETE", `expected QR indexes 1..${total}`);
  }

  const hashes = await chainHashes(sorted.map((part) => part.content));
  for (const [i, part] of sorted.entries()) {
    if (part.hash !== hashes[i]) {
      throw new BuError("HASH_MISMATCH", `QR ${part.index} HASH does not match its content`);
    }
  }

  // Each part already passed the single-QR size limit when parsed; the joined BU may be larger.
  const tokens = sorted.flatMap((part) => tokenize(part.content));
  const electionIndex = tokens.findIndex(([key]) => key === "IDEL");
  if (electionIndex === -1) failMissing("IDEL");
  const parsedHeader = parseHeader(tokens, electionIndex);
  checkHeaderTotals(parsedHeader);
  const { header } = parsedHeader;

  const cargos: BuCargo[] = [];
  let cursor = electionIndex;
  while (cursor < tokens.length) {
    const idelValue = requireNumber(tokens, cursor, "IDEL");
    cursor = idelValue.next;

    // SA prefixes each election with its vote counts; they carry no per-cargo data.
    if (header.orig === "SA") {
      for (const key of ["MAJO", "PROP"]) {
        if (tokens[cursor]?.[0] === key) {
          const value = requireNumber(tokens, cursor, key);
          cursor = value.next;
        }
      }
    }

    const cargoCountBeforeElection = cargos.length;
    while (cursor < tokens.length && tokens[cursor]?.[0] !== "IDEL") {
      if (tokens[cursor]?.[0] !== "CARG") failUnexpected(tokens[cursor]![0], "election body");
      const parsed = parseCargo(tokens, cursor);
      parsed.cargo.idel = idelValue.value;
      checkCargoTotals(parsed.cargo);
      cargos.push(parsed.cargo);
      cursor = parsed.next;
    }
    if (cargos.length === cargoCountBeforeElection) failMissing("CARG");
  }

  const last = sorted.at(-1)!;
  return { bu: { header, cargos }, hash: last.hash, ...(last.assi && { assi: last.assi }) };
}
