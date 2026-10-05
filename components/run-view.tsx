"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Result, ReviewDecision, Rule, Status } from "@/lib/types";
import { ResultsHeader } from "./results-header";
import { PatientSheet, type PatientRef } from "./patient-sheet";
import { StatusTag, DecisionTag } from "./verdict";
import { structuredForm, formatRunTime } from "@/lib/display";

const PAGE_SIZE = 10;

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "eligible", label: "Eligible" },
  { key: "review", label: "Needs review" },
  { key: "excluded", label: "Not eligible" },
];

type SortKey = "rank" | "score" | "age";

export function RunView({
  runId,
  trialName,
  createdAt,
  rules,
  results,
  patients,
  decisions,
  parsedBy,
}: {
  runId: string;
  trialName: string;
  createdAt: string;
  rules: Rule[];
  results: Result[];
  patients: PatientRef[];
  decisions: ReviewDecision[];
  parsedBy: "ai" | "local";
}) {
  const [filter, setFilter] = useState<Status | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSortKey] = useState<SortKey>("rank");
  const [page, setPage] = useState(0);

  // Changing what you are looking at always lands you on the first page, never
  // on an empty one left over from the previous view.
  const changeFilter = (next: Status | null) => {
    setFilter(next);
    setPage(0);
  };
  const setSort = (next: SortKey) => {
    setSortKey(next);
    setPage(0);
  };

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const decisionByPatient = useMemo(
    () => new Map(decisions.map((d) => [d.patientId, d])),
    [decisions],
  );

  const filtered = useMemo(() => {
    const rows = filter ? results.filter((r) => r.status === filter) : results;
    if (sort === "rank") return rows;
    return [...rows].sort((a, b) =>
      sort === "score"
        ? b.score - a.score
        : (patientById.get(b.patientId)?.age ?? 0) - (patientById.get(a.patientId)?.age ?? 0),
    );
  }, [results, filter, sort, patientById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const open = openId ? results.find((r) => r.patientId === openId) : null;
  const enabled = rules.filter((r) => r.enabled);

  return (
    <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[288px_minmax(0,1fr)]">
      {/* The spine: the protocol stays on screen while patients come and go. */}
      <aside className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-96px)] lg:self-start">
        <div className="surface-raised flex max-h-full min-h-0 flex-col">
          <div className="border-b border-rule px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[14px] font-semibold">Criteria</h2>
              <span className="text-[12px] text-ink-muted">
                {enabled.length} of {rules.length}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
              {parsedBy === "ai" ? "Read by Workers AI" : "Read by the local parser"}, evaluated by
              the rule engine.
            </p>
          </div>

          <ol className="min-h-0 flex-1 divide-y divide-rule overflow-y-auto">
            {rules.map((rule, i) => (
              <li key={rule.id} className={`px-4 py-2.5 ${rule.enabled ? "" : "bg-flag-wash/40"}`}>
                <div className="flex gap-2.5">
                  <span className="id mt-0.5 w-4 shrink-0 text-ink-faint">{i + 1}</span>
                  <div className="min-w-0">
                    <p className={`text-[13.5px] leading-snug ${rule.enabled ? "" : "text-ink-muted"}`}>
                      {rule.label}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-faint">
                      {rule.enabled
                        ? `${structuredForm(rule)} · ${rule.severity === "hard" ? "excludes" : "flags"}`
                        : "manual check"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="border-t border-rule p-3">
            <Link
              href={`/api/export/${runId}`}
              prefetch={false}
              className="flex h-10 items-center justify-center rounded-md border border-rule bg-paper text-[14px] font-medium transition-colors hover:border-rule-strong"
            >
              Export screening report
            </Link>
          </div>
        </div>
      </aside>

      <main className="order-1 min-w-0 space-y-5 lg:order-2">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-semibold tracking-tight">{trialName}</h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              <span className="id">{runId}</span> · screened {formatRunTime(createdAt)}
            </p>
          </div>
        </header>

        <ResultsHeader
          results={results}
          rules={rules}
          decided={decisions.length}
          filter={filter}
          onFilter={changeFilter}
        />

        <section className="surface-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => {
                const active = f.key === "all" ? filter === null : filter === f.key;
                const count =
                  f.key === "all"
                    ? results.length
                    : results.filter((r) => r.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => changeFilter(f.key === "all" ? null : (f.key as Status))}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-rule bg-paper text-ink-muted hover:border-rule-strong hover:text-ink"
                    }`}
                  >
                    {f.label} <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-[13px] text-ink-muted">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-md border border-rule bg-paper px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
              >
                <option value="rank">Best match first</option>
                <option value="score">Score, high to low</option>
                <option value="age">Age, high to low</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[14px]">
              <caption className="sr-only">
                Patients ranked by eligibility. Select a row to see every criterion checked.
              </caption>
              <thead>
                <tr className="border-b border-rule text-left text-[12.5px] text-ink-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium">Patient</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Age</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Score</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Outcome</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Failed</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Flagged</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => {
                  const p = patientById.get(r.patientId);
                  const decision = decisionByPatient.get(r.patientId);
                  return (
                    <tr
                      key={r.patientId}
                      onClick={() => setOpenId(r.patientId)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenId(r.patientId);
                        }
                      }}
                      style={{ animationDelay: `${i * 18}ms` }}
                      className={`row-in cursor-pointer border-b border-rule last:border-0 transition-colors ${
                        openId === r.patientId ? "bg-accent-wash" : "hover:bg-paper"
                      }`}
                    >
                      <td className="id px-4 py-3">{r.patientId}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-muted">
                        {p?.age} {p?.sex}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{r.score}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusTag status={r.status} />
                          {decision && <DecisionTag decision={decision.decision} />}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${r.failed ? "text-fail" : "text-ink-faint"}`}>
                        {r.failed || "—"}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${r.flagged ? "text-flag" : "text-ink-faint"}`}>
                        {r.flagged || "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{p?.lastVisit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-12 text-center text-[14px] text-ink-muted">
              No patients in this group. Clear the filter to see the whole cohort.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-3">
              <p className="text-[13px] text-ink-muted tabular-nums">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <PageButton disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                  Previous
                </PageButton>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(i)}
                    aria-current={i === safePage ? "page" : undefined}
                    className={`h-8 min-w-8 rounded-md px-2 text-[13px] font-medium tabular-nums transition-colors ${
                      i === safePage
                        ? "bg-accent text-white"
                        : "text-ink-muted hover:bg-paper hover:text-ink"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <PageButton
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </PageButton>
              </div>
            </div>
          )}
        </section>
      </main>

      {open && patientById.get(open.patientId) && (
        <PatientSheet
          runId={runId}
          result={open}
          patient={patientById.get(open.patientId)!}
          rules={rules}
          decision={decisionByPatient.get(open.patientId) ?? null}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-md px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
