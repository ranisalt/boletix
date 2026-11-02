import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import Thanks from "./Thanks.svelte";

afterEach(cleanup);

describe("Thanks", () => {
  it("lists the people who made Boletix possible", () => {
    render(Thanks, { people: [{ name: "Ana" }, { name: "Bruno" }] });

    const section = screen.getByRole("region", { name: "Agradecimentos" });
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["Ana", "Bruno"]);
  });

  it("links a person to their page when one is given", () => {
    render(Thanks, {
      people: [{ name: "Ana", url: "https://example.com/ana" }, { name: "Bruno" }],
    });

    expect(screen.getByRole("link", { name: "Ana" })).toHaveAttribute(
      "href",
      "https://example.com/ana",
    );
    expect(screen.queryByRole("link", { name: "Bruno" })).not.toBeInTheDocument();
  });

  it("is left out while nobody is listed", () => {
    render(Thanks, { people: [] });

    expect(screen.queryByRole("region", { name: "Agradecimentos" })).not.toBeInTheDocument();
  });
});
