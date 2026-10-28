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
    expect(
      screen.getByRole("link", { name: "Ver o passo a passo da criptografia" }),
    ).toHaveAttribute("href", "/como-funciona");
    expect(screen.getByRole("link", { name: "TSE" })).toHaveAttribute("rel", "external noreferrer");
  });

  it("links each crypto claim to the step that explains it", () => {
    render(Page);

    expect(screen.getByRole("link", { name: "assinatura digital" })).toHaveAttribute(
      "href",
      "/como-funciona#passo-5",
    );
    expect(screen.getByRole("link", { name: "certificado da urna" })).toHaveAttribute(
      "href",
      "/como-funciona#passo-6",
    );
    expect(screen.getByRole("link", { name: "Veja como a conferência funciona" })).toHaveAttribute(
      "href",
      "/como-funciona#conferencia",
    );
  });

  it("explains that conflicts are not expected", () => {
    render(Page);

    expect(screen.getByText("O que é um conflito?").closest("details")).toHaveAttribute(
      "id",
      "conflito",
    );
    expect(screen.getByText(/não deveriam existir/)).toBeInTheDocument();
  });
});
