<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import { StatusBox } from "#lib/ui/index.js";

  import { CARGOS, TURNOS, UFS, type TotalsQuery } from "./filter";

  type Props = {
    query: TotalsQuery;
    /** Null when the choice can't be totalled: a state role with no UF. */
    totals: {
      secoes: number;
      /** Sections TSE counts for this choice; unknown before its data is published. */
      secoesTotal?: number;
      candidatos: { numero: string; nome?: string; partido?: string; votos: number }[];
      brancos: number;
      nulos: number;
    } | null;
  };

  const { query, totals }: Props = $props();

  const CARGO_NAMES: Record<TotalsQuery["cargo"], () => string> = {
    1: m.cargo_1,
    3: m.cargo_3,
    5: m.cargo_5,
  };
  const number = new Intl.NumberFormat("pt-BR");
  const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
  const leader = $derived(totals?.candidatos[0]?.votos ?? 0);
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">{m.totals_title()}</h1>

  <StatusBox tone="warning" title={m.totals_unofficial_title()}>{m.totals_unofficial()}</StatusBox>

  <!-- A plain GET form: works without JS, and SvelteKit turns it into a client navigation. -->
  <form
    method="get"
    aria-label={m.totals_filters()}
    class="grid grid-cols-2 gap-3 md:grid-cols-4"
    onchange={(event) => event.currentTarget.requestSubmit()}
  >
    <label class="space-y-1 text-sm text-muted-foreground">
      <span>{m.field_election()}</span>
      <select name="eleicao" class="select">
        <option value="br-2026-general">{m.election_br_2026_general()}</option>
      </select>
    </label>
    <label class="space-y-1 text-sm text-muted-foreground">
      <span>{m.field_turno()}</span>
      <select name="turno" class="select" value={String(query.turno)}>
        {#each TURNOS as turno (turno)}
          <option value={String(turno)}>{m.turno_option({ turno })}</option>
        {/each}
      </select>
    </label>
    <label class="space-y-1 text-sm text-muted-foreground">
      <span>{m.field_cargo()}</span>
      <select name="cargo" class="select" value={String(query.cargo)}>
        {#each CARGOS as cargo (cargo)}
          <option value={String(cargo)}>{CARGO_NAMES[cargo]()}</option>
        {/each}
      </select>
    </label>
    <label class="space-y-1 text-sm text-muted-foreground">
      <span>{m.field_uf()}</span>
      <select name="uf" class="select" value={query.uf ?? ""}>
        <option value="">{m.uf_all()}</option>
        {#each UFS as uf (uf)}
          <option value={uf}>{uf === "ZZ" ? m.uf_zz() : uf}</option>
        {/each}
      </select>
    </label>
    <noscript>
      <button class="btn border-2 border-input">{m.totals_apply()}</button>
    </noscript>
  </form>

  {#if !totals}
    <p class="text-muted-foreground">{m.totals_pick_uf({ cargo: CARGO_NAMES[query.cargo]() })}</p>
  {:else if totals.secoes === 0}
    <p class="text-muted-foreground">{m.totals_empty()}</p>
  {:else}
    <!-- The number of sections per UF isn't known yet, so coverage is a count, not a share. -->
    <section
      class="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-card p-4"
      aria-labelledby="cobertura"
    >
      <h2 id="cobertura" class="font-semibold">{m.totals_coverage()}</h2>
      {#if totals.secoesTotal}
        <p class="font-mono text-sm">
          {m.totals_sections_of({
            count: number.format(totals.secoes),
            total: number.format(totals.secoesTotal),
            percent: percent.format(totals.secoes / totals.secoesTotal),
          })}
        </p>
        <div
          role="progressbar"
          aria-labelledby="cobertura"
          aria-valuemin={0}
          aria-valuenow={totals.secoes}
          aria-valuemax={totals.secoesTotal}
          class="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            class="h-full bg-primary"
            style:width="{Math.min(100, (totals.secoes / totals.secoesTotal) * 100)}%"
          ></div>
        </div>
      {:else}
        <p class="font-mono text-sm">
          {m.totals_sections({ count: number.format(totals.secoes) })}
        </p>
      {/if}
    </section>

    <ul aria-label={m.totals_votes()} class="divide-y rounded-lg border bg-card">
      {#each totals.candidatos as row (row.numero)}
        <li class="space-y-2 p-4">
          <div class="flex items-baseline justify-between gap-3">
            <p class="font-semibold">
              {#if row.nome}{row.nome}
                <span class="text-xs font-normal text-muted-foreground">{row.partido}</span>
              {/if}
              <span class="font-mono text-sm text-muted-foreground">{row.numero}</span>
            </p>
            <p class="font-mono font-semibold">{number.format(row.votos)}</p>
          </div>
          <div
            role="meter"
            aria-label={row.nome ?? row.numero}
            aria-valuemin={0}
            aria-valuemax={leader}
            aria-valuenow={row.votos}
            class="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              class="h-full bg-muted-foreground"
              style:width="{(row.votos / leader) * 100}%"
            ></div>
          </div>
        </li>
      {/each}
      {#each [[m.results_brancos(), totals.brancos], [m.results_nulos(), totals.nulos]] as const as [label, votos] (label)}
        <li class="flex justify-between gap-3 p-4 text-sm text-muted-foreground">
          <span>{label}</span>
          <span class="font-mono">{number.format(votos)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
