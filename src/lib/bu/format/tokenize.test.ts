import { expect, it } from "vitest";

import { BuError } from "../errors";
import { tokenize } from "./tokenize";

function expectErrorCode(action: () => unknown, code: BuError["code"]): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(BuError);
  expect((thrown as BuError).code).toBe(code);
}

it("splits records on spaces and values on the first colon only", () => {
  expect(tokenize("QRBU:1:9 VRQR:6.0 HICA:1:8027")).toEqual([
    ["QRBU", "1:9"],
    ["VRQR", "6.0"],
    ["HICA", "1:8027"],
  ]);
});

it("rejects payloads longer than 1100 characters", () => {
  expectErrorCode(() => tokenize("A:1 ".repeat(275) + "A:1"), "PAYLOAD_TOO_LARGE");
});

it("rejects characters outside the QR alphanumeric set", () => {
  expectErrorCode(() => tokenize("VERS:10_17"), "MALFORMED_TOKEN");
});

it("rejects empty tokens caused by repeated spaces", () => {
  expectErrorCode(() => tokenize("A:1  B:2"), "MALFORMED_TOKEN");
});

it("rejects tokens without a key-value separator", () => {
  expectErrorCode(() => tokenize("TOKEN"), "MALFORMED_TOKEN");
});

it("rejects empty keys or values", () => {
  expectErrorCode(() => tokenize(":value"), "MALFORMED_TOKEN");
  expectErrorCode(() => tokenize("KEY:"), "MALFORMED_TOKEN");
});
