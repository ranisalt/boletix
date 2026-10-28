<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";

  const { id, question, children }: { id?: string; question: string; children: Snippet } = $props();
</script>

<details {id} class="group scroll-mt-4">
  <summary
    class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-medium"
  >
    {question}
    <ChevronDown
      class="size-5 shrink-0 transition-transform group-open:rotate-180"
      aria-hidden="true"
    />
  </summary>
  <div class="px-4 pb-4 text-muted-foreground">{@render children()}</div>
</details>
