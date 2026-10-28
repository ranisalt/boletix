/// <reference types="@cloudflare/vitest-plugin/types" />

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sealSubmission, type BuSubmission, TSE_ROOTS } from "../bu";
import { loadBuScan } from "../bu/testing/fixtures";
import { assertPhaseAllowed, handleSubmission, MAX_BODY_BYTES, type SubmitOptions } from "./submit";

async function submissionFor(name: string): Promise<BuSubmission> {
  const { parts, certs } = loadBuScan(name);
  return (await sealSubmission(parts, certs, TSE_ROOTS)).submission;
}

function post(body: unknown, init: RequestInit = {}): Request {
  return new Request("https://boletix.test/api/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

const allowAll = { limit: async () => ({ success: true }) };

function options(overrides: Partial<SubmitOptions> = {}): SubmitOptions {
  return { clientAddress: "192.0.2.1", report: vi.fn(), ...overrides };
}

async function submit(body: unknown, overrides: Partial<SubmitOptions> = {}) {
  const response = await handleSubmission(
    post(body),
    { ...env, SUBMIT_LIMITER: allowAll },
    options(overrides),
  );
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM bu_vote"),
    env.DB.prepare("DELETE FROM bu_cargo"),
    env.DB.prepare("DELETE FROM bu"),
  ]);
});

describe("handleSubmission", () => {
  it("verifies and stores a new BU", async () => {
    const submission = await submissionFor("df-97012-11-178");

    await expect(submit(submission)).resolves.toEqual({
      status: 201,
      body: { status: "new", hash: submission.hash },
    });
    await expect(env.DB.prepare("SELECT election_id FROM bu").first("election_id")).resolves.toBe(
      "br-2026-general",
    );
  });

  it("answers a resubmission as a duplicate", async () => {
    const submission = await submissionFor("df-97012-11-178");
    await submit(submission);

    await expect(submit(submission)).resolves.toEqual({
      status: 200,
      body: { status: "duplicate", hash: submission.hash },
    });
  });

  it("reports a conflicting BU for the same section and keeps the first", async () => {
    const report = vi.fn();
    const store = vi.fn(async () => ({
      status: "conflict" as const,
      hash: "B".repeat(128),
      existingHash: "A".repeat(128),
    }));

    await expect(
      submit(await submissionFor("df-97012-11-178"), { report, store }),
    ).resolves.toEqual({
      status: 409,
      body: { status: "conflict", hash: "B".repeat(128) },
    });
    expect(report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        hash: "B".repeat(128),
        existingHash: "A".repeat(128),
        uf: "DF",
        zona: 11,
        secao: 178,
      }),
    );
  });

  it("rejects a BU that fails verification without storing it", async () => {
    const submission = { ...(await submissionFor("df-97012-11-178")), hash: "A".repeat(128) };

    await expect(submit(submission)).resolves.toEqual({
      status: 422,
      body: { error: "HASH_MISMATCH" },
    });
    await expect(env.DB.prepare("SELECT COUNT(*) AS n FROM bu").first("n")).resolves.toBe(0);
  });

  it("rejects malformed and over-sharing payloads as bad requests", async () => {
    await expect(submit("{not json")).resolves.toEqual({
      status: 400,
      body: { error: "INVALID_JSON" },
    });
    await expect(submit({ contents: [] })).resolves.toMatchObject({
      status: 400,
      body: { error: "INVALID_FIELD" },
    });
    await expect(
      submit({ ...(await submissionFor("df-97012-11-178")), verified: true }),
    ).resolves.toEqual({
      status: 400,
      body: { error: "UNEXPECTED_FIELD" },
    });
  });

  it("rejects oversized bodies before parsing them", async () => {
    await expect(submit("x".repeat(MAX_BODY_BYTES + 1))).resolves.toEqual({
      status: 413,
      body: { error: "PAYLOAD_TOO_LARGE" },
    });
  });

  it("stops reading a body that grows past the limit without announcing its size", async () => {
    // Finite, so code that buffers everything fails the read assertion instead of exhausting memory.
    const chunk = new Uint8Array(16 * 1024);
    const offered = MAX_BODY_BYTES * 8;
    let read = 0;
    const oversized = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (read >= offered) return controller.close();
        read += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const response = await handleSubmission(
      post(undefined, { body: oversized, duplex: "half" } as RequestInit),
      { ...env, SUBMIT_LIMITER: allowAll },
      options(),
    );

    expect(response.status).toBe(413);
    expect(read).toBeLessThan(MAX_BODY_BYTES * 2);
  });

  it("rate-limits by client address", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const response = await handleSubmission(
      post(await submissionFor("df-97012-11-178")),
      { ...env, SUBMIT_LIMITER: { limit } },
      options(),
    );

    expect(response.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: "192.0.2.1" });
  });
});

describe("assertPhaseAllowed", () => {
  it("accepts the official vote everywhere", () => {
    expect(() => assertPhaseAllowed("O", {})).not.toThrow();
  });

  it.each(["S", "T"] as const)("rejects FASE:%s unless test phases are allowed", (fase) => {
    expect(() => assertPhaseAllowed(fase, {})).toThrow(
      expect.objectContaining({ code: "TEST_PHASE_REJECTED" }),
    );
    expect(() => assertPhaseAllowed(fase, { ALLOW_TEST_FASES: "false" })).toThrow();
    expect(() => assertPhaseAllowed(fase, { ALLOW_TEST_FASES: "true" })).not.toThrow();
  });
});
