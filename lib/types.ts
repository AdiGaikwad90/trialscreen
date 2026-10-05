/** Domain model for TrialScreen. Synthetic data only — no PHI anywhere in this repo. */

export type Sex = "F" | "M";

export interface Condition {
  /** Short internal code used by rules, e.g. "T2DM". */
  code: string;
  label: string;
  /** ISO date. Duration criteria are computed from this, never stored. */
  diagnosedOn: string;
}

export interface Medication {
  name: string;
  /** Therapeutic class. Rules match on class so "no blood thinners" catches
   *  Warfarin, Apixaban and Rivaroxaban alike. */
  drugClass: string;
  startedOn: string;
  active: boolean;
}

export interface Lab {
  /** Canonical analyte key, e.g. "hba1c", "egfr", "alt". */
  name: string;
  value: number;
  unit: string;
  /** ISO date the specimen was drawn. Drives the staleness check. */
  drawnOn: string;
}

export interface Patient {
  id: string;
  age: number;
  sex: Sex;
  conditions: Condition[];
  medications: Medication[];
  labs: Lab[];
  vitals: { bmi: number; sbp: number; dbp: number };
  pregnant?: boolean;
  lastVisit: string;
}

export type RuleField =
  | "age"
  | "sex"
  | "condition"
  | "medication"
  | "lab"
  | "vital"
  | "pregnancy"
  | "unmapped";

export type RuleOp =
  | "between"
  | "gte"
  | "lte"
  | "eq"
  | "present"
  | "absent"
  | "duration_gte";

export interface Rule {
  id: string;
  /** Verbatim phrase from the protocol this rule came from. Traceability anchor. */
  sourceText: string;
  /** Plain-language restatement shown in the UI. */
  label: string;
  kind: "inclusion" | "exclusion";
  /** hard = auto-exclude on failure. review = flag for a human, never auto-exclude. */
  severity: "hard" | "review";
  field: RuleField;
  /** Analyte key, condition code, drug class or vital name. */
  target?: string;
  op: RuleOp;
  min?: number;
  max?: number;
  value?: string | number;
  unit?: string;
  /** Lab recency requirement in days. Outside the window → flag, not fail. */
  windowDays?: number;
  /** Off means the engine skips it and it is excluded from scoring — used for
   *  criteria the parser could not map, which a human verifies by hand. */
  enabled: boolean;
  /** Present only when the two parsers disagree about this criterion. */
  disagreement?: Disagreement;
}

export type Decision = "accepted" | "excluded" | "more_info";

export interface ReviewDecision {
  runId: string;
  patientId: string;
  decision: Decision;
  note: string;
  decidedByName: string;
  decidedByEmail: string;
  decidedAt: string;
}

/** One reading of a criterion: everything the engine needs to evaluate it. */
export interface RuleReading {
  label: string;
  severity: "hard" | "review";
  field: RuleField;
  op: RuleOp;
  target?: string;
  min?: number;
  max?: number;
  unit?: string;
  windowDays?: number;
}

/**
 * Raised when the model and the local parser read the same criterion
 * differently — an inverted exclusion, a dropped duration, a different bound.
 * The rule carries both readings and the one currently selected, so a
 * coordinator resolves the ambiguity instead of inheriting a silent guess.
 */
export interface Disagreement {
  ai: RuleReading;
  local: RuleReading;
  chosen: "ai" | "local";
}

export type Verdict = "pass" | "flag" | "fail";

export interface Check {
  ruleId: string;
  verdict: Verdict;
  /** What the record actually said, formatted for display. */
  observed: string;
  /** What the protocol required. */
  expected: string;
  /** Where the value came from — the audit trail for this single line. */
  source: string;
  /** Present on flag and fail. Explains the verdict in one sentence. */
  reason?: string;
}

export type Status = "eligible" | "review" | "excluded";

export interface Result {
  patientId: string;
  checks: Check[];
  passed: number;
  flagged: number;
  failed: number;
  score: number;
  status: Status;
}

export interface Run {
  id: string;
  trialName: string;
  criteriaText: string;
  rules: Rule[];
  results: Result[];
  /** "ai" when Workers AI parsed the criteria, "local" when the fallback did. */
  parsedBy: "ai" | "local";
  operatorEmail: string;
  operatorName: string;
  createdAt: string;
  counts: { screened: number; eligible: number; review: number; excluded: number };
}
