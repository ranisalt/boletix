<script lang="ts">
  import { ExternalLink } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  type Props = { href: string; title: string; children: Snippet };

  const { href, title, children }: Props = $props();
</script>

<li>
  <a
    {href}
    target="_blank"
    rel="external noreferrer"
    class="block h-full rounded-lg border-2 p-4 hover:bg-muted"
  >
    <span class="flex items-center gap-2 font-semibold text-primary">
      {title}
      <ExternalLink class="size-4 shrink-0" aria-hidden="true" />
    </span>
    <span class="mt-1 block text-sm text-muted-foreground">{@render children()}</span>
  </a>
</li>
