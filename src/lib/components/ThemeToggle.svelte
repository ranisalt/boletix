<script lang="ts">
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { onMount } from "svelte";

  import { m } from "../paraglide/messages.js";

  // app.html applies the saved or system theme before paint; start from what it chose.
  let dark = $state(false);
  onMount(() => {
    dark = document.documentElement.classList.contains("dark");
  });

  function toggle() {
    dark = !dark;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("boletix:theme", dark ? "dark" : "light");
  }
</script>

<button
  type="button"
  class="btn px-3 text-foreground hover:bg-muted"
  aria-label={dark ? m.theme_light() : m.theme_dark()}
  onclick={toggle}
>
  {#if dark}<Sun class="size-5" />{:else}<Moon class="size-5" />{/if}
</button>
