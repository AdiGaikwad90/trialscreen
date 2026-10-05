/**
 * Generates lib/patients.ts. Seeded, so the demo cohort is byte-identical on
 * every machine. Run with: node scripts/generate-cohort.mjs
 *
 * Synthetic data only. Value ranges follow published population distributions
 * for a type-2 diabetes clinic; no real record was consulted or derived from.
 */
import { writeFileSync } from "node:fs";

const AS_OF = "2026-09-18";
const SEED = 0x5eed_1a7e;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const num = (lo, hi, dp = 0) => Number((lo + rnd() * (hi - lo)).toFixed(dp));
const int = (lo, hi) => Math.floor(lo + rnd() * (hi - lo + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const chance = (p) => rnd() < p;

const daysAgo = (n) => new Date(Date.parse(AS_OF) - n * 86400000).toISOString().slice(0, 10);

const CONDITIONS = {
  T2DM: "Type 2 diabetes mellitus",
  HTN: "Essential hypertension",
  CKD3: "Chronic kidney disease, stage 3",
  CAD: "Coronary artery disease",
  HF: "Heart failure, reduced ejection fraction",
  AF: "Atrial fibrillation",
  OBESITY: "Obesity",
  RETINOPATHY: "Diabetic retinopathy",
  NEUROPATHY: "Diabetic peripheral neuropathy",
  HYPOTHYROID: "Hypothyroidism",
  ASTHMA: "Asthma",
  OSA: "Obstructive sleep apnoea",
};

const MEDS = {
  metformin: ["Metformin 1000mg BD", "Metformin XR 2000mg OD"],
  sulfonylurea: ["Gliclazide 80mg BD", "Glimepiride 4mg OD"],
  insulin: ["Insulin glargine 24u nocte", "Insulin degludec 30u nocte"],
  glp1: ["Semaglutide 1.0mg weekly", "Dulaglutide 1.5mg weekly"],
  sglt2: ["Empagliflozin 25mg OD", "Dapagliflozin 10mg OD"],
  anticoagulant: ["Warfarin 5mg OD", "Apixaban 5mg BD", "Rivaroxaban 20mg OD"],
  antiplatelet: ["Aspirin 75mg OD", "Clopidogrel 75mg OD"],
  statin: ["Atorvastatin 40mg OD", "Rosuvastatin 20mg OD"],
  acei: ["Ramipril 10mg OD", "Lisinopril 20mg OD"],
  arb: ["Losartan 100mg OD", "Candesartan 16mg OD"],
  beta_blocker: ["Bisoprolol 5mg OD", "Metoprolol 50mg BD"],
  diuretic: ["Indapamide 2.5mg OD", "Furosemide 40mg OD"],
  levothyroxine: ["Levothyroxine 100mcg OD"],
  ppi: ["Omeprazole 20mg OD"],
};

const med = (drugClass, { active = true, startedDaysAgo } = {}) => ({
  name: pick(MEDS[drugClass]),
  drugClass,
  startedOn: daysAgo(startedDaysAgo ?? int(120, 2600)),
  active,
});

const lab = (name, value, unit, drawnDaysAgo) => ({
  name, value, unit, drawnOn: daysAgo(drawnDaysAgo),
});

function generated(i) {
  const id = `TS-${String(200 + i * 3).padStart(4, "0")}`;
  const age = int(38, 68);
  const sex = chance(0.48) ? "F" : "M";
  const dmYears = num(0.8, 18, 1);

  const conditions = [
    { code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: daysAgo(Math.round(dmYears * 365.25)) },
  ];
  if (chance(0.62)) conditions.push({ code: "HTN", label: CONDITIONS.HTN, diagnosedOn: daysAgo(int(400, 5000)) });
  if (chance(0.18)) conditions.push({ code: "CKD3", label: CONDITIONS.CKD3, diagnosedOn: daysAgo(int(300, 2600)) });
  if (chance(0.14)) conditions.push({ code: "CAD", label: CONDITIONS.CAD, diagnosedOn: daysAgo(int(300, 4000)) });
  if (chance(0.07)) conditions.push({ code: "HF", label: CONDITIONS.HF, diagnosedOn: daysAgo(int(200, 2500)) });
  if (chance(0.09)) conditions.push({ code: "AF", label: CONDITIONS.AF, diagnosedOn: daysAgo(int(200, 3000)) });
  if (chance(0.21)) conditions.push({ code: "RETINOPATHY", label: CONDITIONS.RETINOPATHY, diagnosedOn: daysAgo(int(200, 2000)) });
  if (chance(0.17)) conditions.push({ code: "NEUROPATHY", label: CONDITIONS.NEUROPATHY, diagnosedOn: daysAgo(int(200, 2000)) });
  if (chance(0.12)) conditions.push({ code: "OSA", label: CONDITIONS.OSA, diagnosedOn: daysAgo(int(200, 2000)) });
  if (chance(0.11)) conditions.push({ code: "HYPOTHYROID", label: CONDITIONS.HYPOTHYROID, diagnosedOn: daysAgo(int(400, 4000)) });

  const hasAF = conditions.some((c) => c.code === "AF");
  const medications = [];
  if (chance(0.82)) medications.push(med("metformin"));
  if (chance(0.31)) medications.push(med("sulfonylurea"));
  if (chance(0.24)) medications.push(med("insulin"));
  if (chance(0.16)) medications.push(med("glp1"));
  if (chance(0.27)) medications.push(med("sglt2"));
  if (hasAF || chance(0.09)) medications.push(med("anticoagulant", { active: chance(0.8) }));
  if (chance(0.29)) medications.push(med("antiplatelet"));
  if (chance(0.66)) medications.push(med("statin"));
  if (chance(0.44)) medications.push(med(chance(0.5) ? "acei" : "arb"));
  if (chance(0.22)) medications.push(med("beta_blocker"));
  if (chance(0.19)) medications.push(med("diuretic"));
  if (chance(0.11)) medications.push(med("levothyroxine"));

  const labDrawn = int(4, 110);
  const labs = [
    lab("hba1c", num(6.9, 10.6, 1), "%", labDrawn),
    lab("egfr", num(41, 115, 0), "mL/min/1.73m²", int(5, 200)),
    lab("alt", num(10, 128, 0), "U/L", int(5, 200)),
    lab("hgb", num(9.8, 16.4, 1), "g/dL", int(5, 200)),
  ];
  // 6% of charts are missing a recent HbA1c — a real and common data gap.
  if (chance(0.06)) labs.shift();

  return {
    id,
    age,
    sex,
    conditions,
    medications,
    labs,
    vitals: { bmi: num(23, 43, 1), sbp: int(104, 178), dbp: int(62, 104) },
    ...(sex === "F" ? { pregnant: age < 50 && chance(0.05) } : {}),
    lastVisit: daysAgo(int(3, 340)),
  };
}

/** Hand-authored. Each one exists to demonstrate one engine behaviour on stage. */
const EDGE_CASES = [
  {
    _why: "Textbook match — every criterion passes",
    id: "TS-0142", age: 52, sex: "F",
    conditions: [
      { code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2022-03-10" },
      { code: "HTN", label: CONDITIONS.HTN, diagnosedOn: "2019-08-02" },
    ],
    medications: [med2("Metformin 1000mg BD", "metformin", "2022-04-01"), med2("Atorvastatin 40mg OD", "statin", "2021-02-11"), med2("Ramipril 10mg OD", "acei", "2020-01-09")],
    labs: [lab("hba1c", 8.2, "%", 21), lab("egfr", 88, "mL/min/1.73m²", 21), lab("alt", 28, "U/L", 21), lab("hgb", 13.4, "g/dL", 21)],
    vitals: { bmi: 31.2, sbp: 132, dbp: 80 }, pregnant: false, lastVisit: daysAgo(21),
  },
  {
    _why: "On warfarin — a soft criterion, so it flags for the investigator rather than auto-rejecting",
    id: "TS-0007", age: 61, sex: "M",
    conditions: [
      { code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2017-11-22" },
      { code: "AF", label: CONDITIONS.AF, diagnosedOn: "2021-05-30" },
    ],
    medications: [med2("Metformin XR 2000mg OD", "metformin", "2018-01-15"), med2("Warfarin 5mg OD", "anticoagulant", "2021-06-10"), med2("Bisoprolol 5mg OD", "beta_blocker", "2021-06-10")],
    labs: [lab("hba1c", 9.1, "%", 34), lab("egfr", 71, "mL/min/1.73m²", 34), lab("alt", 33, "U/L", 34), lab("hgb", 14.1, "g/dL", 34)],
    vitals: { bmi: 29.4, sbp: 138, dbp: 84 }, lastVisit: daysAgo(34),
  },
  {
    _why: "Age 66 against a 40–65 ceiling — excluded by one year",
    id: "TS-0031", age: 66, sex: "M",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2018-02-14" }],
    medications: [med2("Metformin 1000mg BD", "metformin", "2018-03-01"), med2("Empagliflozin 25mg OD", "sglt2", "2023-07-19")],
    labs: [lab("hba1c", 8.6, "%", 12), lab("egfr", 79, "mL/min/1.73m²", 12), lab("alt", 24, "U/L", 12), lab("hgb", 15.0, "g/dL", 12)],
    vitals: { bmi: 28.1, sbp: 129, dbp: 78 }, lastVisit: daysAgo(12),
  },
  {
    _why: "HbA1c 7.49 against a 7.5 floor — proves the boundary is evaluated, not eyeballed",
    id: "TS-0055", age: 47, sex: "F",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2021-09-04" }],
    medications: [med2("Metformin 1000mg BD", "metformin", "2021-10-01")],
    labs: [lab("hba1c", 7.49, "%", 9), lab("egfr", 96, "mL/min/1.73m²", 9), lab("alt", 19, "U/L", 9), lab("hgb", 12.9, "g/dL", 9)],
    vitals: { bmi: 33.8, sbp: 121, dbp: 76 }, pregnant: false, lastVisit: daysAgo(9),
  },
  {
    _why: "No HbA1c on the chart — missing data flags for review, it never fails",
    id: "TS-0068", age: 55, sex: "M",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2016-06-30" }],
    medications: [med2("Metformin 1000mg BD", "metformin", "2016-08-01"), med2("Gliclazide 80mg BD", "sulfonylurea", "2020-03-12")],
    labs: [lab("egfr", 83, "mL/min/1.73m²", 44), lab("alt", 41, "U/L", 44), lab("hgb", 14.6, "g/dL", 44)],
    vitals: { bmi: 30.5, sbp: 141, dbp: 86 }, lastVisit: daysAgo(44),
  },
  {
    _why: "HbA1c in range but drawn 14 months ago — stale data flags for a repeat draw",
    id: "TS-0073", age: 58, sex: "F",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2015-01-19" }],
    medications: [med2("Metformin 1000mg BD", "metformin", "2015-02-20"), med2("Dapagliflozin 10mg OD", "sglt2", "2022-11-03")],
    labs: [lab("hba1c", 8.4, "%", 428), lab("egfr", 74, "mL/min/1.73m²", 38), lab("alt", 30, "U/L", 38), lab("hgb", 13.1, "g/dL", 38)],
    vitals: { bmi: 34.1, sbp: 136, dbp: 82 }, pregnant: false, lastVisit: daysAgo(38),
  },
  {
    _why: "Anticoagulant discontinued — flags to confirm washout rather than passing silently",
    id: "TS-0081", age: 63, sex: "M",
    conditions: [
      { code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2014-04-08" },
      { code: "AF", label: CONDITIONS.AF, diagnosedOn: "2019-02-11" },
    ],
    medications: [med2("Metformin 1000mg BD", "metformin", "2014-05-02"), { name: "Apixaban 5mg BD", drugClass: "anticoagulant", startedOn: "2019-03-01", active: false }],
    labs: [lab("hba1c", 7.8, "%", 27), lab("egfr", 68, "mL/min/1.73m²", 27), lab("alt", 26, "U/L", 27), lab("hgb", 14.2, "g/dL", 27)],
    vitals: { bmi: 27.6, sbp: 133, dbp: 79 }, lastVisit: daysAgo(27),
  },
  {
    _why: "eGFR 44.6 against a floor of 45 — the engine does not round in the sponsor's favour",
    id: "TS-0090", age: 60, sex: "F",
    conditions: [
      { code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2013-07-25" },
      { code: "CKD3", label: CONDITIONS.CKD3, diagnosedOn: "2021-10-04" },
    ],
    medications: [med2("Insulin glargine 24u nocte", "insulin", "2020-01-15"), med2("Metformin 1000mg BD", "metformin", "2013-08-30")],
    labs: [lab("hba1c", 9.4, "%", 16), lab("egfr", 44.6, "mL/min/1.73m²", 16), lab("alt", 22, "U/L", 16), lab("hgb", 11.8, "g/dL", 16)],
    vitals: { bmi: 32.0, sbp: 144, dbp: 88 }, pregnant: false, lastVisit: daysAgo(16),
  },
  {
    _why: "Pregnant — a hard exclusion, no judgement call",
    id: "TS-0096", age: 34, sex: "F",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2021-02-18" }],
    medications: [med2("Insulin degludec 30u nocte", "insulin", "2024-06-01")],
    labs: [lab("hba1c", 8.0, "%", 11), lab("egfr", 104, "mL/min/1.73m²", 11), lab("alt", 17, "U/L", 11), lab("hgb", 11.9, "g/dL", 11)],
    vitals: { bmi: 29.0, sbp: 118, dbp: 72 }, pregnant: true, lastVisit: daysAgo(11),
  },
  {
    _why: "On apixaban — caught by drug class, which keyword matching on 'warfarin' would miss",
    id: "TS-0104", age: 57, sex: "M",
    conditions: [
      { code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2018-12-01" },
      { code: "AF", label: CONDITIONS.AF, diagnosedOn: "2023-04-17" },
    ],
    medications: [med2("Metformin XR 2000mg OD", "metformin", "2019-01-10"), med2("Apixaban 5mg BD", "anticoagulant", "2023-05-02"), med2("Rosuvastatin 20mg OD", "statin", "2019-01-10")],
    labs: [lab("hba1c", 8.9, "%", 19), lab("egfr", 81, "mL/min/1.73m²", 19), lab("alt", 35, "U/L", 19), lab("hgb", 15.1, "g/dL", 19)],
    vitals: { bmi: 30.9, sbp: 135, dbp: 83 }, lastVisit: daysAgo(19),
  },
  {
    _why: "Diagnosed 19 months ago against a 2-year minimum — duration is computed, not stored",
    id: "TS-0119", age: 44, sex: "F",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2025-02-01" }],
    medications: [med2("Metformin 1000mg BD", "metformin", "2025-02-20")],
    labs: [lab("hba1c", 8.7, "%", 14), lab("egfr", 99, "mL/min/1.73m²", 14), lab("alt", 21, "U/L", 14), lab("hgb", 13.0, "g/dL", 14)],
    vitals: { bmi: 35.4, sbp: 126, dbp: 81 }, pregnant: false, lastVisit: daysAgo(14),
  },
  {
    _why: "ALT 168 U/L, over 3× the upper limit of normal — a hard hepatic exclusion",
    id: "TS-0127", age: 49, sex: "M",
    conditions: [{ code: "T2DM", label: CONDITIONS.T2DM, diagnosedOn: "2019-05-06" }],
    medications: [med2("Metformin 1000mg BD", "metformin", "2019-06-01"), med2("Omeprazole 20mg OD", "ppi", "2023-02-14")],
    labs: [lab("hba1c", 9.6, "%", 23), lab("egfr", 92, "mL/min/1.73m²", 23), lab("alt", 168, "U/L", 23), lab("hgb", 14.9, "g/dL", 23)],
    vitals: { bmi: 36.7, sbp: 147, dbp: 91 }, lastVisit: daysAgo(23),
  },
];

function med2(name, drugClass, startedOn) {
  return { name, drugClass, startedOn, active: true };
}

const cohort = [...EDGE_CASES, ...Array.from({ length: 50 - EDGE_CASES.length }, (_, i) => generated(i))];

const body = cohort
  .map((p) => {
    const { _why, ...rest } = p;
    const comment = _why ? `  // ${_why}\n` : "";
    return comment + "  " + JSON.stringify(rest);
  })
  .join(",\n");

writeFileSync(
  "lib/patients.ts",
  `// GENERATED by scripts/generate-cohort.mjs — do not edit by hand.
// 50 synthetic patients, seeded so the demo is identical on every machine.
// No real patient data was used, derived from, or reconstructed here.
import type { Patient } from "./types";

/** The date every screening run is evaluated against. Fixed so results are reproducible. */
export const AS_OF = "${AS_OF}";

export const PATIENTS: Patient[] = [
${body},
];
`,
);

console.log(`wrote lib/patients.ts — ${cohort.length} patients`);
