/** Boletins sent from this device. Kept only in its storage; nothing personal goes to the server. */
export interface Contribution {
  /** The BU hash: one entry per boletim. */
  id: string;
  uf: string;
  municipio: number;
  zona: number;
  secao: number;
  urna: string;
  enviadoEm: string;
  status: "aceito" | "conflito";
}

const KEY = "boletix:contribuicoes";

export function listContributions(storage: Storage = localStorage): Contribution[] {
  try {
    const list: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? (list as Contribution[]) : [];
  } catch {
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
