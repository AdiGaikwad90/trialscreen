import type { Rule } from "./types";

/** Apply the coordinator's choice between two readings of a criterion.
 *  Lives apart from lib/parse.ts so the client can import it without
 *  pulling the server-only Workers AI code with it. */
export function applyReading(rule: Rule, chosen: "ai" | "local"): Rule {
  if (!rule.disagreement) return rule;
  const reading = rule.disagreement[chosen];
  return {
    ...rule,
    label: reading.label,
    severity: reading.severity,
    field: reading.field,
    op: reading.op,
    target: reading.target,
    min: reading.min,
    max: reading.max,
    unit: reading.unit,
    windowDays: reading.windowDays,
    disagreement: { ...rule.disagreement, chosen },
  };
}
