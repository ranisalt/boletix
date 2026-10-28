import { expect, it } from "vitest";

import * as api from "../src/index.ts";
import * as roots from "../src/roots.ts";

it("exposes exactly the documented public API", () => {
  expect(Object.keys(api).toSorted()).toEqual(["VerificationError", "verifyBu"]);
  expect(Object.keys(roots)).toEqual(["TSE_ROOTS"]);
});

it("keeps the closed code, the detail and a formatted message on errors", () => {
  const error = new api.VerificationError("CERT_INVALID", "not X.509");
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({
    code: "CERT_INVALID",
    detail: "not X.509",
    name: "VerificationError",
  });
  expect(error.message).toBe("CERT_INVALID: not X.509");
});
