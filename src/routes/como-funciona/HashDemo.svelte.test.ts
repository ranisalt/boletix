import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import HashDemo from "./HashDemo.svelte";

afterEach(cleanup);

async function hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("HashDemo", () => {
  it("hashes the sample vote, with nothing changed yet", async () => {
    render(HashDemo);

    expect(screen.getByRole("textbox", { name: "Experimente: mude o texto" })).toHaveValue(
      "13:142",
    );
    const expected = await hex("13:142");
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "SHA-512" })).toHaveTextContent(expected),
    );
    expect(screen.getByText("0 de 128 caracteres mudaram")).toBeInTheDocument();
  });

  it("rehashes on every keystroke and marks each character that changed", async () => {
    render(HashDemo);

    const input = screen.getByRole("textbox", { name: "Experimente: mude o texto" });
    await fireEvent.input(input, { target: { value: "13:143" } });

    const before = await hex("13:142");
    const after = await hex("13:143");
    const changed = [...after].filter((char, i) => char !== before[i]).length;
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "SHA-512" })).toHaveTextContent(after),
    );
    expect(
      screen.getByRole("status", { name: "SHA-512" }).querySelectorAll("[data-changed]"),
    ).toHaveLength(changed);
    expect(screen.getByText(`${changed} de 128 caracteres mudaram`)).toBeInTheDocument();
  });
});
