<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { TotalsView } from "#lib/totals/index.js";
  import { PageHead } from "#lib/ui/index.js";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
</script>

<PageHead title={m.totals_title()} description={m.totals_description()} />

<TotalsView query={data.query} totals={data.totals} />
