import { expect, it } from "vitest";

import { findElection } from "./calendar";

it("finds the 2026 general election only for a registered pleito, turno and QR version", () => {
  expect(findElection(1219, 3220, 1, "6.0")).toMatchObject({
    id: "br-2026-general",
    proc: 1219,
    pleitos: [
      { plei: 3220, turno: 1 },
      { plei: 3221, turno: 2 },
    ],
    vrqr: ["6.0"],
  });
  expect(findElection(1219, 3221, 2, "6.0")?.id).toBe("br-2026-general");
  expect(findElection(1219, 3220, 2, "6.0")).toBeUndefined();
  expect(findElection(1219, 3221, 1, "6.0")).toBeUndefined();
  expect(findElection(1219, 9999, 1, "6.0")).toBeUndefined();
  expect(findElection(9999, 3220, 1, "6.0")).toBeUndefined();
});
