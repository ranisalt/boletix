import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import { parseTotalsQuery } from "#lib/totals/index.js";

import Page from "./+page.svelte";

afterEach(cleanup);

describe("/totais", () => {
  it("lists this device's contributions below the totals", () => {
    const query = parseTotalsQuery(new URLSearchParams(), new Date("2026-10-28T12:00:00Z"));
    render(Page, { data: { query, totals: null } } as never);

    const heading = screen.getByRole("heading", { level: 2, name: "Minhas contribuições" });
    expect(heading.closest("section")).toHaveAttribute("id", "minhas-contribuicoes");
  });
});
