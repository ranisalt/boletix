import { render, screen } from "@testing-library/svelte";
import { expect, it } from "vitest";

import Smoke from "./Smoke.svelte";

it("renders the smoke button through its accessible role and name", () => {
  render(Smoke);

  expect(screen.getByRole("button", { name: "Boletix smoke test" })).toBeInTheDocument();
});
