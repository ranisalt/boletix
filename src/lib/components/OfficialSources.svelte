<script lang="ts" module>
  import { m } from '../paraglide/messages.js';

  export const OFFICIAL_SOURCES = [
    { label: m.source_results, href: 'https://resultados.tse.jus.br' },
    { label: m.source_tse, href: 'https://www.tse.jus.br' },
    { label: m.source_open_data, href: 'https://dadosabertos.tse.jus.br' },
    {
      label: m.source_bu,
      href: 'https://www.tse.jus.br/comunicacao/noticias/2022/Outubro/voce-ja-ouviu-falar-do-boletim-de-urna-mas-sabe-o-que-ele-e-tire-suas-duvidas'
    }
  ];
</script>

<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<ul class={className}>
  {#each OFFICIAL_SOURCES as source (source.href)}
    <li>
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external, official TSE sites -->
      <a href={source.href} target="_blank" rel="noreferrer" class="font-medium text-primary underline underline-offset-4">{source.label()}</a>
    </li>
  {/each}
</ul>
