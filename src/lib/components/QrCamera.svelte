<script lang="ts">
  import { m } from '../paraglide/messages.js';

  interface Props {
    /** Called with the text of every QR code seen; the caller dedupes. */
    onscan: (text: string) => void;
    /** Stops the camera when false, e.g. once every QR is in. */
    active?: boolean;
  }

  let { onscan, active = true }: Props = $props();

  // Old browsers keep the rest of the page; only scanning is unavailable.
  const supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof WebAssembly === 'object';

  let video: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | undefined = $state.raw();
  let denied = $state(false);

  const SCAN_INTERVAL_MS = 250;

  async function loadReader() {
    const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([
      import('zxing-wasm/reader'),
      import('zxing-wasm/reader/zxing_reader.wasm?url')
    ]);
    // Serve the WASM with the app instead of the package's default CDN.
    prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });
    return readBarcodes;
  }

  async function open() {
    denied = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      denied = true;
    }
  }

  function close() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  $effect(() => {
    if (!active) close();
  });

  $effect(() => {
    if (!stream || !video) return;
    const element = video;
    element.srcObject = stream;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void loadReader().then((readBarcodes) => {
      const tick = async () => {
        if (stopped) return;
        if (context && element.videoWidth > 0) {
          canvas.width = element.videoWidth;
          canvas.height = element.videoHeight;
          context.drawImage(element, 0, 0);
          // A BU sheet prints several QRs side by side; read them all from one frame.
          const results = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
            formats: ['QRCode'],
            tryHarder: true,
            maxNumberOfSymbols: 8
          });
          for (const result of results) if (result.isValid) onscan(result.text);
        }
        if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      void tick();
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      element.srcObject = null;
    };
  });

  $effect(() => close);
</script>

{#if !supported}
  <p>{m.camera_unsupported()}</p>
{:else if stream}
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} aria-label={m.camera_preview()} autoplay muted playsinline></video>
  <button type="button" onclick={close}>{m.camera_close()}</button>
{:else if active}
  <button type="button" onclick={open}>{m.camera_open()}</button>
  {#if denied}<p role="alert">{m.camera_denied()}</p>{/if}
{/if}
