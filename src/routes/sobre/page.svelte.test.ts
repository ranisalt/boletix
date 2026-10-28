import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import Page from "./+page.svx";

afterEach(cleanup);

describe("/sobre", () => {
  it("explains the methodology, answers common questions and points to official sources", () => {
    render(Page);

    expect(screen.getByRole("heading", { level: 1, name: "Sobre o Boletix" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Metodologia", "Perguntas frequentes", "Fontes oficiais"]);
    expect(screen.getByText("Verificação criptográfica:")).toBeInTheDocument();
    expect(screen.getByText("O que é um conflito?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TSE" })).toHaveAttribute("rel", "external noreferrer");
  });
});
