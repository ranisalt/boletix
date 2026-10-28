/** Boletins sent from this device. Kept only in its storage; nothing personal goes to the server. */
export type Contribution = {
  /** The BU hash: one entry per boletim. */
  id: string;
  uf: string;
  municipio: number;
  zona: number;
  secao: number;
  urna: string;
  enviadoEm: string;
  status: "aceito" | "conflito";
};

const KEY = "boletix:contribuicoes";

// Storage is user-editable and outlives app versions: only keep entries the list can render.
const FIELD_TYPES = {
  id: "string",
  uf: "string",
  municipio: "number",
  zona: "number",
  secao: "number",
  urna: "string",
  enviadoEm: "string",
} as const satisfies Record<Exclude<keyof Contribution, "status">, "string" | "number">;

function isContribution(value: unknown): value is Contribution {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    Object.entries(FIELD_TYPES).every(([key, type]) => typeof entry[key] === type) &&
    (entry.status === "aceito" || entry.status === "conflito")
  );
}

export function listContributions(storage: Storage = localStorage): Contribution[] {
  try {
    const list: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter(isContribution) : [];
  } catch {
    // Corrupt history is dropped; the next recorded contribution overwrites it.
    return [];
  }
}

export function recordContribution(
  contribution: Contribution,
  storage: Storage = localStorage,
): void {
  const others = listContributions(storage).filter(({ id }) => id !== contribution.id);
  storage.setItem(KEY, JSON.stringify([contribution, ...others]));
}
