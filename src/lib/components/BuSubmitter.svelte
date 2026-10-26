<script lang="ts">
  import { buErrorMessage } from '../client/error-messages';
  import { ScanSession, type ScanResult } from '../client/scan-session.svelte';
  import { m } from '../paraglide/messages.js';
  import QrCamera from './QrCamera.svelte';

  interface Props {
    session?: ScanSession;
  }

  let { session = new ScanSession() }: Props = $props();

  type SubmitState =
    | { phase: 'idle' }
    | { phase: 'sending' }
    | { phase: 'done'; message: string }
    | { phase: 'failed'; message: string };

  let lastScan: ScanResult | undefined = $state.raw();
  let submit: SubmitState = $state.raw({ phase: 'idle' });

  const verification = $derived(session.complete ? session.verify() : undefined);

  function onscan(text: string) {
    const result = session.add(text);
    // The camera sees the same QRs every frame; only report what changed.
    if (result.status !== 'repeated') lastScan = result;
  }

  function scanFeedback(result: ScanResult): string {
    if (result.status === 'rejected') return buErrorMessage(result.error);
    return result.kind === 'bu' ? m.scan_added_bu(result) : m.scan_added_cert(result);
  }

  const OUTCOME_MESSAGES: Record<string, () => string> = {
    new: m.submit_new,
    duplicate: m.submit_duplicate,
    conflict: m.submit_conflict
  };

  async function send() {
    if (!verification?.ok) return;
    submit = { phase: 'sending' };
    let response: Response;
    try {
      response = await fetch(new URL('/api/submissions', location.href), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(verification.submission)
      });
    } catch {
      submit = { phase: 'failed', message: m.submit_network_error() };
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { status?: string; error?: string };
    const outcome = body.status && OUTCOME_MESSAGES[body.status];
    submit = outcome
      ? { phase: 'done', message: outcome() }
      : { phase: 'failed', message: buErrorMessage(body.error ?? '') };
  }

  function reset() {
    session.reset();
    lastScan = undefined;
    submit = { phase: 'idle' };
  }
</script>

<section aria-labelledby="submit-title">
  <h1 id="submit-title">{m.submit_title()}</h1>
  <p>{m.submit_intro()}</p>

  <QrCamera {onscan} active={!session.complete} />
  <p role="status">{lastScan ? scanFeedback(lastScan) : ''}</p>

  <h2 id="bu-slots">{m.bu_section()}</h2>
  {#if session.bu.length === 0}
    <p>{m.bu_waiting()}</p>
  {:else}
    <ul aria-labelledby="bu-slots">
      {#each session.bu as part, i (i)}
        <li data-state={part ? 'read' : 'pending'}>
          {m.bu_part({ index: i + 1, total: session.bu.length })}: {part ? m.slot_read() : m.slot_pending()}
        </li>
      {/each}
    </ul>
  {/if}

  <h2 id="cert-slots">{m.cert_section()}</h2>
  <ul aria-labelledby="cert-slots">
    {#each session.certs as cert, i (i)}
      <li data-state={cert ? 'read' : 'pending'}>
        {m.cert_part({ index: i + 1, total: session.certs.length })}: {cert ? m.slot_read() : m.slot_pending()}
      </li>
    {/each}
  </ul>

  {#if verification?.ok}
    {@const { header } = verification.bu}
    <p>{m.verify_ok({ urna: header.urna })}</p>
    <p>{m.bu_summary(header)}</p>
    {#if submit.phase === 'done'}
      <p role="status">{submit.message}</p>
      <button type="button" onclick={reset}>{m.scan_another()}</button>
    {:else}
      {#if submit.phase === 'failed'}<p role="alert">{submit.message}</p>{/if}
      <button type="button" onclick={send} disabled={submit.phase === 'sending'}>
        {submit.phase === 'sending' ? m.submitting() : m.submit_button()}
      </button>
    {/if}
  {:else if verification}
    <p role="alert">{buErrorMessage(verification.error)}</p>
    <button type="button" onclick={reset}>{m.start_over()}</button>
  {/if}
</section>
