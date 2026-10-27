<script lang="ts">
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";

  import { m } from "../paraglide/messages.js";
  import { StatusBadge, type Tone } from "../ui";
  import { listContributions, type Contribution } from "./store";

  // The history lives only in this browser's storage, so it is read after hydration.
  let contributions: Contribution[] | undefined = $state.raw();
  onMount(() => {
    contributions = listContributions();
  });

  const STATUS: Record<Contribution["status"], { tone: Tone; label: () => string }> = {
    aceito: { tone: "success", label: m.status_accepted },
    conflito: { tone: "warning", label: m.status_conflict },
  };
</script>

{#if contributions?.length === 0}
  <p>
    {m.contributions_empty()}
    <a href={resolve("/enviar")} class="font-semibold text-primary underline"
      >{m.contributions_empty_link()}</a
    >
  </p>
{/if}
<ul class="space-y-3">
  {#each contributions as contribution (contribution.id)}
    {@const status = STATUS[contribution.status]}
    <li class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
      <div>
        <p class="font-semibold">{m.contribution_place(contribution)}</p>
        <p class="text-sm text-muted-foreground tabular-nums">
          {m.contribution_section(contribution)}
        </p>
        <p class="text-xs text-muted-foreground">
          {new Date(contribution.enviadoEm).toLocaleString("pt-BR")}
        </p>
      </div>
      <StatusBadge tone={status.tone}>{status.label()}</StatusBadge>
    </li>
  {/each}
</ul>
