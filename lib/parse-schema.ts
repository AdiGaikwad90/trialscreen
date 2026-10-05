/** JSON Schema handed to Workers AI json_schema mode, kept deliberately flat:
 *  the constrained decoder is far more reliable on shallow objects of scalars. */
const RULE_PROPERTIES = {
  sourceText: { type: "string" },
  label: { type: "string" },
  kind: { type: "string", enum: ["inclusion", "exclusion"] },
  severity: { type: "string", enum: ["hard", "review"] },
  field: {
    type: "string",
    enum: ["age", "sex", "condition", "medication", "lab", "vital", "pregnancy", "unmapped"],
  },
  target: { type: "string" },
  op: {
    type: "string",
    enum: ["between", "gte", "lte", "eq", "present", "absent", "duration_gte"],
  },
  min: { type: "number" },
  max: { type: "number" },
  unit: { type: "string" },
  windowDays: { type: "number" },
} as const;

const RULE_REQUIRED = [
  "sourceText", "label", "kind", "severity", "field", "target", "op", "min", "max", "unit", "windowDays",
] as const;

/** One criterion at a time. A small schema decodes in a couple of seconds
 *  instead of thirty, and one unreadable line no longer costs the whole parse. */
export const ONE_RULE_SCHEMA = {
  type: "object",
  properties: RULE_PROPERTIES,
  required: RULE_REQUIRED,
} as const;

export const PARSE_SYSTEM = `You convert one clinical trial eligibility criterion into a structured rule. You are a translator, not a decision maker: you never screen anyone and never reason about patients.

The user message is a single criterion, prefixed with the section it appeared under.

sourceText: the criterion copied verbatim, without the section prefix and without the list number. Never paraphrase it.
label: the same criterion in plain clinical language, three to seven words. Include the comparison where there is one, and use the full clinical name of a drug class or condition rather than the internal key: "Age 40-65 years", "HbA1c 7.5-10%", "eGFR 45 or above", "ALT 120 U/L or below", "No anticoagulants", "No GLP-1 agonists", "No heart failure". Never abbreviate to a single word and never put an internal key such as "glp1" or "T2DM" in the label.
kind: "inclusion" or "exclusion", from the section prefix.
severity: "hard" when the criterion is objective and disqualifying on its own. "review" for concomitant-medication criteria, because investigators routinely enrol after a washout, so those must raise a flag for a clinician instead of rejecting automatically.
field: one of age, sex, condition, medication, lab, vital, pregnancy, unmapped.
target: the canonical key.
  labs: hba1c, egfr, alt, hgb
  vitals: bmi, sbp, dbp
  conditions: T2DM, HTN, HF, AF, CKD3, CAD
  medication classes: anticoagulant, glp1, sglt2, metformin, insulin, sulfonylurea, antiplatelet, statin, corticosteroid
  Use "" when the field has no target.
op: between, gte, lte, eq, present, absent, or duration_gte.
min / max: the bounds. Use 0 when a bound does not apply.
unit: the unit as written, or "".
windowDays: how recent a lab result must be. 90 for hba1c, 180 for other labs, 0 for everything else.

ALWAYS restate an exclusion as the condition a patient must MEET to stay in the trial. An exclusion names what disqualifies someone, so the rule you emit is its opposite. Invert the comparison. This is the single most important instruction here — getting it backwards excludes exactly the patients who qualify.
  "ALT greater than 120 U/L" under Exclusion -> field lab, target alt, op lte, max 120.
  "Haemoglobin below 10 g/dL" under Exclusion -> field lab, target hgb, op gte, min 10.
  "eGFR below 45" under Exclusion -> field lab, target egfr, op gte, min 45.
  "Currently taking any anticoagulant" under Exclusion -> field medication, target anticoagulant, op absent.
A criterion under Exclusion that is just the name of a condition or state still inverts. It is listed because having it disqualifies the patient, so the rule is that the patient must NOT have it, and op is absent.
  "Pregnancy." under Exclusion -> field pregnancy, op absent.
  "Diagnosis of heart failure." under Exclusion -> field condition, target HF, op absent.
  "History of atrial fibrillation." under Exclusion -> field condition, target AF, op absent.
Under Exclusion, op is NEVER "present".

NEVER drop a duration. If the criterion says "for at least N years" or "for at least N months", the operator is duration_gte, min is N, and unit is "years" or "months". "Documented Type 2 Diabetes Mellitus for at least 5 years" is duration_gte with min 5 — it is NOT op present. Dropping the duration silently admits patients the protocol excludes.

Never invent a threshold, unit or time window the text does not state.

If a criterion does not map to any field and target above, set field to "unmapped" and op to "present". Never force a bad match and never drop a criterion — saying what you cannot read is more useful than guessing.`;
