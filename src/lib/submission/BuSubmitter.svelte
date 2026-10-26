<script lang="ts">
  import { resolve } from "$app/paths";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Send from "@lucide/svelte/icons/send";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import { recordContribution } from "../contributions";
  import { nameFileKeys, resultsView, type NameFile } from "../elections";
  import { m } from "../paraglide/messages.js";
  import { ScanSession, type ScanResult, QrCamera, ScanSlot } from "../scan";
  import { StatusBox, type Tone } from "../ui";
  import BuResults from "./BuResults.svelte";
  import { buErrorMessage, isBuErrorCode } from "./error-messages";
  import { loadNameFiles } from "./name-files";

  interface Props {
    session?: ScanSession;
  }

  const { session = new ScanSession() }: Props = $props();

  interface Outcome {
    tone: Tone;
    title: string;
    message: string;
    /** Only transient failures can succeed by sending the same boletim again. */
    retry: boolean;
  }

  type SubmitState = { phase: "idle" } | { phase: "sending" } | { phase: "done"; outcome: Outcome };

  let lastScan: ScanResult | undefined = $state.raw();
  let submit: SubmitState = $state.raw({ phase: "idle" });

  const verification = $derived(session.complete ? session.verify() : undefined);

  let names: NameFile[] = $state.raw([]);
  $effect(() => {
    if (!verification?.ok) return;
    let current = true;
    loadNameFiles(nameFileKeys(verification.bu)).then((files) => {
      if (current) names = files;
    });
    return () => {
      current = false;
      names = [];
    };
  });

  function onscan(text: string) {
    const result = session.add(text);
    // The camera sees the same QRs every frame; only report what changed.
    if (result.status !== "repeated") lastScan = result;
  }

  function scanFeedback(result: ScanResult): string {
    if (result.status === "rejected") return buErrorMessage(result.error);
    return result.kind === "bu" ? m.scan_added_bu(result) : m.scan_added_cert(result);
  }

  const ACCEPTED: Record<string, Omit<Outcome, "retry"> & { remember?: "aceito" | "conflito" }> = {
    new: {
      tone: "success",
      title: m.submit_new_title(),
      message: m.submit_new(),
      remember: "aceito",
    },
    duplicate: { tone: "info", title: m.submit_duplicate_title(), message: m.submit_duplicate() },
    conflict: {
      tone: "warning",
      title: m.submit_conflict_title(),
      message: m.submit_conflict(),
      remember: "conflito",
    },
  };

  function failure(error: string): Outcome {
    const message = buErrorMessage(error);
    if (error === "RATE_LIMITED")
      return { tone: "warning", title: m.submit_rate_limited_title(), message, retry: true };
    if (!isBuErrorCode(error))
      return { tone: "destructive", title: m.submit_failed_title(), message, retry: true };
    const title =
      error === "SIGNATURE_INVALID" ? m.submit_signature_title() : m.submit_rejected_title();
    return { tone: "destructive", title, message, retry: false };
  }

  async function send() {
    if (!verification?.ok) return;
    const { bu, submission } = verification;
    submit = { phase: "sending" };
    let response: Response;
    try {
      response = await fetch(new URL("/api/submissions", location.href), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
      });
    } catch {
      submit = {
        phase: "done",
        outcome: {
          tone: "destructive",
          title: m.submit_failed_title(),
          message: m.submit_network_error(),
          retry: true,
        },
      };
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { status?: string; error?: string };
    const accepted = body.status ? ACCEPTED[body.status] : undefined;
    if (!accepted) {
      submit = { phase: "done", outcome: failure(body.error ?? "") };
      return;
    }
    if (accepted.remember) {
      const { uf, municipio, zona, secao, urna } = bu.header;
      recordContribution({
        id: submission.hash,
        uf,
        municipio,
        zona,
        secao,
        urna,
        enviadoEm: new Date().toISOString(),
        status: accepted.remember,
      });
    }
    submit = { phase: "done", outcome: { ...accepted, retry: false } };
  }

  function reset() {
    session.reset();
    lastScan = undefined;
    submit = { phase: "idle" };
  }
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">{m.submit_title()}</h1>
  <p role="status" class="sr-only">{lastScan ? scanFeedback(lastScan) : ""}</p>

  {#if submit.phase === "done"}
    {@const { outcome } = submit}
    <div class="space-y-4">
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
        <a href={resolve("/contribuicoes")} class="btn border-2 border-input"
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
          {@const { header } = verification.bu}
          {@const municipio = resultsView(verification.bu, names).municipio}
          {@const fields = [
            [m.field_uf(), header.uf],
            [
              m.field_municipio(),
              municipio ? `${header.municipio} – ${municipio}` : header.municipio,
            ],
            [m.field_zona(), header.zona],
            [m.field_secao(), header.secao],
            [m.field_urna(), header.urna],
          ]}
          <section class="space-y-4 rounded-lg border-2 border-success bg-card p-4">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border-2 border-success px-2.5 py-1 text-sm font-semibold text-success"
            >
              <ShieldCheck class="size-4" aria-hidden="true" />
              {m.verify_ok()}
            </span>
            <dl class="grid grid-cols-2 gap-3 font-mono text-sm">
              {#each fields as [term, value] (term)}
                <div>
                  <dt class="font-sans text-xs text-muted-foreground">{term}</dt>
                  <dd class="font-semibold">{value}</dd>
                </div>
              {/each}
            </dl>
            <BuResults bu={verification.bu} {names} />
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
