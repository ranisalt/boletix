<script lang="ts">
  import type { Snippet } from "svelte";

  /** Colour-codes one BU field so the reader can follow it from the table into the QR text. */
  type Props = { tone: keyof typeof TONES; children: Snippet };

  const TONES = {
    // Header and trailer fields that have no row in the table.
    plain: "bg-slate-500/20",
    meta: "bg-rose-500/25",
    a: "bg-sky-500/25",
    b: "bg-emerald-500/25",
    c: "bg-fuchsia-500/25",
    blank: "bg-amber-500/25",
  };

  const { tone, children }: Props = $props();
</script>

<span class="rounded px-1.5 py-0.5 font-mono break-all {TONES[tone]}">{@render children()}</span>
