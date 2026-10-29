import { expect, it } from "vitest";

import * as api from "../src/index.ts";
import * as roots from "../src/roots.ts";

it("exposes exactly the documented public API", () => {
  expect(Object.keys(api).toSorted()).toEqual(["VerificationError", "verifyBu"]);
  expect(Object.keys(roots)).toEqual(["TSE_ROOTS"]);
});
