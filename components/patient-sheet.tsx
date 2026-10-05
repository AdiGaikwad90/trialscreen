"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Decision, Result, ReviewDecision, Rule } from "@/lib/types";
import { VerdictMark, StatusTag, verdictWord } from "./verdict";
import { decideAction } from "@/app/actions";
import { formatRunTime } from "@/lib/display";

export interface PatientRef {
  id: string;
  age: number;
  sex: "F" | "M";
  lastVisit: string;
}

/**
 * The ledger for one patient: the same criteria, in the same order as the rail,
 * each filled in with what the record actually said and where it came from.
 * A failed patient opens the identical view — "why not eligible" is not a
 * different screen.
 */
export function PatientSheet({
  runId,
  result,
  patient,
  rules,
  decision,
  onClose,
}: {
  runId: string;
  result: Result;
  patient: PatientRef;
  rules: Rule[];
  decision: ReviewDecision | null;
  onClose: () => void;
}) {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const manual = rules.filter((r) => !r.enabled);

  return (
    <aside
      aria-label={`Screening detail for ${patient.id}`}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[560px] flex-col border-l border-rule bg-surface shadow-[-8px_0_32px_rgba(23,26,25,0.08)]"
    >
      <header className="flex items-start gap-4 border-b border-rule px-6 py-5">
        <div className="min-w-0 flex-1">
          <p className="id text-ink-muted">{patient.id}</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight">
            {patient.age} years, {patient.sex === "F" ? "female" : "male"}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted">Last seen {patient.lastVisit}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="rounded-md px-2.5 py-1.5 text-[14px] text-ink-muted hover:bg-paper hover:text-ink"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-rule px-6 py-5">
          <div className="flex items-center gap-3">
            <StatusTag status={result.status} />
            <span className="text-[22px] font-semibold tabular-nums">{result.score}</span>
            <span className="text-[13px] text-ink-muted">match score</span>
          </div>
          {/* The arithmetic, in full. Nothing here is a model output. */}
          <p className="id mt-3 rounded-md bg-paper px-3 py-2 text-ink-muted">
            ({result.passed} passed + 0.5 × {result.flagged} flagged) ÷ {result.checks.length} ={" "}
            {result.score}
          </p>
        </div>

        {/* Keyed on the patient so switching rows remounts with fresh state
            rather than resetting it inside an effect. */}
        <ScreeningNote key={patient.id} runId={runId} patientId={patient.id} />

        <ReviewDecisionPanel
          key={`decision-${patient.id}`}
          runId={runId}
          patientId={patient.id}
          status={result.status}
          decision={decision}
        />

        <ol className="divide-y divide-rule">
          {result.checks.map((check) => {
            const rule = ruleById.get(check.ruleId);
            return (
              <li key={check.ruleId} className="px-6 py-4">
                <div className="flex gap-3">
                  <VerdictMark verdict={check.verdict} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[15px] font-medium">{rule?.label ?? check.ruleId}</p>
                      <span className="sr-only">{verdictWord(check.verdict)}</span>
                      <p className="shrink-0 text-[13px] text-ink-muted">{check.expected}</p>
                    </div>

                    <p className="mt-1.5 text-[14px]">
                      <span className="text-ink-muted">observed</span>{" "}
                      <span className="font-medium tabular-nums">{check.observed}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-faint">{check.source}</p>

                    {check.reason && (
                      <p
                        className={`mt-2 rounded-md px-2.5 py-1.5 text-[13px] leading-relaxed ${
                          check.verdict === "fail" ? "bg-fail-wash text-fail" : "bg-flag-wash text-flag"
                        }`}
                      >
                        {check.reason}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {manual.length > 0 && (
          <div className="border-t border-rule bg-paper px-6 py-4">
            <p className="text-[13px] font-medium text-ink-muted">Verify by hand</p>
            <ul className="mt-2 space-y-1.5">
              {manual.map((r) => (
                <li key={r.id} className="text-[13px] leading-relaxed text-ink-muted">
                  “{r.sourceText}”
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}

/** AI call 2 of 2: a short note written from the checks above — never a verdict. */
function ScreeningNote({ runId, patientId }: { runId: string; patientId: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/note", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId, patientId }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(await res.text());

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        // Accumulate locally and assign the whole value, rather than appending to
        // state: two overlapping streams then overwrite each other instead of
        // interleaving into one garbled paragraph.
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) return;
          acc += decoder.decode(value, { stream: true });
          setText(acc);
        }
        if (!controller.signal.aborted) setState("done");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    })();

    return () => controller.abort();
  }, [runId, patientId]);

  return (
    <div className="border-b border-rule bg-accent-wash/50 px-6 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-[13px] font-medium text-accent">Screening note</p>
        <p className="text-[12px] text-ink-muted">
          Written by Workers AI from the results below
        </p>
      </div>
      {state === "error" ? (
        <p className="mt-1.5 text-[14px] text-ink-muted">
          The note could not be written. The criterion results below are unaffected — they come
          from the rule engine, not the model.
        </p>
      ) : (
        <p className="mt-1.5 text-[14px] leading-relaxed">
          {text}
          {state === "loading" && (
            <span aria-hidden className="ml-0.5 inline-block h-[15px] w-[2px] translate-y-[2px] animate-pulse bg-accent" />
          )}
        </p>
      )}
    </div>
  );
}

const OPTIONS: { value: Decision; label: string; hint: string; cls: string }[] = [
  {
    value: "accepted",
    label: "Accept for screening",
    hint: "The flag is resolved; move this patient to Eligible.",
    cls: "border-pass text-pass bg-pass-wash",
  },
  {
    value: "more_info",
    label: "Need more information",
    hint: "Keep in review until the missing detail arrives.",
    cls: "border-flag text-flag bg-flag-wash",
  },
  {
    value: "excluded",
    label: "Exclude",
    hint: "The flag stands; this patient is not eligible.",
    cls: "border-fail text-fail bg-fail-wash",
  },
];

/**
 * The human's call on a flagged patient. It overrides the bucket, never the
 * evidence: the criterion ledger above is untouched, so the reason the patient
 * was raised in the first place stays on the record, and the decision is
 * recorded against a name and a time.
 */
function ReviewDecisionPanel({
  runId,
  patientId,
  status,
  decision,
}: {
  runId: string;
  patientId: string;
  status: Result["status"];
  decision: ReviewDecision | null;
}) {
  const [choice, setChoice] = useState<Decision | null>(decision?.decision ?? null);
  const [note, setNote] = useState(decision?.note ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Nothing to decide on a patient the engine never raised.
  if (status !== "review" && !decision) return null;

  function submit(value: Decision | null) {
    setError(null);
    setChoice(value);
    start(async () => {
      try {
        await decideAction({ runId, patientId, decision: value, note });
      } catch (e) {
        setError(e instanceof Error ? e.message : "The decision could not be saved.");
      }
    });
  }

  return (
    <div className="border-b border-rule px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[14px] font-semibold">Your decision</h3>
        {pending && <span className="text-[12px] text-ink-muted">Saving…</span>}
      </div>

      <div className="mt-3 grid gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => submit(choice === o.value ? null : o.value)}
            aria-pressed={choice === o.value}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              choice === o.value ? o.cls : "border-rule bg-surface hover:border-rule-strong"
            }`}
          >
            <span className="block text-[14px] font-medium">{o.label}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{o.hint}</span>
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="text-[12.5px] font-medium text-ink-muted">
          Note for the record <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => choice && submit(choice)}
          rows={2}
          maxLength={500}
          placeholder="e.g. Cardiology confirmed warfarin can be held for the washout period."
          className="mt-1.5 w-full resize-y rounded-md border border-rule bg-surface p-2.5 text-[13.5px] leading-relaxed outline-none placeholder:text-ink-faint focus:border-accent"
        />
      </label>

      {error && (
        <p role="alert" className="mt-2 rounded-md bg-fail-wash px-2.5 py-1.5 text-[13px] text-fail">
          {error}
        </p>
      )}

      {decision && (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          Recorded by {decision.decidedByName} on {formatRunTime(decision.decidedAt)}.{" "}
          <button
            type="button"
            onClick={() => {
              setNote("");
              submit(null);
            }}
            className="text-accent underline-offset-4 hover:underline"
          >
            Clear decision
          </button>
        </p>
      )}
    </div>
  );
}
