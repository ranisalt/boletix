import { describe, expect, it } from "vitest";

import { listContributions, recordContribution, type Contribution } from "./store";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const sent: Contribution = {
  id: "A".repeat(128),
  uf: "DF",
  municipio: 97012,
  zona: 11,
  secao: 178,
  urna: "2028869",
  enviadoEm: "2026-10-04T18:22:00.000Z",
  status: "aceito",
};

describe("contributions", () => {
  it("starts empty: nothing is shown that this device did not send", () => {
    expect(listContributions(memoryStorage())).toEqual([]);
  });

  it("lists the newest contribution first", () => {
    const storage = memoryStorage();
    const older = { ...sent, id: "B".repeat(128), secao: 177 };
    recordContribution(older, storage);
    recordContribution(sent, storage);

    expect(listContributions(storage)).toEqual([sent, older]);
  });

  it("keeps one entry per boletim when the same one is sent again", () => {
    const storage = memoryStorage();
    recordContribution({ ...sent, enviadoEm: "2026-10-04T18:00:00.000Z" }, storage);
    recordContribution(sent, storage);

    expect(listContributions(storage)).toEqual([sent]);
  });

  it("ignores a corrupted history instead of breaking the page", () => {
    expect(listContributions(memoryStorage({ "boletix:contribuicoes": "{not json" }))).toEqual([]);
    expect(listContributions(memoryStorage({ "boletix:contribuicoes": '{"a":1}' }))).toEqual([]);
  });
});
