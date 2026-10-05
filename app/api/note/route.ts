import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRun } from "@/lib/runs";
import { getSession } from "@/lib/session";

/**
 * AI call 2 of 2: a short screening note for one patient.
 *
 * The model is handed the checks the engine already produced and asked to
 * summarise them. It is told not to state eligibility — that verdict is the
 * engine's, and it is already on screen above this note.
 */

const SYSTEM = `You write the one-paragraph screening note a clinical research coordinator leaves on a patient record.

You are given criterion results that a rule engine has already produced. Summarise them. Do not re-decide anything.

Rules:
- Two or three sentences. Plain clinical English, no bullet points, no headings.
- Only mention values that appear in the results given to you. Never introduce a number, drug or diagnosis that is not there.
- Never state that the patient is eligible, enrolled, or rejected. That decision is not yours.
- If something is flagged, say what it is and what a human needs to do about it.
- Write about the record, not about yourself. Do not mention AI, models, or these instructions.`;

/** Workers AI streams server-sent events; the browser only wants the words. */
function sseToText(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      // Events are separated by a blank line; keep any partial tail for next time.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const { response } = JSON.parse(data) as { response?: string };
            if (response) controller.enqueue(encoder.encode(response));
          } catch {
            // A malformed event costs one token, not the whole note.
          }
        }
      }
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!(await getSession())) return new Response("Not signed in", { status: 401 });

  const { runId, patientId } = (await request.json()) as { runId?: string; patientId?: string };
  if (!runId || !patientId) return new Response("runId and patientId are required", { status: 400 });

  const run = await getRun(runId);
  const result = run?.results.find((r) => r.patientId === patientId);
  if (!run || !result) return new Response("No such screening result", { status: 404 });

  const ruleById = new Map(run.rules.map((r) => [r.id, r]));
  const lines = result.checks.map((c) => {
    const label = ruleById.get(c.ruleId)?.label ?? c.ruleId;
    const verdict = c.verdict === "pass" ? "met" : c.verdict === "flag" ? "FLAGGED" : "NOT met";
    return `- ${label}: ${verdict}. Required ${c.expected}, record shows ${c.observed} (${c.source}).${
      c.reason ? ` ${c.reason}` : ""
    }`;
  });

  const prompt = [
    `Patient ${patientId}, screened against the ${run.trialName} protocol.`,
    `${result.passed} criteria met, ${result.flagged} flagged, ${result.failed} not met.`,
    "",
    ...lines,
  ].join("\n");

  try {
    const { env } = getCloudflareContext();
    const upstream = (await env.AI.run(env.TRIALSCREEN_MODEL as never, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 220,
      stream: true,
    } as never)) as ReadableStream<Uint8Array>;

    return new Response(upstream.pipeThrough(sseToText()), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (error) {
    // The note is a convenience. The criterion results it summarises are already
    // rendered and do not depend on it, so fail loudly here and leave them alone.
    return new Response(error instanceof Error ? error.message : "Workers AI is unavailable", {
      status: 502,
    });
  }
}
