import { expect, it } from "vitest";

import { expectBuError } from "./fixtures.ts";
import { tokenize } from "../src/tokenize.ts";

it("splits records on spaces and values on the first colon only", () => {
  expect(tokenize("QRBU:1:9 VRQR:6.0 HICA:1:8027")).toEqual([
    ["QRBU", "1:9"],
    ["VRQR", "6.0"],
    ["HICA", "1:8027"],
  ]);
});

it("rejects payloads longer than 1100 characters", () => {
  expectBuError(() => tokenize("A:1 ".repeat(275) + "A:1"), "PAYLOAD_TOO_LARGE");
});

it("rejects characters outside the QR alphanumeric set", () => {
  expectBuError(() => tokenize("VERS:10_17"), "MALFORMED_TOKEN");
});

it("rejects empty tokens caused by repeated spaces", () => {
  expectBuError(() => tokenize("A:1  B:2"), "MALFORMED_TOKEN");
});

it("rejects tokens without a key-value separator", () => {
  expectBuError(() => tokenize("TOKEN"), "MALFORMED_TOKEN");
});

it("rejects empty keys or values", () => {
  expectBuError(() => tokenize(":value"), "MALFORMED_TOKEN");
  expectBuError(() => tokenize("KEY:"), "MALFORMED_TOKEN");
});
