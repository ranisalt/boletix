<script lang="ts">
  import type { Snippet } from "svelte";

  import { TONE_CLASSES, TONE_ICONS, type Tone } from "./tone.js";

  type Props = {
    tone: Tone;
    title: string;
    /** 'alert' interrupts screen readers; use it only for problems that block the user. */
    role?: "status" | "alert";
    children?: Snippet;
  };

  const { tone, title, role = "status", children }: Props = $props();

  const id = $props.id();
  const Icon = $derived(TONE_ICONS[tone]);
</script>

<div
  {role}
  aria-labelledby={id}
  data-tone={tone}
  class="flex gap-3 rounded-lg border-2 bg-card p-4 {TONE_CLASSES[tone]}"
>
  <Icon class="mt-0.5 size-6 shrink-0" aria-hidden="true" />
  <div class="text-card-foreground">
    <p {id} class="font-semibold">{title}</p>
    {#if children}
      <div class="mt-1 text-sm text-muted-foreground">{@render children()}</div>
    {/if}
  </div>
</div>
