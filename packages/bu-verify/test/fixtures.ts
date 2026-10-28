import { readdirSync, readFileSync } from "node:fs";

import {
  type AssembledBu,
  assembleBu,
  assembleCertificate,
  type BuQr,
  type CertQr,
  parseQr,
} from "@boletix/bu-qr";
import { expect } from "vitest";

import { VerificationError, type VerificationErrorCode } from "../src/index.ts";

// Real 2026 BUs at the repo root: fixtures/2026/<uf>-<mun>-<zona>-<secao>/{qrbu,qrce}-<i>.txt.
const ROOT = new URL("../../../fixtures/2026/", import.meta.url);

/** Fixtures that carry the urna certificate (QRCE), i.e. everything verifyBu can check. */
export const SIGNED_FIXTURES: readonly string[] = readdirSync(ROOT)
  .filter((name) => readdirSync(new URL(`${name}/`, ROOT)).some((file) => file.startsWith("qrce-")))
  .toSorted();

export const ED521 = "df-97012-11-178";
export const ECDSA = "zz-29386-1-1709";

function read(name: string, kind: "qrbu" | "qrce"): string[] {
  const dir = new URL(`${name}/`, ROOT);
  return readdirSync(dir)
    .filter((file) => file.startsWith(`${kind}-`))
    .map((file) => readFileSync(new URL(file, dir), "utf8").trim());
}

/** A fixture as verifyBu receives it: the checked BU and the urna certificate DER. */
export async function loadSigned(
  name: string,
): Promise<{ bu: AssembledBu; certificate: Uint8Array }> {
  const parts = read(name, "qrbu").map((raw) => parseQr(raw) as BuQr);
  const certs = read(name, "qrce").map((raw) => parseQr(raw) as CertQr);
  return { bu: await assembleBu(parts), certificate: assembleCertificate(certs) };
}

export async function expectVerificationError(
  action: () => Promise<unknown>,
  code: VerificationErrorCode,
): Promise<void> {
  const thrown = await action().then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(VerificationError);
  expect((thrown as VerificationError).code).toBe(code);
}
