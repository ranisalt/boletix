import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import TotalsView from "./TotalsView.svelte";

afterEach(cleanup);

const TOTALS = {
  secoes: 2883,
  candidatos: [
    { numero: "13", nome: "LULA", partido: "PT", votos: 426003 },
    { numero: "99", votos: 213001 },
  ],
  brancos: 16080,
  nulos: 3880,
};

const items = () =>
  within(screen.getByRole("list", { name: "Votos" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace(/\s+/g, " ").trim());

describe("TotalsView", () => {
  it("lists candidates by votes with name, party and number, then blank and null votes", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 1, cargo: 1 },
      totals: TOTALS,
    });
    expect(items()).toEqual(["LULA PT 13 426.003", "99 213.001", "Brancos 16.080", "Nulos 3.880"]);
  });

  it("draws each candidate's bar relative to the leader", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 1, cargo: 1 },
      totals: TOTALS,
    });
    expect(
      screen
        .getAllByRole("meter")
        .map((bar) => [bar.getAttribute("aria-label"), bar.getAttribute("aria-valuenow")]),
    ).toEqual([
      ["LULA", "426003"],
      ["99", "213001"],
    ]);
    expect(screen.getAllByRole("meter").map((bar) => bar.getAttribute("aria-valuemax"))).toEqual([
      "426003",
      "426003",
    ]);
  });

  it("shows collected sections out of the TSE total", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 1, cargo: 1 },
      totals: { ...TOTALS, secoesTotal: 499248 },
    });
    expect(screen.getByText("2.883 de 499.248 seções (0,6%)")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "Cobertura" });
    expect(progress).toHaveAttribute("aria-valuenow", "2883");
    expect(progress).toHaveAttribute("aria-valuemax", "499248");
  });

  it("shows only the collected count when the TSE total is unknown", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 1, cargo: 1 },
      totals: TOTALS,
    });
    expect(screen.getByText("Seções coletadas: 2.883")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps the current choice selected in the filters", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 2, cargo: 3, uf: "SP" },
      totals: TOTALS,
    });
    const select = (name: string) => screen.getByRole("combobox", { name });
    expect(select("Eleição")).toHaveValue("br-2026-general");
    expect(select("Turno")).toHaveValue("2");
    expect(select("Cargo")).toHaveValue("3");
    expect(select("UF")).toHaveValue("SP");
  });

  it("labels each election and round with its date, newest election first", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 2, cargo: 1 },
      totals: TOTALS,
    });
    const options = (name: string) =>
      within(screen.getByRole("combobox", { name }))
        .getAllByRole("option")
        .map((option) => option.textContent);
    expect(options("Eleição")).toEqual(["Eleições Gerais 2026"]);
    expect(options("Turno")).toEqual(["1º turno · 04/10/2026", "2º turno · 25/10/2026"]);
  });

  it("asks for a UF instead of mixing states for a state role", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 1, cargo: 3 },
      totals: null,
    });
    expect(
      screen.getByText("Escolha uma UF para ver os totais de Governador."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Votos" })).not.toBeInTheDocument();
  });

  it("says so when no BU was collected yet", () => {
    render(TotalsView, {
      query: { election: "br-2026-general", turno: 1, cargo: 1 },
      totals: { secoes: 0, candidatos: [], brancos: 0, nulos: 0 },
    });
    expect(screen.getByText("Nenhum boletim coletado para esta seleção.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Votos" })).not.toBeInTheDocument();
  });
});
