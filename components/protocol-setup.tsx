"use client";

import { useState, useTransition } from "react";
import type { Rule } from "@/lib/types";
import { parseAction, screenAction } from "@/app/actions";
import { structuredForm, readingForm } from "@/lib/display";
import { EXAMPLE_CRITERIA, EXAMPLE_TRIAL } from "@/lib/protocol";
import { applyReading } from "@/lib/parse-readings";

type Parsed = { trialName: string; rules: Rule[]; parsedBy: "ai" | "local"; notice?: string };

export function ProtocolSetup({ cohortSize }: { cohortSize: number }) {
  const [trialName, setTrialName] = useState("");
  const [criteria, setCriteria] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();
  const [screening, startScreen] = useTransition();

  function runParse() {
    setError(null);
    startParse(async () => {
      try {
        setParsed(await parseAction(criteria));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read those criteria.");
      }
    });
  }

  function update(id: string, patch: Partial<Rule>) {
    setParsed((p) =>
      p ? { ...p, rules: p.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : p,
    );
  }

  const enabled = parsed?.rules.filter((r) => r.enabled).length ?? 0;
  const manual = (parsed?.rules.length ?? 0) - enabled;
  const conflicts = parsed?.rules.filter((r) => r.disagreement).length ?? 0;

  function choose(id: string, chosen: "ai" | "local") {
    setParsed((p) =>
      p ? { ...p, rules: p.rules.map((r) => (r.id === id ? applyReading(r, chosen) : r)) } : p,
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Input: the protocol as it was written */}
      <section>
        <h1 className="text-[28px] font-semibold tracking-tight">Screen a cohort</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-muted">
          Paste the eligibility criteria. They are converted into a checklist you approve
          before any patient is evaluated.
        </p>

        <label className="mt-6 block">
          <span className="text-[13px] font-medium text-ink-muted">Study name</span>
          <input
            value={trialName}
            onChange={(e) => setTrialName(e.target.value)}
            placeholder="ADVANCE-T2D"
            className="mt-1.5 h-11 w-full rounded-lg border border-rule bg-surface px-3 text-[15px] outline-none placeholder:text-ink-faint focus:border-accent"
          />
        </label>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="criteria" className="text-[13px] font-medium text-ink-muted">
              Eligibility criteria
            </label>
            <button
              type="button"
              onClick={() => {
                setTrialName(EXAMPLE_TRIAL);
                setCriteria(EXAMPLE_CRITERIA);
                setParsed(null);
              }}
              className="text-[13px] font-medium text-accent underline-offset-4 hover:underline"
            >
              Use the {EXAMPLE_TRIAL} example
            </button>
          </div>
          <textarea
            id="criteria"
            value={criteria}
            onChange={(e) => {
              setCriteria(e.target.value);
              setParsed(null);
            }}
            rows={18}
            placeholder={"Inclusion criteria\n1. Age between 40 and 65 years.\n2. …"}
            className="mt-1.5 w-full resize-y rounded-lg border border-rule bg-surface p-4 text-[14px] leading-relaxed outline-none placeholder:text-ink-faint focus:border-accent"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-fail-wash px-3 py-2 text-[14px] text-fail">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={runParse}
          disabled={parsing || !criteria.trim()}
          className="mt-4 h-11 rounded-md bg-accent px-6 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {parsing ? "Reading the protocol…" : "Read the criteria"}
        </button>
      </section>

      {/* Output: the checklist a human signs off */}
      <section aria-live="polite">
        {!parsed ? (
          <EmptyChecklist />
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[20px] font-semibold tracking-tight">
                {parsed.rules.length} criteria found
              </h2>
              <span className="text-[13px] text-ink-muted">
                {parsed.parsedBy === "ai" ? "Parsed by Workers AI" : "Parsed by the local parser"}
              </span>
            </div>
            <p className="mt-1.5 text-[14px] text-ink-muted">
              Check each translation. Turn off anything you would rather verify by hand.
            </p>

            {parsed.notice && (
              <p className="mt-4 rounded-md border border-flag/30 bg-flag-wash px-3 py-2.5 text-[13px] leading-relaxed text-flag">
                {parsed.notice}
              </p>
            )}

            <ol className="mt-5 max-h-[min(58vh,640px)] divide-y divide-rule overflow-y-auto overscroll-contain rounded-lg border border-rule bg-surface">
              {parsed.rules.map((rule, i) => (
                <li
                  key={rule.id}
                  className={
                    rule.disagreement ? "bg-flag-wash/60" : rule.enabled ? "" : "bg-flag-wash/40"
                  }
                >
                  <div className="flex flex-wrap gap-3 p-4 sm:flex-nowrap">
                    <span className="id mt-0.5 w-5 shrink-0 text-ink-faint">{i + 1}</span>

                    <div className="min-w-0 flex-1">
                      <p className={`text-[15px] font-medium ${rule.enabled ? "" : "text-ink-muted"}`}>
                        {rule.label}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        <span className="text-ink-faint">from</span> &ldquo;{rule.sourceText}&rdquo;
                      </p>

                      {rule.field === "unmapped" ? (
                        <p className="mt-2 text-[13px] text-flag">
                          No structured field matches this. It will be listed on the report for
                          manual verification.
                        </p>
                      ) : (
                        <p className="id mt-2 inline-block rounded bg-paper px-1.5 py-0.5 text-ink-muted">
                          {structuredForm(rule)}
                        </p>
                      )}

                      {rule.disagreement && (
                        <div className="mt-3 rounded-md border border-flag/35 bg-surface p-3">
                          <p className="text-[13px] font-medium text-flag">
                            Read two different ways
                          </p>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                            These imply different cohorts, so the choice is yours, not the
                            software&rsquo;s.
                          </p>
                          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                            {(["local", "ai"] as const).map((which) => {
                              const reading = rule.disagreement![which];
                              const active = rule.disagreement!.chosen === which;
                              return (
                                <button
                                  key={which}
                                  type="button"
                                  onClick={() => choose(rule.id, which)}
                                  aria-pressed={active}
                                  className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                                    active
                                      ? "border-accent bg-accent-wash"
                                      : "border-rule hover:border-rule-strong"
                                  }`}
                                >
                                  <span className="block text-[12px] font-medium text-ink-muted">
                                    {which === "local" ? "Rule parser" : "Workers AI"}
                                  </span>
                                  <span className="id mt-1 block text-ink">
                                    {readingForm(reading)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                      <SeverityToggle rule={rule} onChange={(severity) => update(rule.id, { severity })} />
                      <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => update(rule.id, { enabled: e.target.checked })}
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                        />
                        Screen on this
                      </label>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={screening || enabled === 0}
                onClick={() =>
                  startScreen(async () => {
                    await screenAction({
                      trialName: trialName.trim() || parsed.trialName,
                      criteriaText: criteria,
                      rules: parsed.rules,
                      parsedBy: parsed.parsedBy,
                    });
                  })
                }
                className="h-11 rounded-md bg-accent px-6 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                {screening ? "Screening…" : `Screen ${cohortSize} patients`}
              </button>
              <p className="text-[13px] text-ink-muted">
                {enabled} criteria evaluated automatically
                {manual > 0 && `, ${manual} left for manual review`}
                {conflicts > 0 && `, ${conflicts} read two ways`}.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SeverityToggle({
  rule,
  onChange,
}: {
  rule: Rule;
  onChange: (severity: "hard" | "review") => void;
}) {
  const options = [
    { value: "hard" as const, label: "Excludes", hint: "Failing this rules the patient out" },
    { value: "review" as const, label: "Flags", hint: "Failing this raises it with a clinician" },
  ];
  return (
    <div className="flex rounded-md border border-rule p-0.5" role="group" aria-label="Severity">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.hint}
          disabled={rule.field === "unmapped"}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-1 text-[12px] font-medium transition-colors disabled:opacity-40 ${
            rule.severity === o.value ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmptyChecklist() {
  return (
    <div className="flex h-full min-h-[320px] flex-col justify-center rounded-lg border border-dashed border-rule-strong p-8 text-center">
      <p className="text-[15px] font-medium">Your checklist appears here</p>
      <p className="mx-auto mt-2 max-w-[42ch] text-[14px] leading-relaxed text-ink-muted">
        Each criterion is restated in plain language next to the exact phrase it came from, so you
        can confirm the translation before anyone is screened.
      </p>
    </div>
  );
}
