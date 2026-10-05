import type { Check, Patient, Result, Rule, Status } from "./types";
import { evaluate } from "./engine";

/**
 * Scoring is deliberately trivial arithmetic so the UI can print the working
 * and a coordinator can re-derive any number by hand:
 *
 *   score = round(100 × (passed + 0.5 × flagged) / totalRules)
 *
 * A flagged criterion is worth half a passing one: unresolved, not failed.
 * No weights, no model, no calibration.
 */
export function scoreOf(checks: Check[]): number {
  if (!checks.length) return 0;
  const passed = checks.filter((c) => c.verdict === "pass").length;
  const flagged = checks.filter((c) => c.verdict === "flag").length;
  return Math.round((100 * (passed + 0.5 * flagged)) / checks.length);
}

export function statusOf(checks: Check[], rules: Rule[]): Status {
  const hard = new Set(rules.filter((r) => r.severity === "hard").map((r) => r.id));
  if (checks.some((c) => c.verdict === "fail" && hard.has(c.ruleId))) return "excluded";
  return checks.some((c) => c.verdict === "flag") ? "review" : "eligible";
}

export function scoreLine(result: Result): string {
  const { passed, flagged, checks } = { ...result, checks: result.checks };
  return `(${passed} passed + 0.5 × ${flagged} flagged) ÷ ${checks.length} criteria = ${result.score}`;
}

const STATUS_ORDER: Record<Status, number> = { eligible: 0, review: 1, excluded: 2 };

export function screen(patients: Patient[], allRules: Rule[], asOf: string): Result[] {
  // Disabled criteria (typically unmapped ones a human is checking by hand)
  // are excluded from evaluation and from the score denominator.
  const rules = allRules.filter((r) => r.enabled);

  const results = patients.map<Result>((patient) => {
    const checks = evaluate(patient, rules, asOf);
    return {
      patientId: patient.id,
      checks,
      passed: checks.filter((c) => c.verdict === "pass").length,
      flagged: checks.filter((c) => c.verdict === "flag").length,
      failed: checks.filter((c) => c.verdict === "fail").length,
      score: scoreOf(checks),
      status: statusOf(checks, rules),
    };
  });

  const lastVisit = new Map(patients.map((p) => [p.id, p.lastVisit]));

  // Rank: best status first, then score, then fewer open questions, then
  // freshest chart — a stale chart is a slower consent conversation. Patient id
  // breaks any remaining tie, which makes this a total order: without it the
  // output would depend on the order patients arrived in.
  return results.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      b.score - a.score ||
      a.flagged - b.flagged ||
      Date.parse(lastVisit.get(b.patientId)!) - Date.parse(lastVisit.get(a.patientId)!) ||
      a.patientId.localeCompare(b.patientId),
  );
}

/** Which criterion knocked each excluded patient out — powers the attrition bar. */
export function attritionByRule(results: Result[], rules: Rule[]) {
  const hard = new Set(rules.filter((r) => r.severity === "hard").map((r) => r.id));
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.status !== "excluded") continue;
    // Attribute an exclusion to its first hard failure, in protocol order,
    // so the totals sum to the excluded count instead of double-counting.
    const first = r.checks.find((c) => c.verdict === "fail" && hard.has(c.ruleId));
    if (first) counts.set(first.ruleId, (counts.get(first.ruleId) ?? 0) + 1);
  }
  return rules
    .map((rule) => ({ rule, count: counts.get(rule.id) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}
