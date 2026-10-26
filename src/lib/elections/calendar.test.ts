import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { ELECTIONS, findElection } from "./calendar";

it("finds the 2026 general election only for a registered pleito and QR version", () => {
  expect(findElection(1219, 3220, "6.0")).toMatchObject({
    id: "br-2026-general",
    proc: 1219,
    pleitos: [
      { plei: 3220, turno: 1 },
      { plei: 3221, turno: 2 },
    ],
    vrqr: ["6.0"],
  });
  expect(findElection(1219, 3221, "6.0")?.id).toBe("br-2026-general");
  expect(findElection(1219, 9999, "6.0")).toBeUndefined();
  expect(findElection(9999, 3220, "6.0")).toBeUndefined();
});

it("guards every trusted root against a DER SHA-256 mismatch", () => {
  for (const election of ELECTIONS) {
    for (const root of election.trustedRoots) {
      const actual = createHash("sha256")
        .update(Buffer.from(root.derBase64, "base64"))
        .digest("hex");
      expect(actual).toBe(root.sha256);
    }
  }
  expect(ELECTIONS[0]?.trustedRoots).toEqual([]);
});
