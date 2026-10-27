import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import QrCamera from "./QrCamera.svelte";

const reader = vi.hoisted(() => ({
  prepare: vi.fn(),
  readBarcodes: vi.fn(),
}));
vi.mock("zxing-wasm/reader", () => ({
  prepareZXingModule: reader.prepare,
  readBarcodes: reader.readBarcodes,
}));
vi.mock("zxing-wasm/reader/zxing_reader.wasm?url", () => ({ default: "/reader.wasm" }));

function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

const getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>();

beforeEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
  // jsdom has no media or canvas: pretend a frame is always ready.
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(10);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(10);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
    getImageData: () => ({}),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  getUserMedia.mockReset();
  reader.prepare.mockReset();
  reader.readBarcodes.mockReset();
});

describe("QrCamera", () => {
  it("stops a camera that opens after the scanner was closed", async () => {
    const { stream, stop } = fakeStream();
    let grant!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise((resolve) => (grant = resolve)));
    const { unmount } = render(QrCamera, { onscan: () => {} });
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    unmount();
    grant(stream);

    await vi.waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it("says permission was denied only when the user refused it", async () => {
    getUserMedia.mockRejectedValue(new DOMException("no", "NotAllowedError"));
    render(QrCamera, { onscan: () => {} });

    expect(await screen.findByRole("alert", { name: "Acesso à câmera negado" })).toHaveTextContent(
      "Permita o uso da câmera nas configurações do navegador e recarregue a página.",
    );
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("offers to try again when the camera is missing or busy", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("busy", "NotReadableError"));
    render(QrCamera, { onscan: () => {} });

    expect(await screen.findByRole("alert", { name: "Câmera indisponível" })).toHaveTextContent(
      "Não foi possível abrir a câmera. Feche outros apps que possam estar usando e tente novamente.",
    );

    getUserMedia.mockResolvedValueOnce(fakeStream().stream);
    await fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells the user when the QR reader can't be loaded", async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    reader.prepare.mockImplementation(() => {
      throw new TypeError("Failed to fetch");
    });
    render(QrCamera, { onscan: () => {} });

    expect(await screen.findByRole("alert", { name: "Leitor indisponível" })).toHaveTextContent(
      "Não foi possível carregar o leitor de QR code. Verifique sua conexão e recarregue a página.",
    );
  });

  it("keeps scanning after a frame fails to decode", async () => {
    getUserMedia.mockResolvedValue(fakeStream().stream);
    reader.readBarcodes
      .mockRejectedValueOnce(new Error("bad frame"))
      .mockResolvedValue([{ isValid: true, text: "QRBU:1:1" }]);
    const onscan = vi.fn();
    render(QrCamera, { onscan });

    await vi.waitFor(() => expect(onscan).toHaveBeenCalledWith("QRBU:1:1"), { timeout: 2000 });
  });
});
