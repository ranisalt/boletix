<script lang="ts">
  import { ContributionList } from "#lib/contributions/index.js";
  import { m } from "#lib/paraglide/messages.js";
  import { TotalsView } from "#lib/totals/index.js";
  import { PageHead } from "#lib/ui/index.js";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
</script>

<PageHead title={m.totals_title()} description={m.totals_description()} />

<div class="space-y-10">
  <TotalsView query={data.query} totals={data.totals} />

  <section id="minhas-contribuicoes" class="scroll-mt-4 space-y-3">
    <h2 class="text-xl font-semibold">{m.contributions_title()}</h2>
    <p class="text-muted-foreground">{m.contributions_intro()}</p>
    <ContributionList />
  </section>
</div>
