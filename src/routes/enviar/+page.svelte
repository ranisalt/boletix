<script lang="ts">
  import BuSubmitter from '#lib/components/BuSubmitter.svelte';
  import PageHead from '#lib/components/PageHead.svelte';
  import { m } from '#lib/paraglide/messages.js';
</script>

<PageHead title={m.submit_title()} description={m.home_step_scan()} />

<BuSubmitter />
