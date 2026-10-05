import type { Check, Lab, Patient, Rule, Verdict } from "./types";

/**
 * The deterministic core. No AI, no I/O, no randomness, no ambient clock —
 * `asOf` is injected so any run can be re-derived exactly.
 *
 * Three verdicts, and the distinction between them is the whole product:
 *   pass — the record satisfies the criterion
 *   flag — a human must look (missing data, stale data, unmappable rule,
 *          or a soft criterion the record does not satisfy)
 *   fail — a hard criterion the record definitively does not satisfy
 *
 * Absence of evidence is never evidence of absence: a missing lab flags,
 * it never fails.
 */

const DAY = 86_400_000;

function daysBetween(fromISO: string, toISO: string): number {
  return Math.floor((Date.parse(toISO) - Date.parse(fromISO)) / DAY);
}

function yearsBetween(fromISO: string, toISO: string): number {
  return daysBetween(fromISO, toISO) / 365.25;
}

function fmtDuration(years: number): string {
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  return m ? `${y}y ${m}m` : `${y}y`;
}

/** Most recent specimen for an analyte, or undefined if never drawn. */
function latestLab(patient: Patient, analyte: string): Lab | undefined {
  return patient.labs
    .filter((l) => l.name === analyte)
    .sort((a, b) => Date.parse(b.drawnOn) - Date.parse(a.drawnOn))[0];
}

/** Does a numeric value satisfy the rule's comparison? */
function satisfiesNumeric(v: number, rule: Rule): boolean {
  switch (rule.op) {
    case "between":
      return v >= (rule.min ?? -Infinity) && v <= (rule.max ?? Infinity);
    case "gte":
      return v >= (rule.min ?? Number(rule.value));
    case "lte":
      return v <= (rule.max ?? Number(rule.value));
    case "eq":
      return v === Number(rule.value);
    default:
      return false;
  }
}

/** Human-readable statement of what the rule demanded. */
export function expectedText(rule: Rule): string {
  const u = rule.unit ? ` ${rule.unit}` : "";
  switch (rule.op) {
    case "between":
      return `${rule.min}–${rule.max}${u}`;
    case "gte":
      return `≥ ${rule.min ?? rule.value}${u}`;
    case "lte":
      return `≤ ${rule.max ?? rule.value}${u}`;
    case "eq":
      return `${rule.value}`;
    case "present":
      return "present on record";
    case "absent":
      return "not on record";
    case "duration_gte":
      return `≥ ${rule.min} ${rule.unit ?? "years"}`;
    default:
      return "—";
  }
}

/** A criterion the record does not satisfy: hard rules fail, soft rules flag. */
function unmet(rule: Rule): Verdict {
  return rule.severity === "hard" ? "fail" : "flag";
}

function evaluateRule(patient: Patient, rule: Rule, asOf: string): Check {
  const base = { ruleId: rule.id, expected: expectedText(rule) };

  switch (rule.field) {
    case "unmapped":
      return {
        ...base,
        verdict: "flag",
        observed: "not evaluated",
        source: "—",
        reason:
          "No structured field matches this criterion. Verify against the chart manually.",
      };

    case "age": {
      const ok = satisfiesNumeric(patient.age, rule);
      return {
        ...base,
        verdict: ok ? "pass" : unmet(rule),
        observed: `${patient.age} y`,
        source: "demographics",
        reason: ok ? undefined : `Age ${patient.age} is outside ${expectedText(rule)}.`,
      };
    }

    case "sex": {
      const ok = patient.sex === rule.value;
      return {
        ...base,
        verdict: ok ? "pass" : unmet(rule),
        observed: patient.sex,
        source: "demographics",
        reason: ok ? undefined : `Recorded sex is ${patient.sex}.`,
      };
    }

    case "pregnancy": {
      const isPregnant = patient.pregnant === true;
      const unknown = patient.pregnant === undefined && patient.sex === "F";
      if (unknown) {
        return {
          ...base,
          verdict: "flag",
          observed: "not recorded",
          source: "chart",
          reason: "No pregnancy status on record. Confirm before enrolment.",
        };
      }
      const ok = rule.op === "present" ? isPregnant : !isPregnant;
      return {
        ...base,
        verdict: ok ? "pass" : unmet(rule),
        observed: isPregnant ? "pregnant" : "not pregnant",
        source: "chart",
        reason: ok ? undefined : "Pregnancy is an exclusion for this protocol.",
      };
    }

    case "condition": {
      const dx = patient.conditions.find((c) => c.code === rule.target);

      if (rule.op === "absent") {
        const ok = !dx;
        return {
          ...base,
          verdict: ok ? "pass" : unmet(rule),
          observed: dx ? dx.label : "not on problem list",
          source: dx ? `dx ${dx.diagnosedOn}` : "problem list",
          reason: ok ? undefined : `${dx!.label} is on the problem list.`,
        };
      }

      if (!dx) {
        return {
          ...base,
          verdict: unmet(rule),
          observed: "not on problem list",
          source: "problem list",
          reason: `No diagnosis of ${rule.target} on record.`,
        };
      }

      if (rule.op === "duration_gte") {
        const years = yearsBetween(dx.diagnosedOn, asOf);
        const required = rule.unit === "months" ? (rule.min ?? 0) / 12 : rule.min ?? 0;
        const ok = years >= required;
        return {
          ...base,
          verdict: ok ? "pass" : unmet(rule),
          observed: fmtDuration(years),
          source: `dx ${dx.diagnosedOn}`,
          reason: ok
            ? undefined
            : `Diagnosed ${fmtDuration(years)} ago, protocol requires ${expectedText(rule)}.`,
        };
      }

      return {
        ...base,
        verdict: "pass",
        observed: dx.label,
        source: `dx ${dx.diagnosedOn}`,
      };
    }

    case "medication": {
      // Class match, not name match — Warfarin, Apixaban and Rivaroxaban
      // all carry drugClass "anticoagulant".
      const matches = patient.medications.filter(
        (m) => m.drugClass === rule.target || m.name.toLowerCase() === String(rule.target).toLowerCase(),
      );
      const active = matches.filter((m) => m.active);
      const discontinued = matches.filter((m) => !m.active);

      if (rule.op === "absent") {
        if (active.length) {
          return {
            ...base,
            verdict: unmet(rule),
            observed: active.map((m) => m.name).join(", "),
            source: "active medications",
            reason:
              rule.severity === "hard"
                ? `${active[0].name} is a ${rule.target} and is excluded by protocol.`
                : `On ${active[0].name} (${rule.target}). Investigator must confirm before exclusion.`,
          };
        }
        if (discontinued.length) {
          // Stopped, but recently enough to matter clinically — never silently pass.
          return {
            ...base,
            verdict: "flag",
            observed: `${discontinued[0].name} (discontinued)`,
            source: "medication history",
            reason: `${discontinued[0].name} was discontinued. Confirm washout period.`,
          };
        }
        return {
          ...base,
          verdict: "pass",
          observed: `no ${rule.target} on record`,
          source: "active medications",
        };
      }

      const ok = active.length > 0;
      return {
        ...base,
        verdict: ok ? "pass" : unmet(rule),
        observed: ok ? active.map((m) => m.name).join(", ") : `no ${rule.target} on record`,
        source: "active medications",
        reason: ok ? undefined : `No ${rule.target} on the active medication list.`,
      };
    }

    case "lab": {
      const lab = latestLab(patient, String(rule.target));
      if (!lab) {
        return {
          ...base,
          verdict: "flag",
          observed: "no result on record",
          source: "laboratory",
          reason: `No ${rule.target} result on record — cannot evaluate. Order before enrolment.`,
        };
      }

      const age = daysBetween(lab.drawnOn, asOf);
      const stale = rule.windowDays !== undefined && age > rule.windowDays;
      const ok = satisfiesNumeric(lab.value, rule);
      const observed = `${lab.value} ${lab.unit}`;
      const source = `lab ${rule.target}, drawn ${lab.drawnOn}`;

      if (!ok) {
        return {
          ...base,
          verdict: unmet(rule),
          observed,
          source,
          reason: `${observed} is outside ${expectedText(rule)}.`,
        };
      }
      if (stale) {
        return {
          ...base,
          verdict: "flag",
          observed,
          source,
          reason: `Value is in range but was drawn ${age} days ago; protocol window is ${rule.windowDays} days. Repeat the draw.`,
        };
      }
      return { ...base, verdict: "pass", observed, source };
    }

    case "vital": {
      const key = rule.target as "bmi" | "sbp" | "dbp";
      const v = patient.vitals[key];
      if (v === undefined) {
        return {
          ...base,
          verdict: "flag",
          observed: "not recorded",
          source: "vitals",
          reason: `No ${key} recorded — cannot evaluate.`,
        };
      }
      const ok = satisfiesNumeric(v, rule);
      return {
        ...base,
        verdict: ok ? "pass" : unmet(rule),
        observed: `${v}${rule.unit ? ` ${rule.unit}` : ""}`,
        source: `vitals, ${patient.lastVisit}`,
        reason: ok ? undefined : `${key.toUpperCase()} ${v} is outside ${expectedText(rule)}.`,
      };
    }
  }
}

export function evaluate(patient: Patient, rules: Rule[], asOf: string): Check[] {
  return rules.map((rule) => evaluateRule(patient, rule, asOf));
}
