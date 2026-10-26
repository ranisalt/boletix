<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  import OfficialSources from "#lib/components/OfficialSources.svelte";
  import PageHead from "#lib/components/PageHead.svelte";
  import { m } from "#lib/paraglide/messages.js";

  const METHODOLOGY = [
    [m.about_crypto_title, m.about_crypto],
    [m.about_privacy_title, m.about_privacy],
    [m.about_transparency_title, m.about_transparency],
  ];

  const FAQ = [
    [m.faq_official_q, m.faq_official_a],
    [m.faq_authentic_q, m.faq_authentic_a],
    [m.faq_data_q, m.faq_data_a],
    [m.faq_missing_q, m.faq_missing_a],
    [m.faq_conflict_q, m.faq_conflict_a],
  ];
</script>

<PageHead title={m.nav_about()} description={m.about_description()} />

<div class="max-w-3xl space-y-10">
  <section class="space-y-4">
    <h1 class="text-3xl font-bold">{m.about_title()}</h1>
    <h2 class="text-xl font-semibold">{m.about_methodology()}</h2>
    <ul class="list-disc space-y-2 pl-5 text-muted-foreground">
      {#each METHODOLOGY as [title, text], i (i)}
        <li><strong class="text-foreground">{title()}</strong> {text()}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h2 class="mb-3 text-xl font-semibold">{m.about_faq()}</h2>
    <div class="divide-y rounded-lg border bg-card">
      {#each FAQ as [question, answer], i (i)}
        <details class="group">
          <summary
            class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-medium"
          >
            {question()}
            <ChevronDown
              class="size-5 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p class="px-4 pb-4 text-muted-foreground">{answer()}</p>
        </details>
      {/each}
    </div>
  </section>

  <section>
    <h2 class="mb-3 text-xl font-semibold">{m.about_sources()}</h2>
    <OfficialSources class="space-y-2" />
  </section>
</div>
