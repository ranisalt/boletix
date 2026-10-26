<script lang="ts">
  import type { Bu } from '../bu/assemble';
  import { resultsView, type NameFile } from '../elections/names';
  import { m } from '../paraglide/messages.js';

  interface Props {
    bu: Bu;
    /** TSE name files; empty while loading or when unavailable, which leaves bare numbers. */
    names: NameFile[];
  }

  const { bu, names }: Props = $props();

  const view = $derived(resultsView(bu, names));
  const geradoEm = $derived(names[0]?.geradoEm);

  const CARGOS: Record<number, () => string> = {
    1: m.cargo_1,
    3: m.cargo_3,
    5: m.cargo_5,
    6: m.cargo_6,
    7: m.cargo_7,
    8: m.cargo_8
  };
  const cargoName = (cargo: number) => CARGOS[cargo]?.() ?? m.cargo_other({ cargo });
</script>

<section class="space-y-3">
  <h2 class="font-semibold">{m.results_title()}</h2>
  {#each view.cargos as cargo, i (i)}
    <table class="w-full text-sm">
      <caption class="pb-1 text-left font-semibold">{cargoName(cargo.cargo)}</caption>
      <thead class="text-xs text-muted-foreground">
        <tr>
          <th scope="col" class="w-16 text-left font-normal">{m.results_number()}</th>
          <th scope="col" class="text-left font-normal">{m.results_candidate()}</th>
          <th scope="col" class="text-right font-normal">{m.results_votes()}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border font-mono">
        {#each cargo.candidatos as row (row.numero)}
          <tr>
            <td class="py-1">{row.numero}</td>
            <td class="py-1 font-sans">
              {#if row.nome}{row.nome} <span class="text-xs text-muted-foreground">{row.partido}</span>{/if}
            </td>
            <td class="py-1 text-right font-semibold">{row.votos}</td>
          </tr>
        {/each}
        {#each cargo.legendas as row (row.numero)}
          <tr>
            <td class="py-1">{row.numero}</td>
            <td class="py-1 font-sans">
              {m.results_legenda()}
              {#if row.partido}<span class="text-xs text-muted-foreground">{row.partido}</span>{/if}
            </td>
            <td class="py-1 text-right font-semibold">{row.votos}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot class="border-t-2 border-border">
        {#each [[m.results_brancos(), cargo.brancos], [m.results_nulos(), cargo.nulos], [m.results_total(), cargo.total]] as [label, votos] (label)}
          <tr>
            <th scope="row" colspan="2" class="py-1 text-left font-normal">{label}</th>
            <td class="py-1 text-right font-mono font-semibold">{votos}</td>
          </tr>
        {/each}
      </tfoot>
    </table>
  {/each}
  {#if geradoEm}
    <p class="text-xs text-muted-foreground">{m.results_names_source({ date: geradoEm })}</p>
  {/if}
</section>
