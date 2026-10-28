<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";

  /** Lets the reader type freely and watch SHA-512's avalanche effect between edits. */

  async function sha512(text: string) {
    const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  let text = $state("");
  const id = $props.id();
  let hash = $state("");
  // The digest of the text before the last edit; empty until the first edit.
  let previous = $state("");
  const changed = $derived(
    previous ? [...hash].filter((char, i) => char !== previous[i]).length : 0,
  );

  $effect(() => {
    // Hashing is async: drop a digest if the text changed before it resolved.
    let stale = false;
    sha512(text).then((digest) => {
      if (stale) return;
      previous = hash;
      hash = digest;
    });
    return () => (stale = true);
  });
</script>

<div class="space-y-2 rounded-lg border-2 bg-background p-3">
  <label for="{id}-input" class="block font-semibold">{m.hash_demo_label()}</label>
  <p id="{id}-hint" class="text-sm text-muted-foreground">{m.hash_demo_avalanche()}</p>
  <input
    id="{id}-input"
    aria-describedby="{id}-hint"
    bind:value={text}
    placeholder="13:142"
    spellcheck="false"
    autocomplete="off"
    class="w-full rounded bg-sky-500/25 px-1.5 py-0.5 font-mono"
  />
  <output aria-label="SHA-512" class="block font-mono text-xs break-all">
    {#each hash as char, i (i)}
      {#if !previous || char === previous[i]}{char}{:else}<span
          data-changed
          class="font-bold text-destructive">{char}</span
        >{/if}
    {/each}
  </output>
  {#if previous}
    <p class="text-sm text-muted-foreground">{m.hash_demo_changed({ count: changed })}</p>
  {/if}
</div>
