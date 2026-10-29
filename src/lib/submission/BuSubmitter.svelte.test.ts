import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { flushSync } from "svelte";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { chainHashes } from "../bu";
import { loadBuFixture } from "../bu/testing/fixtures";
import { listContributions } from "../contributions";
import { ScanSession } from "../scan";
import BuSubmitter from "./BuSubmitter.svelte";

const fixture = loadBuFixture("df-97012-11-178");
const [buQr] = fixture.qrbu as [string];
const [cert1, cert2] = fixture.qrce as [string, string];

async function buildMultiPart(total: number): Promise<string[]> {
  const body = buQr.replace(/^QRBU:1:1 VRQR:6\.0 /, "").replace(/ HASH:.*$/, "");
  const tokens = body.split(" ");
  const size = Math.ceil(tokens.length / total);
  const contents = Array.from({ length: total }, (_, i) =>
    tokens.slice(i * size, (i + 1) * size).join(" "),
  );
  const hashes = await chainHashes(contents);
  return contents.map(
    (content, i) =>
      `QRBU:${i + 1}:${total} VRQR:6.0 ${content} HASH:${hashes[i]}${i === total - 1 ? " ASSI:00" : ""}`,
  );
}
const multiParts = new Map(
  await Promise.all([3].map(async (total) => [total, await buildMultiPart(total)] as const)),
);
const multiPart = (total: number): string[] => multiParts.get(total)!;

const received: unknown[] = [];
const acceptNew = () =>
  HttpResponse.json({ status: "new", hash: "A".repeat(128) }, { status: 201 });
let reply: () => Response = acceptNew;
const NAMES: Record<string, object> = {
  BR: {
    geradoEm: "25/10/2026 12:30:51",
    municipios: {},
    candidatos: { "6258": { "1": { "13": ["LULA", "PT"] } } },
    partidos: {},
  },
  DF: {
    geradoEm: "25/10/2026 12:30:51",
    municipios: { "97012": "BRASÍLIA" },
    candidatos: {},
    partidos: {},
  },
};
const server = setupServer(
  http.post("*/api/submissions", async ({ request }) => {
    received.push(await request.json());
    return reply();
  }),
  http.get("*/tse/2026/:area.json", ({ params }) =>
    HttpResponse.json(NAMES[params.area as string]),
  ),
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  received.length = 0;
  localStorage.clear();
  vi.restoreAllMocks();
  reply = acceptNew;
});
afterAll(() => server.close());

function setup() {
  const session = new ScanSession();
  render(BuSubmitter, { session });
  const scan = (...raws: string[]) => flushSync(() => raws.forEach((raw) => session.add(raw)));
  return { session, scan };
}

function items(listName: string): string[] {
  return within(screen.getByRole("list", { name: listName }))
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace(/\s+/g, " ").trim() ?? "");
}

const WAITING =
  "Leia qualquer QR code do boletim para descobrir quantas partes ele tem. A ordem não importa.";

describe("BuSubmitter", () => {
  it("asks for any BU QR first and shows two pending certificate parts", () => {
    setup();

    expect(screen.getByText(WAITING)).toBeInTheDocument();
    expect(items("Certificado digital")).toEqual([
      "Certificado 1 de 2 pendente",
      "Certificado 2 de 2 pendente",
    ]);
  });

  it("pre-renders one slot per BU QR once any of them is scanned", () => {
    const { scan } = setup();
    scan(multiPart(3)[1]!);

    expect(items("QR codes do boletim")).toEqual([
      "Parte 1 de 3 pendente",
      "Parte 2 de 3 lido",
      "Parte 3 de 3 pendente",
    ]);
    expect(screen.queryByRole("button", { name: "Enviar boletim" })).not.toBeInTheDocument();
  });

  it("verifies the signature once complete and shows which section it is", async () => {
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(await screen.findByText("Assinatura verificada")).toBeInTheDocument();
    const terms = (await screen.findAllByRole("term")).map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      UF: "DF",
      Município: "97012 – BRASÍLIA",
      Zona: "11",
      Seção: "178",
      Urna: "2028869",
    });
    expect(screen.getByRole("button", { name: "Enviar boletim" })).toBeEnabled();
  });

  it("names the municipality and lists the votes of every role for comparison with the paper", async () => {
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(await screen.findByText("97012 – BRASÍLIA")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table", { name: "Presidente" })).getByRole("row", {
        name: "13 LULA PT 121",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("table", { name: "Governador" })).getByRole("row", {
        name: "11 122",
      }),
    ).toBeInTheDocument();
  });

  it("says the names are loading, and lets the boletim be sent meanwhile", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get("*/tse/2026/:area.json", async ({ params }) => {
        await held;
        return HttpResponse.json(NAMES[params.area as string]);
      }),
    );
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(await screen.findByRole("status", { name: "Carregando nomes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar boletim" })).toBeEnabled();
    release();
    expect(await screen.findByText("97012 – BRASÍLIA")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Carregando nomes" })).not.toBeInTheDocument();
  });

  it("falls back to numbers when a name file breaks the results", async () => {
    server.use(http.get("*/tse/2026/:area.json", () => HttpResponse.json({})));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(
      within(await screen.findByRole("table", { name: "Presidente" })).getByRole("row", {
        name: "13 121",
      }),
    ).toBeInTheDocument();
    await new Promise((settle) => setTimeout(settle, 50));
    expect(screen.getByText("97012")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Enviar boletim" }));
    expect(await screen.findByRole("status", { name: "Boletim enviado" })).toBeInTheDocument();
  });

  it("still shows the votes by number when the names cannot be loaded", async () => {
    server.use(http.get("*/tse/2026/:area.json", () => HttpResponse.error()));
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(
      within(await screen.findByRole("table", { name: "Presidente" })).getByRole("row", {
        name: "13 121",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("97012")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar boletim" })).toBeEnabled();
  });

  it("drops a verification that finishes after the scan was reset", async () => {
    const { session, scan } = setup();
    scan(buQr, cert1, cert2);
    session.reset();

    await session.verify();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Assinatura verificada")).not.toBeInTheDocument();
    expect(screen.getByText(WAITING)).toBeInTheDocument();
  });

  it("explains a failed verification and offers to start over instead of sending", async () => {
    const { scan } = setup();
    scan(buQr, ...loadBuFixture("zz-29386-1-1709").qrce);

    expect(
      await screen.findByRole("alert", {
        name: "Não foi possível verificar o boletim",
      }),
    ).toHaveTextContent("O certificado digital é de outra urna.");
    expect(screen.queryByRole("button", { name: "Enviar boletim" })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Recomeçar" }));
    expect(screen.getByText(WAITING)).toBeInTheDocument();
  });

  it("sends exactly the verified submission, confirms it and remembers it on this device", async () => {
    const { session, scan } = setup();
    scan(buQr, cert1, cert2);
    const verification = await session.verify();

    await fireEvent.click(await screen.findByRole("button", { name: "Enviar boletim" }));

    const outcome = await screen.findByRole("status", { name: "Boletim enviado" });
    expect(outcome).toHaveTextContent("Obrigado! O boletim foi conferido e guardado.");
    // The send button is gone, so focus moves to the outcome instead of falling back to the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(outcome);
    expect(received).toEqual([verification.ok && verification.submission]);
    expect(screen.queryByRole("button", { name: "Enviar boletim" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas contribuições" })).toHaveAttribute(
      "href",
      "/totais#minhas-contribuicoes",
    );
    expect(listContributions()).toEqual([
      expect.objectContaining({
        uf: "DF",
        municipio: 97012,
        zona: 11,
        secao: 178,
        urna: "2028869",
        status: "aceito",
      }),
    ]);

    await fireEvent.click(screen.getByRole("button", { name: "Escanear outro" }));
    expect(screen.getByText(WAITING)).toBeInTheDocument();
  });

  it("lets the user retry after a network failure", async () => {
    reply = () => HttpResponse.error();
    const { scan } = setup();
    scan(buQr, cert1, cert2);
    await fireEvent.click(await screen.findByRole("button", { name: "Enviar boletim" }));
    await screen.findByRole("status", { name: "Erro de servidor ou rede" });

    reply = () => HttpResponse.json({ status: "new" }, { status: 201 });
    await fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await fireEvent.click(screen.getByRole("button", { name: "Enviar boletim" }));

    expect(await screen.findByRole("status", { name: "Boletim enviado" })).toBeInTheDocument();
  });

  it("offers no retry when the server rejected the boletim itself", async () => {
    reply = () => HttpResponse.json({ error: "SIGNATURE_INVALID" }, { status: 422 });
    const { scan } = setup();
    scan(buQr, cert1, cert2);
    await fireEvent.click(await screen.findByRole("button", { name: "Enviar boletim" }));
    await screen.findByRole("status", { name: "Assinatura inválida" });

    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("tells browsers without camera access that scanning is unavailable", () => {
    setup();

    expect(screen.getByRole("alert", { name: "Navegador não suportado" })).toHaveTextContent(
      "Seu navegador não permite acesso à câmera. Use uma versão recente do Chrome, Firefox ou Safari.",
    );
  });
});
