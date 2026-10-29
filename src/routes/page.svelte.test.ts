import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import Page from "./+page.svx";

afterEach(cleanup);

describe("/", () => {
  it("explains what a BU is and sends the reader to submit one or see the totals", () => {
    render(Page);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Boletim de Urna (BU)").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "Enviar boletim" })).toHaveAttribute("href", "/enviar");
    expect(screen.getByRole("link", { name: "Ver totais" })).toHaveAttribute("href", "/totais");
  });

  it("lists the four steps in order", () => {
    render(Page);

    const steps = within(screen.getByRole("list"));
    expect(
      steps.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Escanear", "Verificar no aparelho", "Enviar", "Totais públicos"]);
  });
});
