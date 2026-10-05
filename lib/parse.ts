import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Disagreement, Rule, RuleReading } from "./types";
import { parseLocally } from "./parse-local";
import { ONE_RULE_SCHEMA, PARSE_SYSTEM } from "./parse-schema";

/**
 * AI call 1 of 2: read a protocol written for humans and restate it as rules.
 *
 * The model translates. It never decides anything about a patient, and every
 * rule it produces is shown to a coordinator for approval before a single
 * record is evaluated.
 *
 * Criteria are parsed one at a time, in parallel. A single large constrained
 * decode takes about thirty seconds and fails as a unit; twelve small ones take
 * about four and fail independently, so one unreadable line costs one line.
 */

interface RawRule {
  sourceText: string;
  label: string;
  kind: "inclusion" | "exclusion";
  severity: "hard" | "review";
  field: Rule["field"];
  target: string;
  op: Rule["op"];
  min: number;
  max: number;
  unit: string;
  windowDays: number;
}

export interface ParseResult {
  trialName: string;
  rules: Rule[];
  parsedBy: "ai" | "local";
  /** Set when something degraded. Always shown to the user — never swallowed. */
  notice?: string;
}

/** The evaluative part of a rule — what the engine actually acts on. */
function readingOf(rule: Rule): RuleReading {
  return {
    label: rule.label,
    severity: rule.severity,
    field: rule.field,
    op: rule.op,
    target: rule.target,
    min: rule.min,
    max: rule.max,
    unit: rule.unit,
    windowDays: rule.windowDays,
  };
}

/**
 * Do two readings mean the same thing to the engine?
 *
 * Label, unit and recency window are presentation or policy; a difference there
 * changes nothing about who passes. Field, operator, target and bounds are the
 * criterion itself: if those differ, the two parsers disagree about who is
 * eligible, and a human has to settle it.
 */
function sameReading(a: RuleReading, b: RuleReading): boolean {
  return (
    a.field === b.field &&
    a.op === b.op &&
    (a.target ?? "") === (b.target ?? "") &&
    (a.min ?? null) === (b.min ?? null) &&
    (a.max ?? null) === (b.max ?? null)
  );
}

/** Split a protocol into individual criteria, keeping track of the section
 *  each one sits under so the model can tell inclusion from exclusion. */
export function splitCriteria(text: string): { line: string; kind: "inclusion" | "exclusion" }[] {
  const out: { line: string; kind: "inclusion" | "exclusion" }[] = [];
  let kind: "inclusion" | "exclusion" = "inclusion";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim().replace(/\s+/g, " ");
    if (!line) continue;
    if (/^(inclusion|exclusion)\b.{0,20}$/i.test(line)) {
      kind = /^exclusion/i.test(line) ? "exclusion" : "inclusion";
      continue;
    }
    out.push({ line, kind });
  }
  return out;
}

const VALID_FIELDS = new Set<Rule["field"]>([
  "age", "sex", "condition", "medication", "lab", "vital", "pregnancy", "unmapped",
]);
const VALID_OPS = new Set<Rule["op"]>([
  "between", "gte", "lte", "eq", "present", "absent", "duration_gte",
]);

function toRule(
  raw: RawRule,
  id: string,
  sourceLine: string,
  /** Read from the protocol's own headings, which is more reliable than asking
   *  the model which section it was just told the criterion came from. */
  kind: "inclusion" | "exclusion",
): Rule {

  const field = VALID_FIELDS.has(raw.field) ? raw.field : "unmapped";
  let op = VALID_OPS.has(raw.op) ? raw.op : "present";

  // An exclusion lists what disqualifies a patient, so a rule derived from one
  // can never require the patient to HAVE that thing. The model gets this wrong
  // on bare nouns ("Pregnancy.", "Diagnosis of heart failure.") however the
  // prompt is worded, and it is an invariant rather than a judgement call, so
  // it belongs in code. Numeric exclusions are inverted by the model and
  // cross-checked against the local parser below.
  if (kind === "exclusion" && op === "present") op = "absent";
  const numeric = op === "between" || op === "gte" || op === "lte" || op === "duration_gte";

  return {
    id,
    // Trust the protocol text over the model's copy of it: sourceText is the
    // audit anchor, so it must be the real line, not a near-miss.
    sourceText: sourceLine,
    label: raw.label?.trim() || sourceLine,
    kind,
    // Severity is site policy, not a model judgement. A concomitant-medication
    // criterion always raises a flag rather than rejecting, because investigators
    // routinely enrol after a washout. The coordinator can override it per rule.
    severity: field === "medication" || field === "unmapped" ? "review" : "hard",
    field,
    op,
    ...(raw.target ? { target: raw.target } : {}),
    ...(numeric && raw.min ? { min: raw.min } : {}),
    ...(numeric && raw.max ? { max: raw.max } : {}),
    ...(raw.unit ? { unit: raw.unit } : {}),
    ...(field === "lab" && raw.windowDays ? { windowDays: raw.windowDays } : {}),
    // A criterion the model could not map is surfaced but left out of scoring
    // until a human confirms it.
    enabled: field !== "unmapped",
  };
}

function trialNameFrom(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() && !/^(inclusion|exclusion)/i.test(l.trim()));
  const named = first?.match(/\b([A-Z][A-Z0-9-]{3,}(?:-[A-Z0-9]+)*)\b/)?.[1];
  return named ?? "Untitled protocol";
}

export async function parseCriteria(criteriaText: string): Promise<ParseResult> {
  const criteria = splitCriteria(criteriaText);
  if (!criteria.length) {
    return { trialName: "Untitled protocol", rules: [], parsedBy: "local" };
  }

  const { env } = getCloudflareContext();
  const model = env.TRIALSCREEN_MODEL as string;

  const settled = await Promise.allSettled(
    criteria.map(({ line, kind }) =>
      env.AI.run(model as never, {
        messages: [
          { role: "system", content: PARSE_SYSTEM },
          { role: "user", content: `Section: ${kind} criteria\nCriterion: ${line}` },
        ],
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_schema", json_schema: ONE_RULE_SCHEMA },
      } as never),
    ),
  );

  let failures = 0;
  let conflicts = 0;

  const rules = settled.map((outcome, i) => {
    const { line, kind } = criteria[i];
    const id = `r${i + 1}`;
    // The local parser is cheap and synchronous, so every criterion gets a
    // second, deterministic reading to check the model against.
    const [localRule] = parseLocally(line, kind);
    const raw =
      outcome.status === "fulfilled"
        ? ((outcome.value as { response?: RawRule }).response ?? null)
        : null;

    if (!raw || typeof raw !== "object" || !raw.field) {
      // This one criterion falls back to the local parser. The rest are unaffected.
      failures++;
      return localRule ? { ...localRule, id } : toRule({ field: "unmapped" } as RawRule, id, line, kind);
    }

    const aiRule = toRule(raw, id, line, kind);

    // Nothing to compare against if the local parser could not map it either.
    if (!localRule || localRule.field === "unmapped" || aiRule.field === "unmapped") return aiRule;

    if (sameReading(readingOf(aiRule), readingOf(localRule))) return aiRule;

    // The two readings imply different cohorts. Surface both and default to the
    // deterministic one; the coordinator decides which the protocol meant.
    conflicts++;
    const disagreement: Disagreement = {
      ai: readingOf(aiRule),
      local: readingOf(localRule),
      chosen: "local",
    };
    return { ...localRule, id, disagreement };
  });

  const allFailed = failures === criteria.length;
  const notices = [
    allFailed
      ? "Workers AI could not be reached, so every criterion was read by the local parser instead. Check the checklist carefully before screening."
      : failures > 0
        ? `${failures} of ${criteria.length} criteria fell back to the local parser.`
        : null,
    conflicts > 0
      ? `${conflicts} ${conflicts === 1 ? "criterion was" : "criteria were"} read two different ways. Each one is marked below — confirm which reading the protocol means before screening.`
      : null,
  ].filter(Boolean);

  return {
    trialName: trialNameFrom(criteriaText),
    rules,
    parsedBy: allFailed ? "local" : "ai",
    notice: notices.length ? notices.join(" ") : undefined,
  };
}

export { applyReading } from "./parse-readings";
