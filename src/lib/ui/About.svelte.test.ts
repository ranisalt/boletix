import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import Thanks from "./Thanks.svelte";

afterEach(cleanup);

describe("Thanks", () => {
  it("lists the people who made Boletix possible", () => {
    render(Thanks, { names: ["Ana", "Bruno"] });

    const section = screen.getByRole("region", { name: "Agradecimentos" });
    expect(
      within(section)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Ana", "Bruno"]);
  });

  it("is left out while nobody is listed", () => {
    render(Thanks, { names: [] });

    expect(screen.queryByRole("region", { name: "Agradecimentos" })).not.toBeInTheDocument();
  });
});
