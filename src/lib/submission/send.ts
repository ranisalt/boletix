import type { Bu, BuSubmission, SubmitStatus } from "../bu";
import { recordContribution, type Contribution } from "../contributions";
import { m } from "../paraglide/messages.js";
import type { Tone } from "../ui";
import { buErrorMessage, isBuErrorCode } from "./error-messages";

/** What the user is told after sending a boletim. */
export type Outcome = {
  tone: Tone;
  title: string;
  message: string;
  /** Only transient failures can succeed by sending the same boletim again. */
  retry: boolean;
};

type Accepted = Omit<Outcome, "retry"> & { remember?: Contribution["status"] };

const STATUS_OUTCOMES: Record<SubmitStatus, () => Accepted> = {
  new: () => ({
    tone: "success",
    title: m.submit_new_title(),
    message: m.submit_new(),
    remember: "aceito",
  }),
  duplicate: () => ({
    tone: "info",
    title: m.submit_duplicate_title(),
    message: m.submit_duplicate(),
  }),
  conflict: () => ({
    tone: "warning",
    title: m.submit_conflict_title(),
    message: m.submit_conflict(),
    remember: "conflito",
  }),
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

/**
 * Posts a verified boletim and remembers it on this device when the server keeps it. Never throws:
 * every failure becomes an Outcome.
 */
export async function sendBoletim(
  { bu, submission }: { bu: Bu; submission: BuSubmission },
  { page, storage }: { page: string; storage: Storage },
): Promise<Outcome> {
  let response: Response;
  try {
    // Inside the try so a bad page URL is reported like any network failure.
    response = await fetch(new URL("/api/submissions", page), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(submission),
    });
  } catch {
    return {
      tone: "destructive",
      title: m.submit_failed_title(),
      message: m.submit_network_error(),
      retry: true,
    };
  }
  const body = (await response.json().catch(() => ({}))) as { status?: string; error?: string };
  if (!body.status || !Object.hasOwn(STATUS_OUTCOMES, body.status))
    return failure(body.error ?? "");

  const { remember, ...outcome } = STATUS_OUTCOMES[body.status as SubmitStatus]();
  if (remember) {
    const { uf, municipio, zona, secao, urna } = bu.header;
    try {
      recordContribution(
        {
          id: submission.hash,
          uf,
          municipio,
          zona,
          secao,
          urna,
          enviadoEm: new Date().toISOString(),
          status: remember,
        },
        storage,
      );
    } catch {
      // Full or disabled storage only loses the local history; the server already has the boletim.
    }
  }
  return { ...outcome, retry: false };
}
