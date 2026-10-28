<script lang="ts">
  import Heart from "@lucide/svelte/icons/heart";

  import { m } from "../paraglide/messages.js";

  const { names }: { names: readonly string[] } = $props();
</script>

{#if names.length > 0}
  <section aria-labelledby="thanks-title">
    <h2 id="thanks-title" class="mb-3 text-xl font-semibold">{m.thanks_title()}</h2>
    <div class="space-y-3 rounded-lg border bg-card p-4">
      <p class="flex items-center gap-2 text-muted-foreground">
        <Heart class="size-5 shrink-0 text-primary" aria-hidden="true" />
        {m.thanks_subtitle()}
      </p>
      <ul class="flex flex-wrap gap-2">
        {#each names as name (name)}
          <li class="rounded-full bg-muted px-3 py-1 text-sm font-medium">{name}</li>
        {/each}
      </ul>
    </div>
  </section>
{/if}
