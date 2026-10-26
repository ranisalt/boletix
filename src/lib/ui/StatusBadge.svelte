<script lang="ts">
  import Circle from "@lucide/svelte/icons/circle";
  import type { Snippet } from "svelte";

  import { TONE_CLASSES, TONE_ICONS, type Tone } from "./StatusBox.svelte";

  interface Props {
    tone: Tone;
    children: Snippet;
  }

  const { tone, children }: Props = $props();

  const Icon = $derived(tone === "neutral" ? Circle : TONE_ICONS[tone]);
</script>

<span
  data-tone={tone}
  class="inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-sm font-semibold {TONE_CLASSES[
    tone
  ]}"
>
  <Icon class="size-4" aria-hidden="true" />
  {@render children()}
</span>
