import { expect, it } from "vitest";

import { BuError } from "../src/index.ts";

it("preserves the closed code, detail, and formatted message", () => {
  const error = new BuError("MALFORMED_TOKEN", "unexpected character");

  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe("MALFORMED_TOKEN");
  expect(error.detail).toBe("unexpected character");
  expect(error.message).toBe("MALFORMED_TOKEN: unexpected character");
});
