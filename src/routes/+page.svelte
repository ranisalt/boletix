<script lang="ts">
  import ChartColumn from '@lucide/svelte/icons/chart-column';
  import ScanLine from '@lucide/svelte/icons/scan-line';
  import Send from '@lucide/svelte/icons/send';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import { resolve } from '$app/paths';
  import PageHead from '#lib/components/PageHead.svelte';
  import { m } from '#lib/paraglide/messages.js';

  const STEPS = [
    { icon: ScanLine, title: m.home_step_scan_title, text: m.home_step_scan },
    { icon: ShieldCheck, title: m.home_step_verify_title, text: m.home_step_verify },
    { icon: Send, title: m.home_step_send_title, text: m.home_step_send },
    { icon: ChartColumn, title: m.home_step_totals_title, text: m.home_step_totals }
  ];
</script>

<PageHead description={m.home_description()} />

<div class="space-y-12">
  <section class="space-y-5">
    <p class="font-mono text-sm font-semibold tracking-wider text-primary uppercase">{m.home_eyebrow()}</p>
    <h1 class="max-w-2xl text-4xl leading-tight font-bold md:text-5xl">{m.home_title()}</h1>
    <p class="max-w-2xl text-lg text-muted-foreground">
      {m.home_intro_before()} <strong class="text-foreground">{m.home_intro_bu()}</strong>{m.home_intro_after()}
    </p>
    <div class="flex flex-wrap gap-3">
      <a href={resolve('/enviar')} class="btn bg-primary text-lg text-primary-foreground">
        <ScanLine class="size-5" aria-hidden="true" />
        {m.submit_button()}
      </a>
    </div>
  </section>

  <section aria-labelledby="como">
    <h2 id="como" class="mb-5 text-2xl font-bold">{m.home_how_title()}</h2>
    <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each STEPS as step, i (i)}
        <li class="rounded-lg border bg-card p-5">
          <div class="mb-3 flex items-center gap-3">
            <span class="grid size-9 place-items-center rounded-md bg-accent font-mono font-semibold text-accent-foreground">{i + 1}</span>
            <step.icon class="size-5 text-primary" aria-hidden="true" />
          </div>
          <h3 class="font-semibold">{step.title()}</h3>
          <p class="mt-1 text-sm text-muted-foreground">{step.text()}</p>
        </li>
      {/each}
    </ol>
  </section>
</div>
