import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import { parseTotalsQuery } from "#lib/totals/index.js";

import Page from "./+page.svelte";

afterEach(cleanup);

describe("/totais", () => {
  it("lists this device's contributions below the totals", async () => {
    const query = parseTotalsQuery(new URLSearchParams(), new Date("2026-10-28T12:00:00Z"));
    render(Page, { data: { query, summable: false } } as never);

    const heading = await screen.findByRole("heading", { level: 2, name: "Minhas contribuições" });
    expect(heading.closest("section")).toHaveAttribute("id", "minhas-contribuicoes");
  });
});
