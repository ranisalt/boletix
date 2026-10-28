import { readFileSync } from "node:fs";

import { expect, it } from "vitest";

import { TSE_ROOTS } from "../src/roots.ts";

const pemToBase64 = (pem: string) =>
  pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");

it("is frozen", () => {
  expect(Object.isFrozen(TSE_ROOTS)).toBe(true);
  expect(TSE_ROOTS.every((root) => Object.isFrozen(root))).toBe(true);
});

it.each(TSE_ROOTS)("pins $name to its source PEM and sha256", async (root) => {
  const pem = readFileSync(new URL(`../../../${root.source}`, import.meta.url), "utf8");
  expect(root.derBase64).toBe(pemToBase64(pem));
  const der = Uint8Array.from(atob(root.derBase64), (c) => c.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", der));
  expect(Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")).toBe(root.sha256);
});
