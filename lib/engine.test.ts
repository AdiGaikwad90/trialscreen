import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./engine";
import { screen, scoreOf, attritionByRule } from "./score";
import { parseLocally } from "./parse-local";
import { applyDecisions } from "./decisions";
import { PATIENTS, AS_OF } from "./patients";
import { EXAMPLE_CRITERIA } from "./protocol";
import type { Check, Patient } from "./types";

const RULES = parseLocally(EXAMPLE_CRITERIA);
const patient = (id: string): Patient => {
  const p = PATIENTS.find((x) => x.id === id);
  assert.ok(p, `fixture ${id} missing`);
  return p;
};
const checkFor = (id: string, ruleLabelFragment: string): Check => {
  const rule = RULES.find((r) => r.label.toLowerCase().includes(ruleLabelFragment.toLowerCase()));
  assert.ok(rule, `no rule matching "${ruleLabelFragment}" — parser regression`);
  const c = evaluate(patient(id), [rule], AS_OF)[0];
  return c;
};

test("the example protocol parses into the expected criteria", () => {
  assert.equal(RULES.length, 12);
  const byField = RULES.reduce<Record<string, number>>((acc, r) => {
    acc[r.field] = (acc[r.field] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byField, {
    age: 1, condition: 2, lab: 3, vital: 1, medication: 3, pregnancy: 1, unmapped: 1,
  });
  // "Unable to attend monthly study visits" has no structured field. It must be
  // surfaced and disabled, never quietly discarded.
  const unmapped = RULES.filter((r) => r.field === "unmapped");
  assert.equal(unmapped.length, 1);
  assert.equal(unmapped[0].enabled, false);
  assert.match(unmapped[0].sourceText, /monthly study visits/);
});

test("sourceText is preserved verbatim for every rule", () => {
  for (const r of RULES) {
    assert.ok(r.sourceText.length > 0);
    assert.ok(EXAMPLE_CRITERIA.includes(r.sourceText), `"${r.sourceText}" is not in the protocol text`);
  }
});

test("a textbook match passes every enabled criterion", () => {
  const checks = evaluate(patient("TS-0142"), RULES.filter((r) => r.enabled), AS_OF);
  const bad = checks.filter((c) => c.verdict !== "pass");
  assert.deepEqual(bad.map((c) => `${c.ruleId}:${c.verdict}:${c.reason}`), []);
  assert.equal(scoreOf(checks), 100);
});

test("inclusive bounds: HbA1c 7.49 fails a 7.5 floor", () => {
  const c = checkFor("TS-0055", "hba1c");
  assert.equal(c.verdict, "fail");
  assert.equal(c.observed, "7.49 %");
  assert.equal(c.expected, "7.5–10 %");
});

test("inclusive bounds: eGFR 44.6 fails a floor of 45 without rounding up", () => {
  const c = checkFor("TS-0090", "egfr");
  assert.equal(c.verdict, "fail");
  assert.equal(c.observed, "44.6 mL/min/1.73m²");
});

test("inclusive bounds: a value exactly on the boundary passes", () => {
  const rule = RULES.find((r) => r.target === "hba1c")!;
  const onBoundary: Patient = {
    ...patient("TS-0142"),
    labs: [{ name: "hba1c", value: 7.5, unit: "%", drawnOn: "2026-09-01" }],
  };
  assert.equal(evaluate(onBoundary, [rule], AS_OF)[0].verdict, "pass");
});

test("missing data flags for review — it never fails", () => {
  const c = checkFor("TS-0068", "hba1c");
  assert.equal(c.verdict, "flag");
  assert.match(c.reason!, /no hba1c result on record/i);
});

test("stale data flags even when the value is in range", () => {
  const c = checkFor("TS-0073", "hba1c");
  assert.equal(c.verdict, "flag");
  assert.match(c.reason!, /in range but was drawn 428 days ago.*window is 90/i);
});

test("a discontinued excluded drug flags for washout rather than passing", () => {
  const c = checkFor("TS-0081", "no anticoagulant");
  assert.equal(c.verdict, "flag");
  assert.match(c.reason!, /discontinued.*washout/i);
});

test("drug exclusions match on class, so apixaban is caught by 'anticoagulant'", () => {
  const c = checkFor("TS-0104", "no anticoagulant");
  assert.equal(c.verdict, "flag");
  assert.match(c.observed, /Apixaban/);
});

test("a soft criterion never excludes on its own", () => {
  const enabled = RULES.filter((r) => r.enabled);
  const [result] = screen([patient("TS-0007")], enabled, AS_OF);
  assert.equal(result.status, "review");
  assert.equal(result.failed, 0);
  assert.equal(result.flagged, 1);
});

test("condition duration is computed from the diagnosis date, not stored", () => {
  const c = checkFor("TS-0119", "Type 2 diabetes for");
  assert.equal(c.verdict, "fail");
  assert.equal(c.observed, "1y 8m");
  assert.equal(c.source, "dx 2025-02-01");
});

test("a hard criterion outside range excludes the patient", () => {
  const enabled = RULES.filter((r) => r.enabled);
  for (const id of ["TS-0031", "TS-0096", "TS-0127"] as const) {
    const [result] = screen([patient(id)], enabled, AS_OF);
    assert.equal(result.status, "excluded", `${id} should be excluded`);
    assert.ok(result.checks.some((c) => c.verdict === "fail" && c.reason?.length), `${id} must say why`);
  }
});

test("every check carries an observed value and a source", () => {
  const enabled = RULES.filter((r) => r.enabled);
  for (const p of PATIENTS) {
    for (const c of evaluate(p, enabled, AS_OF)) {
      assert.ok(c.observed, `${p.id}/${c.ruleId} has no observed value`);
      assert.ok(c.source, `${p.id}/${c.ruleId} has no source`);
      if (c.verdict !== "pass") assert.ok(c.reason, `${p.id}/${c.ruleId} is ${c.verdict} with no reason`);
    }
  }
});

test("screening is deterministic — the same inputs give the same output", () => {
  const enabled = RULES.filter((r) => r.enabled);
  const digest = (ps: Patient[]) =>
    screen(ps, enabled, AS_OF).map((r) => `${r.patientId}:${r.status}:${r.score}`);
  assert.deepEqual(digest([...PATIENTS].reverse()), digest(PATIENTS));
  assert.deepEqual(digest([...PATIENTS].sort(() => 0.5)), digest(PATIENTS));
});

test("ranking puts eligible first and the strongest match at the top", () => {
  const results = screen(PATIENTS, RULES, AS_OF);
  assert.equal(results.length, 50);
  assert.equal(results[0].patientId, "TS-0142");
  const order = { eligible: 0, review: 1, excluded: 2 } as const;
  for (let i = 1; i < results.length; i++) {
    assert.ok(order[results[i - 1].status] <= order[results[i].status], "status order broken");
  }
});

test("attrition attributes each exclusion to exactly one criterion", () => {
  const results = screen(PATIENTS, RULES, AS_OF);
  const excluded = results.filter((r) => r.status === "excluded").length;
  const attributed = attritionByRule(results, RULES).reduce((n, x) => n + x.count, 0);
  assert.equal(attributed, excluded);
});

test("disabled criteria are excluded from evaluation and from the denominator", () => {
  const withUnmapped = screen([patient("TS-0142")], RULES, AS_OF)[0];
  assert.equal(withUnmapped.checks.length, 11);
  assert.equal(withUnmapped.score, 100);
});

test("an open-ended age bound is read as a bound, not as half a range", () => {
  const [rule] = parseLocally("Aged 50 years or older.");
  assert.equal(rule.field, "age");
  assert.equal(rule.op, "gte");
  assert.equal(rule.min, 50);
  assert.equal(rule.max, undefined);
});

test("an ambiguous single-number criterion is never given an invented bound", () => {
  // "Age 50" states one number and no comparison. Guessing a direction here is
  // how a screening tool silently excludes the wrong half of a cohort.
  const [rule] = parseLocally("Age 50.");
  assert.equal(rule.field, "unmapped");
  assert.equal(rule.enabled, false);
});

test("the cohort produces a demo-worthy funnel", () => {
  const results = screen(PATIENTS, RULES, AS_OF);
  const n = (s: string) => results.filter((r) => r.status === s).length;
  assert.ok(n("eligible") >= 3, `only ${n("eligible")} eligible`);
  assert.ok(n("review") >= 5, `only ${n("review")} in review`);
  assert.ok(n("excluded") >= 10, `only ${n("excluded")} excluded`);
  console.log(`  funnel: screened 50 → eligible ${n("eligible")} · review ${n("review")} · excluded ${n("excluded")}`);
});

// --- Exclusion polarity, the defect that emptied a whole cohort ------------

test("an exclusion is restated as what the patient must satisfy", () => {
  // "Haemoglobin below 10" under Exclusion means the trial wants hgb >= 10.
  // Reading it as hgb <= 10 fails every patient with healthy haemoglobin.
  const fromHeading = parseLocally(`Exclusion criteria
1. Haemoglobin below 10 g/dL.`)[0];
  // The same line lifted out on its own must mean the same thing, which it only
  // can if the section travels with it.
  const lifted = parseLocally("Haemoglobin below 10 g/dL.", "exclusion")[0];
  for (const r of [fromHeading, lifted]) {
    assert.equal(r.field, "lab");
    assert.equal(r.target, "hgb");
    assert.equal(r.op, "gte");
    assert.equal(r.min, 10);
  }
});

test("a criterion lifted out of its section keeps that section's polarity", () => {
  assert.equal(parseLocally("Pregnancy.", "exclusion")[0].op, "absent");
  assert.equal(parseLocally("Diagnosis of heart failure.", "exclusion")[0].op, "absent");
  assert.equal(parseLocally("Currently taking any anticoagulant.", "exclusion")[0].op, "absent");
});

test("a healthy patient passes an inverted-sounding exclusion", () => {
  const rules = parseLocally(`Exclusion criteria
1. Haemoglobin below 10 g/dL.`);
  const healthy = PATIENTS.find((p) => p.labs.some((l) => l.name === "hgb" && l.value > 12))!;
  assert.equal(evaluate(healthy, rules, AS_OF)[0].verdict, "pass");
});

test("a duration criterion never degrades to a presence check", () => {
  const [rule] = parseLocally("Documented Type 2 Diabetes Mellitus for at least 5 years.");
  assert.equal(rule.op, "duration_gte");
  assert.equal(rule.min, 5);
  assert.notEqual(rule.op, "present");
});

test("RENAL-PROTECT fills every outcome bucket", () => {
  // The run that returned zero eligible did so because of an inverted rule,
  // not because the cohort had no matches.
  const rules = parseLocally(`Inclusion criteria
1. Age between 45 and 75 years.
2. Documented Type 2 Diabetes Mellitus for at least 5 years.
3. eGFR of at least 30 mL/min/1.73m2.
4. HbA1c between 7.0 and 11.0%.
5. On stable metformin therapy.

Exclusion criteria
6. Pregnancy.
7. Diagnosis of heart failure.
8. Currently taking any anticoagulant.
9. Haemoglobin below 10 g/dL.`);
  const results = screen(PATIENTS, rules, AS_OF);
  const n = (s: string) => results.filter((r) => r.status === s).length;
  assert.ok(n("eligible") > 0, `eligible bucket is empty`);
  assert.ok(n("review") > 0, `review bucket is empty`);
  assert.ok(n("excluded") > 0, `excluded bucket is empty`);
});

// --- Reviewer decisions ----------------------------------------------------

test("a reviewer decision moves the bucket but never rewrites the evidence", () => {
  const rules = RULES.filter((r) => r.enabled);
  const results = screen([patient("TS-0007")], rules, AS_OF);
  assert.equal(results[0].status, "review");

  const accepted = applyDecisions(results, [
    {
      runId: "run_x", patientId: "TS-0007", decision: "accepted", note: "",
      decidedByName: "Dana", decidedByEmail: "d@x", decidedAt: AS_OF,
    },
  ]);
  assert.equal(accepted[0].status, "eligible");
  // Score and checks are the engine's record and must survive the override.
  assert.equal(accepted[0].score, results[0].score);
  assert.deepEqual(accepted[0].checks, results[0].checks);
  assert.equal(accepted[0].flagged, 1);
});

test("'need more information' defers rather than deciding", () => {
  const rules = RULES.filter((r) => r.enabled);
  const results = screen([patient("TS-0007")], rules, AS_OF);
  const deferred = applyDecisions(results, [
    {
      runId: "run_x", patientId: "TS-0007", decision: "more_info", note: "",
      decidedByName: "Dana", decidedByEmail: "d@x", decidedAt: AS_OF,
    },
  ]);
  assert.equal(deferred[0].status, "review");
});

test("a decision for another patient leaves this one alone", () => {
  const rules = RULES.filter((r) => r.enabled);
  const results = screen(PATIENTS, rules, AS_OF);
  const after = applyDecisions(results, [
    {
      runId: "run_x", patientId: "TS-0007", decision: "excluded", note: "",
      decidedByName: "Dana", decidedByEmail: "d@x", decidedAt: AS_OF,
    },
  ]);
  const untouched = after.filter((r) => r.patientId !== "TS-0007");
  assert.deepEqual(
    untouched.map((r) => r.status),
    results.filter((r) => r.patientId !== "TS-0007").map((r) => r.status),
  );
});
