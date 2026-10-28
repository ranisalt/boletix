<script lang="ts">
  import type { Component, Snippet } from "svelte";

  type Props = { n: number; icon: Component; title: string; children: Snippet };

  const { n, icon: Icon, title, children }: Props = $props();
</script>

<li class="rounded-xl border-2 bg-card p-5">
  <div class="mb-2 flex items-center gap-3">
    <span
      class="grid size-9 place-items-center rounded-md bg-accent font-bold text-accent-foreground tabular-nums"
      >{n}</span
    >
    <Icon class="size-5 text-primary" aria-hidden="true" />
  </div>
  <h3 class="font-semibold">{title}</h3>
  <p class="mt-1 text-sm text-muted-foreground">{@render children()}</p>
</li>
