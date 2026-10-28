<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";

  /** Lets the reader edit a vote and watch SHA-512's avalanche effect on the digest. */
  const SAMPLE = "13:142";

  async function sha512(text: string) {
    const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  let text = $state(SAMPLE);
  let original = $state("");
  let hash = $state("");
  const changed = $derived([...hash].filter((char, i) => char !== original[i]).length);

  sha512(SAMPLE).then((digest) => (original = digest));
  $effect(() => {
    // Hashing is async: drop a digest if the text changed before it resolved.
    let stale = false;
    sha512(text).then((digest) => {
      if (!stale) hash = digest;
    });
    return () => (stale = true);
  });
</script>

<div class="space-y-2 rounded-lg border-2 bg-background p-3">
  <label class="flex flex-wrap items-center gap-2 font-semibold">
    {m.hash_demo_label()}
    <input
      bind:value={text}
      spellcheck="false"
      autocomplete="off"
      class="w-40 rounded bg-sky-500/25 px-1.5 py-0.5 font-mono font-normal"
    />
  </label>
  <output aria-label="SHA-512" class="block font-mono text-xs break-all">
    {#each hash as char, i (i)}
      {#if char === original[i]}{char}{:else}<span data-changed class="font-bold text-destructive"
          >{char}</span
        >{/if}
    {/each}
  </output>
  <p class="text-sm text-muted-foreground">{m.hash_demo_changed({ count: changed })}</p>
</div>
