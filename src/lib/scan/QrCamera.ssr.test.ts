import { render } from "svelte/server";
import { describe, expect, it } from "vitest";

import QrCamera from "./QrCamera.svelte";

describe("QrCamera on the server", () => {
  it("does not claim the browser is unsupported before the browser could be checked", () => {
    const { body } = render(QrCamera, { props: { onscan: () => {} } });

    expect(body).not.toContain('role="alert"');
  });
});
