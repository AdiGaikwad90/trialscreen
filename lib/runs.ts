import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Result, Rule, Run } from "./types";
import { PATIENTS, AS_OF } from "./patients";
import { parseLocally } from "./parse-local";
import { screen } from "./score";
import { EXAMPLE_CRITERIA, EXAMPLE_TRIAL } from "./protocol";

/** Row shape as stored in D1. */
interface RunRow {
  id: string;
  trial_name: string;
  criteria_text: string;
  rules_json: string;
  results_json: string;
  parsed_by: "ai" | "local";
  operator_email: string;
  operator_name: string;
  created_at: string;
  screened: number;
  eligible: number;
  review: number;
  excluded: number;
}

const db = () => getCloudflareContext().env.DB;

function toRun(row: RunRow): Run {
  return {
    id: row.id,
    trialName: row.trial_name,
    criteriaText: row.criteria_text,
    rules: JSON.parse(row.rules_json) as Rule[],
    results: JSON.parse(row.results_json) as Result[],
    parsedBy: row.parsed_by,
    operatorEmail: row.operator_email,
    operatorName: row.operator_name,
    createdAt: row.created_at,
    counts: {
      screened: row.screened,
      eligible: row.eligible,
      review: row.review,
      excluded: row.excluded,
    },
  };
}

export function countsOf(results: Result[]) {
  return {
    screened: results.length,
    eligible: results.filter((r) => r.status === "eligible").length,
    review: results.filter((r) => r.status === "review").length,
    excluded: results.filter((r) => r.status === "excluded").length,
  };
}

export async function saveRun(run: Omit<Run, "counts">): Promise<Run> {
  const counts = countsOf(run.results);
  await db()
    .prepare(
      `INSERT OR IGNORE INTO screening_runs
        (id, trial_name, criteria_text, rules_json, results_json, parsed_by,
         operator_email, operator_name, created_at, screened, eligible, review, excluded)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      run.id, run.trialName, run.criteriaText,
      JSON.stringify(run.rules), JSON.stringify(run.results), run.parsedBy,
      run.operatorEmail, run.operatorName, run.createdAt,
      counts.screened, counts.eligible, counts.review, counts.excluded,
    )
    .run();
  return { ...run, counts };
}

export async function getRun(id: string): Promise<Run | null> {
  const row = await db()
    .prepare("SELECT * FROM screening_runs WHERE id = ?")
    .bind(id)
    .first<RunRow>();
  return row ? toRun(row) : null;
}

/** Audit log. Summary columns only — the heavy JSON stays out of the list query. */
export async function listRuns(): Promise<(Omit<Run, "rules" | "results"> & { decisions: number })[]> {
  await seedHistory();
  const { results } = await db()
    .prepare(
      `SELECT r.id, r.trial_name, r.criteria_text, r.parsed_by, r.operator_email,
              r.operator_name, r.created_at, r.screened, r.eligible, r.review, r.excluded,
              (SELECT COUNT(*) FROM review_decisions d WHERE d.run_id = r.id) AS decisions
         FROM screening_runs r ORDER BY r.created_at DESC LIMIT 100`,
    )
    .all<Omit<RunRow, "rules_json" | "results_json"> & { decisions: number }>();

  return results.map((row) => ({
    id: row.id,
    trialName: row.trial_name,
    criteriaText: row.criteria_text,
    parsedBy: row.parsed_by,
    operatorEmail: row.operator_email,
    operatorName: row.operator_name,
    createdAt: row.created_at,
    decisions: row.decisions,
    counts: {
      screened: row.screened,
      eligible: row.eligible,
      review: row.review,
      excluded: row.excluded,
    },
  }));
}

export function newRunId(): string {
  return "run_" + crypto.randomUUID().replaceAll("-", "").slice(0, 10);
}

/**
 * An empty audit log tells a reviewer nothing. Backfill three historical runs
 * so the panel opens with a history — computed by the same engine as a live
 * run, so nothing in it is fabricated. Fixed ids plus INSERT OR IGNORE make
 * this idempotent, so it does not matter how many real runs already exist.
 */
async function seedHistory(): Promise<void> {
  const history = [
    { trial: EXAMPLE_TRIAL, criteria: EXAMPLE_CRITERIA, daysAgo: 9, by: ["Dana Okafor", "coordinator@trialscreen.demo"] },
    {
      trial: "ADVANCE-T2D",
      criteria: EXAMPLE_CRITERIA.replace("between 40 and 65 years", "between 45 and 70 years"),
      daysAgo: 6,
      by: ["Ravi Menon", "lead@trialscreen.demo"],
    },
    {
      trial: "RENAL-PROTECT",
      criteria: `Inclusion criteria
1. Age between 45 and 75 years.
2. Documented Type 2 Diabetes Mellitus for at least 5 years.
3. eGFR of at least 30 mL/min/1.73m2.
4. HbA1c between 7.0 and 11.0%.

Exclusion criteria
5. Pregnancy.
6. Diagnosis of heart failure.`,
      daysAgo: 2,
      by: ["Dana Okafor", "coordinator@trialscreen.demo"],
    },
  ];

  for (const [i, h] of history.entries()) {
    const rules = parseLocally(h.criteria);
    const results = screen(PATIENTS, rules, AS_OF);
    await saveRun({
      id: `run_seed${i + 1}`,
      trialName: h.trial,
      criteriaText: h.criteria,
      rules,
      results,
      parsedBy: "local",
      operatorName: h.by[0],
      operatorEmail: h.by[1],
      createdAt: new Date(Date.parse(AS_OF) - h.daysAgo * 86_400_000).toISOString(),
    });
  }
}
