<script lang="ts">
  import { resolve } from "$app/paths";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Send from "@lucide/svelte/icons/send";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import type { Bu } from "../bu";
  import { nameFileKeys, resultsView, type NameFile } from "../elections";
  import { m } from "../paraglide/messages.js";
  import { ScanSession, type ScanResult, QrCamera, ScanSlot } from "../scan";
  import { StatusBox } from "../ui";
  import BuResults from "./BuResults.svelte";
  import { buErrorMessage } from "./error-messages";
  import { loadNameFiles } from "./name-files";
  import { sendBoletim, type Outcome } from "./send";

  type Props = {
    session?: ScanSession;
  };

  const { session = new ScanSession() }: Props = $props();

  type SubmitState = { phase: "idle" } | { phase: "sending" } | { phase: "done"; outcome: Outcome };

  let lastScan: ScanResult | undefined = $state.raw();
  let submit: SubmitState = $state.raw({ phase: "idle" });

  const verification = $derived(session.complete ? session.verify() : undefined);

  function onscan(text: string) {
    const result = session.add(text);
    // The camera sees the same QRs every frame; only report what changed.
    if (result.status !== "repeated") lastScan = result;
  }

  function scanFeedback(result: ScanResult): string {
    if (result.status === "rejected") return buErrorMessage(result.error);
    return result.kind === "bu" ? m.scan_added_bu(result) : m.scan_added_cert(result);
  }

  async function send() {
    if (!verification?.ok) return;
    submit = { phase: "sending" };
    const outcome = await sendBoletim(verification, { page: location.href, storage: localStorage });
    submit = { phase: "done", outcome };
  }

  function reset() {
    session.reset();
    lastScan = undefined;
    submit = { phase: "idle" };
  }
</script>

{#snippet details(bu: Bu, names: NameFile[])}
  {@const { header } = bu}
  {@const municipio = resultsView(bu, names).municipio}
  {@const fields = [
    [m.field_uf(), header.uf],
    [
      m.field_municipio(),
      municipio ? m.municipio_named({ code: header.municipio, name: municipio }) : header.municipio,
    ],
    [m.field_zona(), header.zona],
    [m.field_secao(), header.secao],
    [m.field_urna(), header.urna],
  ]}
  <dl class="grid grid-cols-2 gap-3 text-sm tabular-nums">
    {#each fields as [term, value] (term)}
      <div>
        <dt class="font-sans text-xs text-muted-foreground">{term}</dt>
        <dd class="font-semibold">{value}</dd>
      </div>
    {/each}
  </dl>
  <BuResults {bu} {names} />
{/snippet}

<div class="space-y-6">
  <h1 class="text-3xl font-bold">{m.submit_title()}</h1>
  <!-- Visible too: a rejected scan has no other on-screen cue on a phone. -->
  <p role="status" class="text-sm text-muted-foreground">
    {lastScan ? scanFeedback(lastScan) : ""}
  </p>

  {#if submit.phase === "done"}
    {@const { outcome } = submit}
    <!-- Sending removes the focused button; move focus here so it doesn't drop to the page. -->
    <div class="space-y-4 outline-none" tabindex="-1" {@attach (el) => el.focus()}>
      <StatusBox tone={outcome.tone} title={outcome.title}>{outcome.message}</StatusBox>
      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn bg-primary text-primary-foreground" onclick={reset}>
          <RotateCcw class="size-5" aria-hidden="true" />
          {m.scan_another()}
        </button>
        {#if outcome.retry}
          <button
            type="button"
            class="btn border-2 border-input"
            onclick={() => (submit = { phase: "idle" })}>{m.retry()}</button
          >
        {/if}
        <a href="{resolve('/totais')}#minhas-contribuicoes" class="btn border-2 border-input"
          >{m.nav_contributions()}</a
        >
      </div>
    </div>
  {:else}
    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-3">
        <QrCamera {onscan} active={!session.complete} />
      </div>

      <div class="space-y-5">
        <section>
          <h2 id="bu-slots" class="mb-2 font-semibold">{m.bu_section()}</h2>
          {#if session.bu.length === 0}
            <p class="rounded-md border-2 border-dashed p-4 text-sm text-muted-foreground">
              {m.bu_waiting()}
            </p>
          {:else}
            <ul class="space-y-2" aria-labelledby="bu-slots">
              {#each session.bu as part, i (i)}
                <ScanSlot
                  label={m.bu_part({ index: i + 1, total: session.bu.length })}
                  done={part !== undefined}
                />
              {/each}
            </ul>
          {/if}
        </section>

        <section>
          <h2 id="cert-slots" class="mb-2 font-semibold">{m.cert_section()}</h2>
          <ul class="space-y-2" aria-labelledby="cert-slots">
            {#each session.certs as cert, i (i)}
              <ScanSlot
                label={m.cert_part({ index: i + 1, total: session.certs.length })}
                done={cert !== undefined}
              />
            {/each}
          </ul>
        </section>

        {#if verification?.ok}
          {@const bu = verification.bu}
          <section class="space-y-4 rounded-lg border-2 border-success bg-card p-4">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border-2 border-success px-2.5 py-1 text-sm font-semibold text-success"
            >
              <ShieldCheck class="size-4" aria-hidden="true" />
              {m.verify_ok()}
            </span>
            <!-- Names are a convenience from TSE open data: sending must not wait for or depend on them. -->
            <svelte:boundary>
              {@render details(bu, await loadNameFiles(nameFileKeys(bu)))}
              {#snippet pending()}
                <p
                  role="status"
                  aria-label={m.names_loading()}
                  class="text-sm text-muted-foreground"
                >
                  {m.names_loading()}
                </p>
              {/snippet}
              {#snippet failed()}
                {@render details(bu, [])}
              {/snippet}
            </svelte:boundary>

            <button
              type="button"
              class="btn w-full bg-primary text-primary-foreground"
              onclick={send}
              disabled={submit.phase === "sending"}
            >
              {#if submit.phase === "sending"}
                <ShieldCheck class="size-5 animate-pulse" aria-hidden="true" />
                {m.submitting()}
              {:else}
                <Send class="size-5" aria-hidden="true" />
                {m.submit_button()}
              {/if}
            </button>
          </section>
        {:else if verification}
          <StatusBox tone="destructive" role="alert" title={m.verify_failed()}
            >{buErrorMessage(verification.error)}</StatusBox
          >
          <button type="button" class="btn border-2 border-input" onclick={reset}>
            <RotateCcw class="size-5" aria-hidden="true" />
            {m.start_over()}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
