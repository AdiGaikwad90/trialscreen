import type { Rule, RuleReading } from "./types";

/** The rule as the engine will actually run it. Shown so a coordinator can
 *  check the translation, not just trust it. */
export function structuredForm(rule: Rule): string {
  const t = rule.target ?? rule.field;
  switch (rule.op) {
    case "between":
      return `${t} ∈ [${rule.min}, ${rule.max}]${rule.unit ? ` ${rule.unit}` : ""}`;
    case "gte":
      return `${t} ≥ ${rule.min}${rule.unit ? ` ${rule.unit}` : ""}`;
    case "lte":
      return `${t} ≤ ${rule.max}${rule.unit ? ` ${rule.unit}` : ""}`;
    case "eq":
      return `${t} = ${rule.value}`;
    case "present":
      return `${t} present`;
    case "absent":
      return `${t} absent`;
    case "duration_gte":
      return `${t} duration ≥ ${rule.min} ${rule.unit ?? "years"}`;
    default:
      return t;
  }
}

/** Same notation as structuredForm, for one candidate reading of a criterion. */
export function readingForm(reading: RuleReading): string {
  return structuredForm({ ...reading, id: "", sourceText: "", kind: "inclusion", enabled: true });
}

export function formatRunTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
