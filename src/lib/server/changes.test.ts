import { describe, expect, it } from "vitest";

import { changes } from "./changes";

describe("changes", () => {
  it("yields the first value, then only values that differ from the last one yielded", async () => {
    const reads = [{ votos: 1 }, { votos: 1 }, { votos: 2 }, { votos: 2 }, { votos: 1 }];
    let waits = 0;
    const seen = [];
    for await (const value of changes(
      async () => reads.shift()!,
      async () => void waits++,
    )) {
      seen.push(value);
      if (!reads.length) break;
    }

    expect(seen).toEqual([{ votos: 1 }, { votos: 2 }, { votos: 1 }]);
    expect(waits).toBe(4);
  });
});
