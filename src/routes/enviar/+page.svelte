<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { BuSubmitter } from "#lib/submission/index.js";
  import { PageHead } from "#lib/ui/index.js";
</script>

<PageHead title={m.submit_title()} description={m.home_step_scan()} />

<BuSubmitter />
