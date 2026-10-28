import { cleanup, render, screen, within } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import Layout from "./+layout.svelte";

afterEach(cleanup);

const children = createRawSnippet(() => ({ render: () => "<p>conteúdo</p>" }));

describe("layout navigation", () => {
  it("links to how it works; contributions live under the totals", () => {
    render(Layout, { children, data: {}, params: {} });

    for (const nav of screen.getAllByRole("navigation", { name: "Principal" })) {
      expect(within(nav).getByRole("link", { name: "Como funciona" })).toHaveAttribute(
        "href",
        "/como-funciona",
      );
      expect(within(nav).queryByRole("link", { name: /Minhas/ })).not.toBeInTheDocument();
    }
  });
});
