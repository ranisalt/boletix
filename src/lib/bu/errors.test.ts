import { BuError as QrError } from "@boletix/bu-qr";
import { VerificationError } from "@boletix/bu-verify";
import { expect, it } from "vitest";

import { BuError, buErrorCode } from "./errors";

it("reads the code of app, QR and verification errors alike", () => {
  expect(buErrorCode(new BuError("UNSUPPORTED_ELECTION", ""))).toBe("UNSUPPORTED_ELECTION");
  expect(buErrorCode(new QrError("HASH_MISMATCH", ""))).toBe("HASH_MISMATCH");
  expect(buErrorCode(new VerificationError("SIGNATURE_INVALID", ""))).toBe("SIGNATURE_INVALID");
});

it("ignores errors that are not BU rejections", () => {
  expect(buErrorCode(new Error("boom"))).toBeUndefined();
  expect(buErrorCode("HASH_MISMATCH")).toBeUndefined();
});
