import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Decision, Result, ReviewDecision, Status } from "./types";

const db = () => getCloudflareContext().env.DB;

interface DecisionRow {
  run_id: string;
  patient_id: string;
  decision: Decision;
  note: string;
  decided_by_name: string;
  decided_by_email: string;
  decided_at: string;
}

const toDecision = (r: DecisionRow): ReviewDecision => ({
  runId: r.run_id,
  patientId: r.patient_id,
  decision: r.decision,
  note: r.note,
  decidedByName: r.decided_by_name,
  decidedByEmail: r.decided_by_email,
  decidedAt: r.decided_at,
});

export async function listDecisions(runId: string): Promise<ReviewDecision[]> {
  const { results } = await db()
    .prepare("SELECT * FROM review_decisions WHERE run_id = ? ORDER BY decided_at DESC")
    .bind(runId)
    .all<DecisionRow>();
  return results.map(toDecision);
}

export async function saveDecision(d: ReviewDecision): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO review_decisions
         (run_id, patient_id, decision, note, decided_by_name, decided_by_email, decided_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (run_id, patient_id) DO UPDATE SET
         decision = excluded.decision,
         note = excluded.note,
         decided_by_name = excluded.decided_by_name,
         decided_by_email = excluded.decided_by_email,
         decided_at = excluded.decided_at`,
    )
    .bind(d.runId, d.patientId, d.decision, d.note, d.decidedByName, d.decidedByEmail, d.decidedAt)
    .run();
}

export async function clearDecision(runId: string, patientId: string): Promise<void> {
  await db()
    .prepare("DELETE FROM review_decisions WHERE run_id = ? AND patient_id = ?")
    .bind(runId, patientId)
    .run();
}

export async function countDecisions(runId: string): Promise<number> {
  const row = await db()
    .prepare("SELECT COUNT(*) AS n FROM review_decisions WHERE run_id = ?")
    .bind(runId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * A human decision overrides the engine's bucket, but never its evidence: the
 * criterion checks and the score are untouched, so the ledger still shows what
 * the record actually said and why it was raised in the first place.
 *
 * "Need more information" stays in review — it is a deferral, not a verdict.
 */
const DECIDED_STATUS: Record<Decision, Status | null> = {
  accepted: "eligible",
  excluded: "excluded",
  more_info: null,
};

export function applyDecisions(results: Result[], decisions: ReviewDecision[]): Result[] {
  if (!decisions.length) return results;
  const byPatient = new Map(decisions.map((d) => [d.patientId, d]));

  return results.map((r) => {
    const d = byPatient.get(r.patientId);
    if (!d) return r;
    const status = DECIDED_STATUS[d.decision];
    return status ? { ...r, status } : r;
  });
}
