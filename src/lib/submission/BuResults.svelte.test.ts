import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import { assembleBu, type Bu, parseQr, type BuQr } from "../bu";
import { loadBuFixture } from "../bu/testing/fixtures";
import type { NameFile } from "../elections";
import BuResults from "./BuResults.svelte";

afterEach(cleanup);

const { bu } = await assembleBu(
  loadBuFixture("df-97012-11-178").qrbu.map((raw) => parseQr(raw) as BuQr),
);

const BR: NameFile = {
  geradoEm: "25/10/2026 12:30:51",
  municipios: {},
  candidatos: { "6258": { "1": { "13": ["LULA", "PT"], "22": ["FLAVIO BOLSONARO", "PL"] } } },
  partidos: {},
};
const DF: NameFile = {
  geradoEm: "25/10/2026 12:30:51",
  municipios: { "97012": "BRASÍLIA" },
  candidatos: { "6260": { "3": { "11": ["CELINA LEÃO", "PP"] } } },
  partidos: { "13": "PT" },
};

function rows(table: string): string[] {
  return within(screen.getByRole("table", { name: table }))
    .getAllByRole("row")
    .map((row) => {
      const cells = within(row);
      return [
        ...cells.queryAllByRole("columnheader"),
        ...cells.queryAllByRole("rowheader"),
        ...cells.queryAllByRole("cell"),
      ]
        .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ");
    });
}

describe("BuResults", () => {
  it("shows each role as a table in BU order, with names, blank, null and total votes", () => {
    render(BuResults, { bu, names: [BR, DF] });
    expect(
      screen
        .getAllByRole("table")
        .map((table) => within(table).getByRole("caption").textContent?.trim()),
    ).toEqual(["Governador", "Presidente"]);
    expect(rows("Presidente")).toEqual([
      "Número Candidato Votos",
      "13 LULA PT 121",
      "22 FLAVIO BOLSONARO PL 138",
      "Brancos 2",
      "Nulos 8",
      "Total 269",
    ]);
  });

  it("keeps the bare number when a candidate has no name", () => {
    render(BuResults, { bu, names: [BR, DF] });
    expect(rows("Governador").slice(1, 3)).toEqual(["11 CELINA LEÃO PP 122", "13 99"]);
  });

  it("lists party-only votes on proportional roles", () => {
    const deputies: Bu = {
      header: bu.header,
      cargos: [
        {
          idel: 6259,
          cargo: 8,
          tipo: 1,
          verc: "",
          apta: 1,
          nominais: 4,
          legenda: 1,
          brancos: 0,
          nulos: 0,
          total: 5,
          candidates: {},
          parties: [{ party: 13, candidates: { "13123": 4 }, legenda: 1, total: 5 }],
        },
      ],
    };
    render(BuResults, { bu: deputies, names: [DF] });
    expect(rows("Deputado distrital")).toEqual([
      "Número Candidato Votos",
      "13123 4",
      "13 Legenda PT 1",
      "Brancos 0",
      "Nulos 0",
      "Total 5",
    ]);
  });

  it("says where the names come from and that they are not part of the signed boletim", () => {
    render(BuResults, { bu, names: [BR, DF] });
    expect(
      screen.getByText(
        "Nomes: dados abertos do TSE de 25/10/2026 12:30:51. Não fazem parte do boletim assinado.",
      ),
    ).toBeInTheDocument();
  });
});
