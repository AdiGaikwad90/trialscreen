import type { Decision, Status, Verdict } from "@/lib/types";

/**
 * A verdict is never carried by colour alone — every one has a glyph and a
 * word too, so the screen still reads on a bad projector or to a colour-blind
 * reviewer.
 */
const VERDICT = {
  pass: { glyph: "✓", word: "Passed", text: "text-pass", wash: "bg-pass-wash", border: "border-pass/25" },
  flag: { glyph: "⚠", word: "Review", text: "text-flag", wash: "bg-flag-wash", border: "border-flag/25" },
  fail: { glyph: "✗", word: "Failed", text: "text-fail", wash: "bg-fail-wash", border: "border-fail/25" },
} as const;

export function VerdictMark({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      aria-hidden
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] leading-none ${v.wash} ${v.text}`}
    >
      {v.glyph}
    </span>
  );
}

export function verdictWord(verdict: Verdict) {
  return VERDICT[verdict].word;
}

const STATUS = {
  eligible: { label: "Eligible", glyph: "✓", cls: "bg-pass-wash text-pass" },
  review: { label: "Review", glyph: "⚠", cls: "bg-flag-wash text-flag" },
  excluded: { label: "Not eligible", glyph: "✗", cls: "bg-fail-wash text-fail" },
} as const;

export function StatusTag({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${s.cls}`}>
      <span aria-hidden>{s.glyph}</span>
      {s.label}
    </span>
  );
}

const DECISION = {
  accepted: { label: "Accepted", cls: "border-pass/30 text-pass" },
  excluded: { label: "Excluded by reviewer", cls: "border-fail/30 text-fail" },
  more_info: { label: "More information needed", cls: "border-flag/30 text-flag" },
} as const;

export const DECISION_LABEL: Record<Decision, string> = {
  accepted: DECISION.accepted.label,
  excluded: DECISION.excluded.label,
  more_info: DECISION.more_info.label,
};

/** A human's call, shown as an outline so it never reads as an engine verdict. */
export function DecisionTag({ decision }: { decision: Decision }) {
  const d = DECISION[decision];
  return (
    <span className={`inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[12px] font-medium ${d.cls}`}>
      {d.label}
    </span>
  );
}

export const STATUS_LABEL: Record<Status, string> = {
  eligible: "Eligible",
  review: "Review",
  excluded: "Not eligible",
};
