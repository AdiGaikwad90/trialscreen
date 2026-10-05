"use client";

import { useState } from "react";
import type { Result, Rule, Status } from "@/lib/types";
import { attritionByRule } from "@/lib/score";

type Filter = Status | null;

/**
 * The top of the results screen answers two questions a trial lead asks in this
 * order: how many can I actually enrol, and what is costing me the rest.
 * Every published trial carries a CONSORT flow diagram; this is the live one.
 */
export function ResultsHeader({
  results,
  rules,
  decided,
  filter,
  onFilter,
}: {
  results: Result[];
  rules: Rule[];
  decided: number;
  filter: Filter;
  onFilter: (s: Filter) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const total = results.length || 1;
  const n = (s: Status) => results.filter((r) => r.status === s).length;
  const counts = { eligible: n("eligible"), review: n("review"), excluded: n("excluded") };

  const tiles = [
    {
      key: null as Filter,
      label: "Screened",
      value: results.length,
      hint: `${rules.filter((r) => r.enabled).length} criteria each`,
      tone: "text-ink",
    },
    {
      key: "eligible" as Filter,
      label: "Eligible",
      value: counts.eligible,
      hint: percent(counts.eligible, total),
      tone: "text-pass",
    },
    {
      key: "review" as Filter,
      label: "Needs review",
      value: counts.review,
      hint: counts.review ? "awaiting a clinician" : "queue clear",
      tone: "text-flag",
    },
    {
      key: "excluded" as Filter,
      label: "Not eligible",
      value: counts.excluded,
      hint: percent(counts.excluded, total),
      tone: "text-fail",
    },
    {
      key: null as Filter,
      label: "Decisions logged",
      value: decided,
      hint: decided ? "recorded against your name" : "none yet",
      tone: "text-accent",
      passive: true,
    },
  ];

  const attrition = attritionByRule(results, rules);
  const worst = attrition[0]?.count ?? 1;
  const segments = [
    { key: "eligible" as const, label: "Eligible", n: counts.eligible, bg: "bg-pass" },
    { key: "review" as const, label: "Needs review", n: counts.review, bg: "bg-flag" },
    { key: "excluded" as const, label: "Not eligible", n: counts.excluded, bg: "bg-fail" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => {
          const active = t.key !== null && filter === t.key;
          const Tag = t.passive ? "div" : "button";
          return (
            <Tag
              key={t.label}
              {...(t.passive
                ? {}
                : {
                    type: "button" as const,
                    onClick: () => onFilter(filter === t.key ? null : t.key),
                    "aria-pressed": active,
                  })}
              className={`surface-raised px-4 py-3.5 text-left transition-colors ${
                t.passive ? "" : "hover:border-rule-strong"
              } ${active ? "border-accent ring-1 ring-accent" : ""}`}
            >
              <p className="text-[12px] font-medium tracking-wide text-ink-muted">{t.label}</p>
              <p className={`mt-1 text-[30px] font-semibold leading-none tabular-nums ${t.tone}`}>
                {t.value}
              </p>
              <p className="mt-1.5 text-[12px] text-ink-faint">{t.hint}</p>
            </Tag>
          );
        })}
      </div>

      {counts.eligible === 0 && attrition.length > 0 && (
        <p className="surface border-flag/30 bg-flag-wash px-4 py-3 text-[14px] leading-relaxed text-flag">
          No patient in this cohort meets every criterion. <strong>{attrition[0].rule.label}</strong>{" "}
          alone rules out {attrition[0].count} of {results.length}. If that is stricter than the
          protocol intends, re-read the criteria and check how that rule was translated.
        </p>
      )}

      <section className="surface-raised p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[16px] font-semibold tracking-tight">Where the cohort went</h2>
          <p className="text-[13px] text-ink-muted">Select a band to filter the list</p>
        </div>

        <div className="mt-3 flex h-10 gap-0.5 overflow-hidden rounded-md" role="group" aria-label="Screening outcome">
          {segments.map((s) =>
            s.n === 0 ? null : (
              <button
                key={s.key}
                type="button"
                onClick={() => onFilter(filter === s.key ? null : s.key)}
                aria-pressed={filter === s.key}
                title={`${s.label}: ${s.n} of ${results.length}`}
                style={{ width: `${(s.n / total) * 100}%` }}
                className={`${s.bg} flex items-center justify-center text-[13px] font-medium text-white transition-opacity ${
                  filter && filter !== s.key ? "opacity-25" : "hover:opacity-90"
                }`}
              >
                {s.n / total > 0.07 && s.n}
              </button>
            ),
          )}
        </div>

        {attrition.length > 0 && (
          <div className="mt-6 border-t border-rule pt-5">
            <h3 className="text-[14px] font-medium">What ruled patients out</h3>
            <p className="mt-1 text-[13px] text-ink-muted">
              Each patient counted once, against the first criterion they failed.
            </p>

            <ul className="mt-3.5 space-y-2.5">
              {attrition.map(({ rule, count }) => (
                <li
                  key={rule.id}
                  onMouseEnter={() => setHovered(rule.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(80px,180px)_3rem] items-center gap-3"
                >
                  <span className="truncate text-[14px]">{rule.label}</span>
                  <span className="h-2 rounded-sm bg-paper">
                    <span
                      style={{ width: `${(count / worst) * 100}%` }}
                      className={`block h-2 rounded-sm transition-colors ${
                        hovered === rule.id ? "bg-fail" : "bg-fail/40"
                      }`}
                    />
                  </span>
                  <span className="text-right text-[14px] font-medium tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function percent(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}% of cohort`;
}
