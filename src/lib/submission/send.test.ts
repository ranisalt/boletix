import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { assembleBu, parseQr, sealSubmission, type BuQr, type CertQr, TSE_ROOTS } from "../bu";
import { loadBuFixture } from "../bu/testing/fixtures";
import { listContributions } from "../contributions";
import { sendBoletim } from "./send";

const fixture = loadBuFixture("df-97012-11-178");
const parts = fixture.qrbu.map((raw) => parseQr(raw)) as BuQr[];
const certs = fixture.qrce.map((raw) => parseQr(raw)) as CertQr[];
const verified = {
  bu: assembleBu(parts),
  submission: sealSubmission(parts, certs, TSE_ROOTS).submission,
};

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

const received: unknown[] = [];
let reply: () => Response;
const server = setupServer(
  http.post("https://boletix.test/api/submissions", async ({ request }) => {
    received.push(await request.json());
    return reply();
  }),
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  received.length = 0;
  vi.useRealTimers();
});
afterAll(() => server.close());

function send(storage = memoryStorage()) {
  return sendBoletim(verified, { page: "https://boletix.test/enviar", storage });
}

describe("sendBoletim", () => {
  it("posts exactly the verified submission and remembers an accepted boletim", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-04T20:00:00Z") });
    reply = () => HttpResponse.json({ status: "new" }, { status: 201 });
    const storage = memoryStorage();

    expect(await send(storage)).toEqual({
      tone: "success",
      title: "Boletim enviado",
      message: "Obrigado! Ele foi verificado e guardado.",
      retry: false,
    });
    expect(received).toEqual([verified.submission]);
    expect(listContributions(storage)).toEqual([
      {
        id: verified.submission.hash,
        uf: "DF",
        municipio: 97012,
        zona: 11,
        secao: 178,
        urna: "2028869",
        enviadoEm: "2026-10-04T20:00:00.000Z",
        status: "aceito",
      },
    ]);
  });

  it("remembers a conflicting boletim as a conflict, and an already-known one not at all", async () => {
    const storage = memoryStorage();
    reply = () => HttpResponse.json({ status: "conflict" }, { status: 409 });
    expect(await send(storage)).toEqual({
      tone: "warning",
      title: "Conflito detectado",
      message:
        "Já recebemos um boletim diferente para esta seção. Mantivemos o primeiro e avisamos a equipe.",
      retry: false,
    });
    expect(listContributions(storage)).toEqual([expect.objectContaining({ status: "conflito" })]);

    const fresh = memoryStorage();
    reply = () => HttpResponse.json({ status: "duplicate" }, { status: 200 });
    expect(await send(fresh)).toEqual({
      tone: "info",
      title: "Este boletim já foi enviado",
      message: "Alguém já enviou este mesmo boletim. Nada mais a fazer.",
      retry: false,
    });
    expect(listContributions(fresh)).toEqual([]);
  });

  it("confirms the boletim even when the device can't remember it", async () => {
    reply = () => HttpResponse.json({ status: "new" }, { status: 201 });
    const full = memoryStorage();
    full.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };

    expect(await send(full)).toMatchObject({ title: "Boletim enviado" });
  });

  it.each([
    [
      () => HttpResponse.json({ error: "SIGNATURE_INVALID" }, { status: 422 }),
      {
        tone: "destructive",
        title: "Assinatura inválida",
        message: "A assinatura digital não confere: o boletim pode ter sido alterado.",
        retry: false,
      },
    ],
    [
      () => HttpResponse.json({ error: "HASH_MISMATCH" }, { status: 422 }),
      {
        title: "Boletim recusado",
        message: "O conteúdo do boletim não confere com o hash impresso.",
        retry: false,
      },
    ],
    [
      () => HttpResponse.json({ error: "RATE_LIMITED" }, { status: 429 }),
      {
        tone: "warning",
        title: "Limite de envios atingido",
        message: "Muitos envios seguidos. Aguarde um minuto e tente novamente.",
        retry: true,
      },
    ],
    [
      () => new HttpResponse("oops", { status: 500 }),
      {
        title: "Erro de servidor ou rede",
        message: "O servidor não conseguiu processar o envio. Tente novamente mais tarde.",
        retry: true,
      },
    ],
    [
      () => HttpResponse.error(),
      {
        title: "Erro de servidor ou rede",
        message: "Não foi possível enviar. Verifique sua conexão e tente novamente.",
        retry: true,
      },
    ],
  ])("only offers a retry when sending again could succeed (%#)", async (response, outcome) => {
    reply = response;
    const storage = memoryStorage();

    expect(await send(storage)).toMatchObject(outcome);
    expect(listContributions(storage)).toEqual([]);
  });

  it.each([{ status: "constructor" }, { error: "constructor" }, { error: "toString" }])(
    "treats an unknown server answer as a server error (%o)",
    async (body) => {
      reply = () => HttpResponse.json(body, { status: 200 });

      expect(await send()).toMatchObject({ title: "Erro de servidor ou rede", retry: true });
    },
  );
});
