<script lang="ts">
  import BuSubmitter from '#lib/components/BuSubmitter.svelte';
  import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head><title>{m.submit_title()}</title></svelte:head>

<BuSubmitter />
