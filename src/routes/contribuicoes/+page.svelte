<script lang="ts">
  import ContributionList from "#lib/components/ContributionList.svelte";
  import PageHead from "#lib/components/PageHead.svelte";
  import { m } from "#lib/paraglide/messages.js";
</script>

<PageHead title={m.contributions_title()} description={m.contributions_intro()} />

<div class="space-y-6">
  <h1 class="text-3xl font-bold">{m.contributions_title()}</h1>
  <p class="text-muted-foreground">{m.contributions_intro()}</p>
  <ContributionList />
</div>
