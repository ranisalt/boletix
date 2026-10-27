<script lang="ts">
  import CameraOff from "@lucide/svelte/icons/camera-off";

  import { m } from "../paraglide/messages.js";
  import { StatusBox } from "../ui";

  interface Props {
    /** Called with the text of every QR code seen; the caller dedupes. */
    onscan: (text: string) => void;
    /** Stops the camera when false, e.g. once every QR is in; reopens it when true again. */
    active?: boolean;
  }

  const { onscan, active = true }: Props = $props();

  // Unknown until mounted: the server can't tell, and guessing there flashes a false warning.
  // Old browsers keep the rest of the page; only scanning is unavailable.
  // eslint-disable-next-line svelte/prefer-writable-derived -- a $derived would also run on the server.
  let supported: boolean | undefined = $state();
  $effect(() => {
    supported =
      typeof navigator.mediaDevices?.getUserMedia === "function" && typeof WebAssembly === "object";
  });

  let video: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | undefined = $state.raw();
  // Refused permission needs the browser settings; anything else (no camera, in use) may clear up.
  let failure: "denied" | "unavailable" | "reader" | undefined = $state();
  let opening = false;
  let destroyed = false;

  const SCAN_INTERVAL_MS = 250;

  async function loadReader() {
    const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([
      import("zxing-wasm/reader"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);
    // Serve the WASM with the app instead of the package's default CDN.
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? wasmUrl : prefix + path,
      },
    });
    return readBarcodes;
  }

  async function open() {
    opening = true;
    try {
      const opened = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      // Unmounted while the permission prompt was open: nothing else will ever stop it.
      if (destroyed) opened.getTracks().forEach((track) => track.stop());
      else stream = opened;
    } catch (error) {
      const refused = error instanceof DOMException && error.name === "NotAllowedError";
      failure = refused ? "denied" : "unavailable";
    } finally {
      opening = false;
    }
  }

  function close() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  $effect(() => {
    if (!active) close();
    else if (supported && !stream && !failure && !opening) void open();
  });

  $effect(() => {
    if (!stream || !video) return;
    const element = video;
    element.srcObject = stream;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    loadReader().then(
      (readBarcodes) => {
        const tick = async () => {
          if (stopped) return;
          // One undecodable frame must not end the loop; the next one is a quarter second away.
          if (context && element.videoWidth > 0) {
            try {
              canvas.width = element.videoWidth;
              canvas.height = element.videoHeight;
              context.drawImage(element, 0, 0);
              // A BU sheet prints several QRs side by side; read them all from one frame.
              const results = await readBarcodes(
                context.getImageData(0, 0, canvas.width, canvas.height),
                {
                  formats: ["QRCode"],
                  tryHarder: true,
                  maxNumberOfSymbols: 8,
                },
              );
              for (const result of results) if (result.isValid) onscan(result.text);
            } catch {
              // Skip this frame.
            }
          }
          if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        void tick();
      },
      () => {
        failure = "reader";
      },
    );

    return () => {
      stopped = true;
      clearTimeout(timer);
      element.srcObject = null;
    };
  });

  $effect(() => () => {
    destroyed = true;
    close();
  });
</script>

{#if supported === false}
  <StatusBox tone="warning" role="alert" title={m.camera_unsupported_title()}
    >{m.camera_unsupported()}</StatusBox
  >
{:else if failure === "denied"}
  <StatusBox tone="warning" role="alert" title={m.camera_denied_title()}
    >{m.camera_denied()}</StatusBox
  >
{:else if failure === "unavailable"}
  <StatusBox tone="warning" role="alert" title={m.camera_unavailable_title()}>
    {m.camera_unavailable()}
    <button
      type="button"
      class="mt-2 block font-semibold underline"
      onclick={() => (failure = undefined)}>{m.camera_retry()}</button
    >
  </StatusBox>
{:else if failure === "reader"}
  <StatusBox tone="warning" role="alert" title={m.camera_reader_failed_title()}
    >{m.camera_reader_failed()}</StatusBox
  >
{/if}
<div class="relative aspect-square overflow-hidden rounded-lg bg-viewfinder">
  <video
    bind:this={video}
    class="size-full object-cover"
    aria-label={m.camera_preview()}
    autoplay
    muted
    playsinline
  ></video>
  {#if !stream}
    <CameraOff class="absolute inset-0 m-auto size-12 text-muted-foreground" aria-hidden="true" />
  {/if}
  <div class="pointer-events-none absolute inset-[15%] rounded-lg border-4 border-primary"></div>
</div>
