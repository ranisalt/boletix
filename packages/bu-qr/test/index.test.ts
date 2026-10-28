import { expect, it } from "vitest";

import * as api from "../src/index.ts";

it("exposes exactly the documented public API", () => {
  expect(Object.keys(api).sort()).toEqual(
    [
      "BuError",
      "MAX_QR_CHARS",
      "MAX_QR_CODES",
      "assembleBu",
      "assembleCertificate",
      "bytesToHex",
      "chainHashes",
      "hexToBytes",
      "parseQr",
    ].sort(),
  );
});
