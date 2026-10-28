<script lang="ts">
  import type { Snippet } from "svelte";

  /** A short aside inside a step that answers one "but why?" question. */
  type Props = { title: string; children: Snippet };

  const { title, children }: Props = $props();
</script>

<div class="rounded-lg border-2 bg-background p-4">
  <h4 class="mb-1 font-semibold">{title}</h4>
  <div class="space-y-2 text-sm text-muted-foreground">{@render children()}</div>
</div>
