import type { Rule, RuleField, RuleOp } from "./types";

/**
 * Deterministic fallback parser.
 *
 * It exists so the product degrades honestly rather than failing: when Workers AI
 * is unavailable (no account binding, rate limit, network), screening still runs
 * and the UI says plainly that criteria were parsed locally.
 *
 * It is a bounded keyword matcher over a clinical dictionary, not an NLP system.
 * Anything it cannot map becomes an `unmapped` rule — surfaced for manual review,
 * never silently dropped.
 */

/** Analyte synonyms → canonical lab key, plus the recency window a protocol implies. */
const LABS: Array<{ re: RegExp; key: string; unit: string; windowDays: number }> = [
  { re: /\b(hba1c|a1c|glycated h(a)?emoglobin)\b/i, key: "hba1c", unit: "%", windowDays: 90 },
  { re: /\b(egfr|gfr|kidney function|renal function|creatinine clearance)\b/i, key: "egfr", unit: "mL/min/1.73m²", windowDays: 180 },
  { re: /\b(alt|alanine (amino)?transferase|sgpt)\b/i, key: "alt", unit: "U/L", windowDays: 180 },
  { re: /\b(h(a)?emoglobin|hgb|hb)\b/i, key: "hgb", unit: "g/dL", windowDays: 180 },
];

const VITALS: Array<{ re: RegExp; key: string; unit?: string }> = [
  { re: /\b(bmi|body mass index)\b/i, key: "bmi", unit: "kg/m²" },
  { re: /\bsystolic\b/i, key: "sbp", unit: "mmHg" },
  { re: /\bdiastolic\b/i, key: "dbp", unit: "mmHg" },
];

const CONDITIONS: Array<{ re: RegExp; code: string }> = [
  { re: /\b(type ?2 diabetes|t2dm|type ii diabetes)\b/i, code: "T2DM" },
  { re: /\bheart failure\b/i, code: "HF" },
  { re: /\batrial fibrillation\b/i, code: "AF" },
  { re: /\b(chronic kidney disease|ckd)\b/i, code: "CKD3" },
  { re: /\b(coronary artery disease|cad|ischa?emic heart disease)\b/i, code: "CAD" },
  { re: /\bretinopathy\b/i, code: "RETINOPATHY" },
  { re: /\bneuropathy\b/i, code: "NEUROPATHY" },
  { re: /\b(hypertension|high blood pressure)\b/i, code: "HTN" },
];

const DRUG_CLASSES: Array<{ re: RegExp; cls: string }> = [
  { re: /\b(anticoagulant|blood.?thinn|warfarin|apixaban|rivaroxaban|dabigatran|doac|noac)\b/i, cls: "anticoagulant" },
  { re: /\b(glp.?1|semaglutide|dulaglutide|liraglutide|exenatide)\b/i, cls: "glp1" },
  { re: /\b(sglt.?2|empagliflozin|dapagliflozin|canagliflozin)\b/i, cls: "sglt2" },
  { re: /\bmetformin\b/i, cls: "metformin" },
  { re: /\binsulin\b/i, cls: "insulin" },
  { re: /\b(sulfonylurea|gliclazide|glimepiride)\b/i, cls: "sulfonylurea" },
  { re: /\b(antiplatelet|aspirin|clopidogrel)\b/i, cls: "antiplatelet" },
  { re: /\b(statin|atorvastatin|rosuvastatin|simvastatin)\b/i, cls: "statin" },
  { re: /\b(corticosteroid|prednisolone|prednisone|systemic steroid)\b/i, cls: "corticosteroid" },
];

/** How codes and classes read in the UI. The engine matches on the code; a
 *  coordinator should never have to read one. */
export const DISPLAY: Record<string, string> = {
  T2DM: "Type 2 diabetes", HF: "heart failure", AF: "atrial fibrillation",
  CKD3: "chronic kidney disease", CAD: "coronary artery disease", HTN: "hypertension",
  RETINOPATHY: "diabetic retinopathy", NEUROPATHY: "diabetic neuropathy",
  anticoagulant: "anticoagulants", glp1: "GLP-1 receptor agonists", sglt2: "SGLT2 inhibitors",
  metformin: "metformin", insulin: "insulin", sulfonylurea: "sulfonylureas",
  antiplatelet: "antiplatelets", statin: "statins", corticosteroid: "systemic corticosteroids",
  hba1c: "HbA1c", egfr: "eGFR", alt: "ALT", hgb: "Haemoglobin",
  bmi: "BMI", sbp: "Systolic BP", dbp: "Diastolic BP",
};
const name = (k: string) => DISPLAY[k] ?? k;

const NEGATION = /\b(no|not|without|free of|absence of|exclud\w*|must not|may not|prior (treatment|use|exposure)|currently taking|any use of|history of)\b/i;

/** Strip list numbering and trailing punctuation so sourceText reads cleanly. */
function clean(line: string): string {
  return line.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim().replace(/\s+/g, " ");
}

/**
 * Standalone numbers only. Digits glued to letters belong to the analyte name,
 * not to a threshold: the "1" in HbA1c, the "2" in T2DM, the "1.73" in
 * mL/min/1.73m². Reading those as limits is the classic way a naive parser
 * invents a criterion nobody wrote.
 */
function numbers(line: string): number[] {
  return (line.match(/(?<![A-Za-z\d.])\d+(?:\.\d+)?(?![A-Za-z])/g) ?? []).map(Number);
}

/** Read the comparison the sentence expresses, given the numbers it contains. */
function comparison(line: string, nums: number[]): { op: RuleOp; min?: number; max?: number } | null {
  if (!nums.length) return null;
  if (/\bbetween\b|\bfrom\b|\d\s*(?:-|–|—|to)\s*\d/i.test(line) && nums.length >= 2) {
    return { op: "between", min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  }
  if (/\b(at least|minimum|no less than|greater than or equal|≥|>=|or (?:higher|above|greater|older|more))\b/i.test(line)) {
    return { op: "gte", min: nums[0] };
  }
  if (/\b(at most|no more than|not exceed|maximum|less than or equal|≤|<=|up to|or (?:lower|below|less|younger|fewer))\b/i.test(line)) {
    return { op: "lte", max: nums[0] };
  }
  // "ALT greater than 120 U/L" as an exclusion means the protocol wants ALT ≤ 120.
  if (/\b(greater than|above|exceed\w*|over|>)\b/i.test(line)) return { op: "lte", max: nums[0] };
  if (/\b(less than|below|under|<)\b/i.test(line)) return { op: "gte", min: nums[0] };
  return null;
}

/** Duration phrases like "for at least 2 years" / "≥ 6 months". */
function duration(line: string): { min: number; unit: "years" | "months" } | null {
  const m = line.match(/(?:for |of |≥\s*|at least |minimum of )\s*(\d+(?:\.\d+)?)\s*(year|month)/i);
  if (!m) return null;
  return { min: Number(m[1]), unit: m[2].toLowerCase().startsWith("year") ? "years" : "months" };
}

function make(
  id: string,
  sourceText: string,
  label: string,
  kind: Rule["kind"],
  severity: Rule["severity"],
  field: RuleField,
  rest: Partial<Rule>,
): Rule {
  return { id, sourceText, label, kind, severity, field, op: "eq", enabled: true, ...rest };
}

/**
 * @param startSection which section the text begins in. Needed when parsing a
 * single criterion lifted out of a protocol: without it, an exclusion read on
 * its own looks like an inclusion and comes out meaning the opposite.
 */
export function parseLocally(
  criteriaText: string,
  startSection: Rule["kind"] = "inclusion",
): Rule[] {
  const rules: Rule[] = [];
  let section: Rule["kind"] = startSection;
  let n = 0;

  for (const raw of criteriaText.split(/\r?\n/)) {
    const line = clean(raw);
    if (!line) continue;

    // Section headings switch the default polarity and are not criteria themselves.
    if (/^(inclusion|exclusion)\b.{0,20}$/i.test(line)) {
      section = /^exclusion/i.test(line) ? "exclusion" : "inclusion";
      continue;
    }

    const id = `r${++n}`;
    const nums = numbers(line);
    const negated = section === "exclusion" || NEGATION.test(line);

    // Pregnancy
    if (/\bpregnan/i.test(line)) {
      rules.push(make(id, line, negated ? "Not pregnant" : "Pregnant", section, "hard", "pregnancy", {
        op: negated ? "absent" : "present",
      }));
      continue;
    }

    // Age
    if (/\bage(d)?\b|\byears old\b/i.test(line) && nums.length) {
      // Only assume a range when the sentence actually gives two bounds. A lone
      // number with no comparison word is ambiguous, and inventing the missing
      // bound is exactly the failure this tool exists to avoid.
      const cmp =
        comparison(line, nums) ??
        (nums.length >= 2
          ? { op: "between" as RuleOp, min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) }
          : null);
      if (!cmp) {
        rules.push(make(id, line, line, section, "review", "unmapped", { op: "present", enabled: false }));
        continue;
      }
      rules.push(make(id, line, `Age ${cmp.op === "between" ? `${cmp.min}–${cmp.max}` : cmp.op === "gte" ? `≥ ${cmp.min}` : `≤ ${cmp.max}`} years`, section, "hard", "age", { ...cmp, unit: "years" }));
      continue;
    }

    // Laboratory values
    const labHit = LABS.find((l) => l.re.test(line));
    if (labHit) {
      const cmp = comparison(line, nums);
      if (cmp) {
        const shown = cmp.op === "between" ? `${cmp.min}–${cmp.max}` : cmp.op === "gte" ? `≥ ${cmp.min}` : `≤ ${cmp.max}`;
        rules.push(make(id, line, `${name(labHit.key)} ${shown} ${labHit.unit}`, section, "hard", "lab", {
          ...cmp, target: labHit.key, unit: labHit.unit, windowDays: labHit.windowDays,
        }));
        continue;
      }
    }

    // Vitals
    const vitalHit = VITALS.find((v) => v.re.test(line));
    if (vitalHit) {
      const cmp = comparison(line, nums);
      if (cmp) {
        const shown = cmp.op === "between" ? `${cmp.min}–${cmp.max}` : cmp.op === "gte" ? `≥ ${cmp.min}` : `≤ ${cmp.max}`;
        rules.push(make(id, line, `${name(vitalHit.key)} ${shown}${vitalHit.unit ? ` ${vitalHit.unit}` : ""}`, section, "hard", "vital", {
          ...cmp, target: vitalHit.key, unit: vitalHit.unit,
        }));
        continue;
      }
    }

    // Medication classes. A drug exclusion is a clinical judgement — investigators
    // routinely enrol on a washout — so it flags for review rather than auto-rejecting.
    const drugHit = DRUG_CLASSES.find((d) => d.re.test(line));
    if (drugHit) {
      rules.push(make(id, line, negated ? `No ${name(drugHit.cls)}` : `On ${name(drugHit.cls)}`, section, "review", "medication", {
        op: negated ? "absent" : "present",
        target: drugHit.cls,
      }));
      continue;
    }

    // Conditions, with an optional duration requirement
    const condHit = CONDITIONS.find((c) => c.re.test(line));
    if (condHit) {
      const dur = duration(line);
      if (dur && !negated) {
        rules.push(make(id, line, `${name(condHit.code)} for ≥ ${dur.min} ${dur.unit}`, section, "hard", "condition", {
          op: "duration_gte", target: condHit.code, min: dur.min, unit: dur.unit,
        }));
      } else {
        rules.push(make(id, line, negated ? `No ${name(condHit.code)}` : `Diagnosed with ${name(condHit.code)}`, section, "hard", "condition", {
          op: negated ? "absent" : "present", target: condHit.code,
        }));
      }
      continue;
    }

    // Nothing matched. Emit it anyway, disabled, so a human sees it and the
    // report can state how many criteria were verified by hand.
    rules.push(make(id, line, line, section, "review", "unmapped", { op: "present", enabled: false }));
  }

  return rules;
}
