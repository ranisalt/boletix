<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";

  import { m } from "../paraglide/messages.js";

  const KEY = "boletix:aviso";

  // Shown after hydration, so visitors who already acknowledged it never see it flash.
  let visible = $state(false);
  onMount(() => {
    visible = !localStorage.getItem(KEY);
  });

  function dismiss() {
    localStorage.setItem(KEY, "1");
    visible = false;
  }
</script>

{#if visible}
  <div
    role="region"
    aria-label={m.notice_label()}
    class="border-b-2 border-warning bg-notice text-notice-foreground"
  >
    <div class="mx-auto flex max-w-5xl items-start gap-3 px-4 py-3">
      <p class="flex-1 text-sm leading-relaxed">
        <strong>{m.notice_prefix()}</strong>
        {m.disclaimer()}
      </p>
      <button
        type="button"
        class="btn min-h-11 border-2 border-current px-3 text-sm"
        onclick={dismiss}
      >
        <X class="size-4" aria-hidden="true" />
        {m.notice_dismiss()}
      </button>
    </div>
  </div>
{/if}
