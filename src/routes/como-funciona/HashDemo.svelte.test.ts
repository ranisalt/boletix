import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import HashDemo from "./HashDemo.svelte";

afterEach(cleanup);

async function hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const LABEL = "Digite qualquer texto e veja o hash mudar";

describe("HashDemo", () => {
  it("starts empty, hashing the empty text with nothing marked", async () => {
    render(HashDemo);

    expect(screen.getByRole("textbox", { name: LABEL })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: LABEL })).toHaveAccessibleDescription(
      /^Efeito avalanche:/,
    );
    const output = screen.getByRole("status", { name: "SHA-512" });
    const expected = await hex("");
    await waitFor(() => expect(output).toHaveTextContent(expected));
    expect(output.querySelectorAll("[data-changed]")).toHaveLength(0);
  });

  it("marks the characters that changed since the previous text", async () => {
    render(HashDemo);
    const input = screen.getByRole("textbox", { name: LABEL });
    const output = screen.getByRole("status", { name: "SHA-512" });

    const before = await hex("13:142");
    await fireEvent.input(input, { target: { value: "13:142" } });
    await waitFor(() => expect(output).toHaveTextContent(before));

    const after = await hex("13:143");
    await fireEvent.input(input, { target: { value: "13:143" } });
    await waitFor(() => expect(output).toHaveTextContent(after));

    const changed = [...after].filter((char, i) => char !== before[i]).length;
    expect(output.querySelectorAll("[data-changed]")).toHaveLength(changed);
    expect(screen.getByText(`${changed} de 128 caracteres mudaram`)).toBeInTheDocument();
  });
});
