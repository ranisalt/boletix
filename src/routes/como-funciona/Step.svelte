<script lang="ts">
  import type { Component, Snippet } from "svelte";

  type Props = { n: number; icon: Component; title: string; children: Snippet };

  const { n, icon: Icon, title, children }: Props = $props();
  const id = $derived(`passo-${n}`);
</script>

<section class="rounded-xl border-2 bg-card p-5 md:p-7" aria-labelledby={id}>
  <div class="mb-4 flex items-center gap-3">
    <span
      class="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-lg font-bold text-primary-foreground tabular-nums"
      >{n}</span
    >
    <Icon class="size-6 shrink-0 text-primary" aria-hidden="true" />
    <h3 {id} class="text-xl font-bold">{title}</h3>
  </div>
  <div class="space-y-4 leading-relaxed">
    {@render children()}
  </div>
</section>
