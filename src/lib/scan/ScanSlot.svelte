<script lang="ts">
  import Circle from "@lucide/svelte/icons/circle";
  import CircleCheck from "@lucide/svelte/icons/circle-check";

  import { m } from "../paraglide/messages.js";

  type Props = {
    label: string;
    done: boolean;
  };

  const { label, done }: Props = $props();
</script>

<li
  data-state={done ? "read" : "pending"}
  class="flex min-h-12 items-center justify-between gap-2 rounded-md border-2 bg-card px-3"
  class:border-success={done}
>
  <span class="font-mono text-sm">{label}</span>
  {#if done}
    <span class="flex items-center gap-1 text-sm font-semibold text-success">
      <CircleCheck class="size-4" aria-hidden="true" />
      {m.slot_read()}
    </span>
  {:else}
    <span class="flex items-center gap-1 text-sm text-muted-foreground">
      <Circle class="size-4" aria-hidden="true" />
      {m.slot_pending()}
    </span>
  {/if}
</li>
