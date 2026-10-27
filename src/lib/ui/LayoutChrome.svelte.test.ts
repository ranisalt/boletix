import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import NoticeBanner from "./NoticeBanner.svelte";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const DISCLAIMER = /Boletix NÃO é um serviço oficial/;

describe("NoticeBanner", () => {
  it("warns that Boletix is not official until the visitor acknowledges it, and remembers that", async () => {
    render(NoticeBanner);

    expect(screen.getByRole("region", { name: "Aviso importante" })).toHaveTextContent(DISCLAIMER);
    await fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.queryByRole("region", { name: "Aviso importante" })).not.toBeInTheDocument();

    cleanup();
    render(NoticeBanner);
    expect(screen.queryByRole("region", { name: "Aviso importante" })).not.toBeInTheDocument();
  });
});
