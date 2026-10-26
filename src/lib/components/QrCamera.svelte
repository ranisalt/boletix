<script lang="ts">
  import CameraOff from '@lucide/svelte/icons/camera-off';
  import { m } from '../paraglide/messages.js';
  import StatusBox from './StatusBox.svelte';

  interface Props {
    /** Called with the text of every QR code seen; the caller dedupes. */
    onscan: (text: string) => void;
    /** Stops the camera when false, e.g. once every QR is in; reopens it when true again. */
    active?: boolean;
  }

  let { onscan, active = true }: Props = $props();

  // Unknown until mounted: the server can't tell, and guessing there flashes a false warning.
  // Old browsers keep the rest of the page; only scanning is unavailable.
  let supported: boolean | undefined = $state();
  $effect(() => {
    supported = typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof WebAssembly === 'object';
  });

  let video: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | undefined = $state.raw();
  let denied = $state(false);
  let opening = false;

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
    opening = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      denied = true;
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
    else if (supported && !stream && !denied && !opening) void open();
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

{#if supported === false}
  <StatusBox tone="warning" role="alert" title={m.camera_unsupported_title()}>{m.camera_unsupported()}</StatusBox>
{:else if denied}
  <StatusBox tone="warning" role="alert" title={m.camera_denied_title()}>{m.camera_denied()}</StatusBox>
{/if}
<div class="relative aspect-square overflow-hidden rounded-lg bg-viewfinder">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} class="size-full object-cover" aria-label={m.camera_preview()} autoplay muted playsinline></video>
  {#if !stream}
    <CameraOff class="absolute inset-0 m-auto size-12 text-muted-foreground" aria-hidden="true" />
  {/if}
  <div class="pointer-events-none absolute inset-[15%] rounded-lg border-4 border-primary"></div>
</div>
