import { BuError as QrError } from "@boletix/bu-qr";
import { VerificationError } from "@boletix/bu-verify";
import { expect, it } from "vitest";

import { BuError, buErrorCode } from "./errors";

it("preserves the closed code, detail, and formatted message", () => {
  const error = new BuError("TEST_PHASE_REJECTED", "FASE:S");

  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe("TEST_PHASE_REJECTED");
  expect(error.detail).toBe("FASE:S");
  expect(error.message).toBe("TEST_PHASE_REJECTED: FASE:S");
});

it("reads the code of app, QR and verification errors alike", () => {
  expect(buErrorCode(new BuError("UNSUPPORTED_ELECTION", ""))).toBe("UNSUPPORTED_ELECTION");
  expect(buErrorCode(new QrError("HASH_MISMATCH", ""))).toBe("HASH_MISMATCH");
  expect(buErrorCode(new VerificationError("SIGNATURE_INVALID", ""))).toBe("SIGNATURE_INVALID");
});

it("ignores errors that are not BU rejections", () => {
  expect(buErrorCode(new Error("boom"))).toBeUndefined();
  expect(buErrorCode("HASH_MISMATCH")).toBeUndefined();
});
