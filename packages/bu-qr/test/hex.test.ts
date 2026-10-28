import { expect, it } from "vitest";

import { BuError } from "../src/errors.ts";
import { bytesToHex, hexToBytes } from "../src/hex.ts";
import { expectBuError } from "./fixtures.ts";

it("round-trips bytes through lowercase hex", () => {
  const bytes = Uint8Array.from([0, 1, 0xab, 0xff]);
  expect(bytesToHex(bytes)).toBe("0001abff");
  expect(hexToBytes("0001abff")).toEqual(bytes);
});

it("accepts uppercase hex", () => {
  expect(hexToBytes("ABcd")).toEqual(Uint8Array.from([0xab, 0xcd]));
});

it("returns an empty array for an empty string", () => {
  expect(hexToBytes("")).toEqual(new Uint8Array(0));
});

it("rejects odd-length and non-hex input with INVALID_FIELD", () => {
  expectBuError(() => hexToBytes("ABC"), "INVALID_FIELD");
  expectBuError(() => hexToBytes("ZZ"), "INVALID_FIELD");
  expectBuError(() => hexToBytes("0x12"), "INVALID_FIELD");
  expectBuError(() => hexToBytes("AB CD"), "INVALID_FIELD");
});

it("throws BuError instances", () => {
  expect(() => hexToBytes("G0")).toThrow(BuError);
});
