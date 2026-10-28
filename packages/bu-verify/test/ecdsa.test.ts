import { expect, it } from "vitest";

// Internal on purpose: DER edge cases (short or padded r/s) can't be produced through verifyBu.
import { derToP1363 } from "../src/algorithms.ts";

const int = (...bytes: number[]) => [0x02, bytes.length, ...bytes];
const seq = (...body: number[]) =>
  body.length < 0x80 ? [0x30, body.length, ...body] : [0x30, 0x81, body.length, ...body];

it("left-pads short r and s to 66 bytes each", () => {
  const out = derToP1363(Uint8Array.from(seq(...int(0x01), ...int(0x02, 0x03))))!;
  expect(out).toHaveLength(132);
  expect(out[65]).toBe(0x01);
  expect([out[130], out[131]]).toEqual([0x02, 0x03]);
  expect(out.subarray(0, 65).every((b) => b === 0)).toBe(true);
});

it("drops the sign byte DER adds before a high bit", () => {
  const r = [0x00, 0x81, ...Array(65).fill(0xff)]; // 67 bytes: sign byte + 66
  const out = derToP1363(Uint8Array.from(seq(...int(...r), ...int(0x05))))!;
  expect(out.subarray(0, 66)).toEqual(Uint8Array.from(r.slice(1)));
  expect(out[131]).toBe(0x05);
});

it("accepts the long-form length real P-521 signatures use", () => {
  const r = Array(66).fill(0x11);
  const s = Array(66).fill(0x22);
  const out = derToP1363(Uint8Array.from(seq(...int(...r), ...int(...s))))!;
  expect(out).toEqual(Uint8Array.from([...r, ...s]));
});

it("returns undefined for anything that is not a well-formed SEQUENCE of two INTEGERs", () => {
  for (const bad of [
    [],
    [0x30, 0x00],
    seq(...int(0x01)),
    seq(...int(0x01), ...int(0x02), 0x00),
    seq(...int(...Array(67).fill(0x7f)), ...int(0x01)),
    [0x31, 0x06, ...int(0x01), ...int(0x02)],
    [0x30, 0x07, ...int(0x01), ...int(0x02)],
  ]) {
    expect(derToP1363(Uint8Array.from(bad)), JSON.stringify(bad)).toBeUndefined();
  }
});
