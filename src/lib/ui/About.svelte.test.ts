import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import FaqItem from "./FaqItem.svelte";
import Thanks from "./Thanks.svelte";

afterEach(cleanup);

describe("FaqItem", () => {
  it("shows the question and reveals the answer when opened", async () => {
    render(FaqItem, {
      question: "O Boletix é oficial?",
      children: createRawSnippet(() => ({ render: () => "<p>Não.</p>" })),
    });

    const question = screen.getByText("O Boletix é oficial?");
    const answer = screen.getByText("Não.");
    expect(answer).not.toBeVisible();

    await fireEvent.click(question);
    expect(answer).toBeVisible();
  });
});

describe("Thanks", () => {
  it("lists the people who made Boletix possible", () => {
    render(Thanks, { names: ["Ana", "Bruno"] });

    const section = screen.getByRole("region", { name: "Agradecimentos" });
    expect(section).toHaveTextContent("Quem ajudou a fazer o Boletix.");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Ana",
      "Bruno",
    ]);
  });

  it("is left out while nobody is listed", () => {
    render(Thanks, { names: [] });

    expect(screen.queryByRole("region", { name: "Agradecimentos" })).not.toBeInTheDocument();
  });
});
