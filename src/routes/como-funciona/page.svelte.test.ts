import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import Page from "./+page.svx";

afterEach(cleanup);

describe("/como-funciona", () => {
  it("walks through the urna's steps, then Boletix's way back", () => {
    render(Page);

    expect(screen.getByRole("heading", { level: 1, name: "Como funciona" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Parte 1 — Na urna", "Parte 2 — No Boletix, o caminho de volta", "Para saber mais"]);
    expect(
      screen.getByRole("heading", { level: 3, name: "Os votos da seção" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Extrair e enviar os votos" }),
    ).toBeInTheDocument();
  });

  it("explains that the urna's certificate comes in its own QR codes", () => {
    render(Page);

    expect(screen.getAllByText(/QRCE/).length).toBeGreaterThan(0);
  });

  it("sends the reader to submit a BU and opens references externally", () => {
    render(Page);

    expect(screen.getByRole("link", { name: "Enviar um boletim" })).toHaveAttribute(
      "href",
      "/enviar",
    );
    expect(screen.getByRole("link", { name: /SHA-2/ })).toHaveAttribute(
      "rel",
      "external noreferrer",
    );
  });
});
