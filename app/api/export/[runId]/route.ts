import { getRun } from "@/lib/runs";
import { applyDecisions, listDecisions } from "@/lib/decisions";
import { DECISION_LABEL } from "@/components/verdict";
import { requireSession } from "@/lib/session";
import { structuredForm } from "@/lib/display";

/**
 * One row per patient per criterion — the long format a monitor can pivot,
 * under a header block that records who ran what, when, and against which
 * criteria. That header is the audit trail; the rows are the evidence.
 */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(_request: Request, { params }: RouteContext<"/api/export/[runId]">) {
  await requireSession();
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) return new Response("No such screening run", { status: 404 });

  const decisions = await listDecisions(runId);
  const decisionByPatient = new Map(decisions.map((d) => [d.patientId, d]));
  const results = applyDecisions(run.results, decisions);
  const ruleById = new Map(run.rules.map((r) => [r.id, r]));

  const header = [
    ["TrialScreen screening report"],
    ["Run id", run.id],
    ["Trial", run.trialName],
    ["Run at", run.createdAt],
    ["Run by", `${run.operatorName} <${run.operatorEmail}>`],
    ["Criteria read by", run.parsedBy === "ai" ? "Workers AI, reviewed by operator" : "Local parser, reviewed by operator"],
    ["Verdicts produced by", "Deterministic rule engine"],
    ["Screened", run.counts.screened],
    ["Eligible at screening", run.counts.eligible],
    ["Needs review at screening", run.counts.review],
    ["Not eligible at screening", run.counts.excluded],
    ["Reviewer decisions recorded", decisions.length],
    [],
    ["Eligibility criteria as supplied"],
    ...run.criteriaText.split(/\r?\n/).map((l) => [l]),
    [],
    ["Criterion", "Source text", "Rule", "Severity", "Screened automatically"],
    ...run.rules.map((r) => [
      r.label,
      r.sourceText,
      r.enabled ? structuredForm(r) : "—",
      r.severity === "hard" ? "excludes" : "flags",
      r.enabled ? "yes" : "no, verify by hand",
    ]),
    [],
    ...(decisions.length
      ? [
          ["Reviewer decisions"],
          ["patient_id", "decision", "note", "decided_by", "decided_at"],
          ...decisions.map((d) => [
            d.patientId,
            DECISION_LABEL[d.decision],
            d.note,
            `${d.decidedByName} <${d.decidedByEmail}>`,
            d.decidedAt,
          ]),
          [],
        ]
      : []),
    ["patient_id", "rank", "score", "outcome", "reviewer_decision", "criterion", "verdict", "required", "observed", "source", "reason"],
  ];

  const rows = results.flatMap((result, i) =>
    result.checks.map((c) => [
      result.patientId,
      i + 1,
      result.score,
      result.status,
      decisionByPatient.has(result.patientId)
        ? DECISION_LABEL[decisionByPatient.get(result.patientId)!.decision]
        : "",
      ruleById.get(c.ruleId)?.label ?? c.ruleId,
      c.verdict,
      c.expected,
      c.observed,
      c.source,
      c.reason ?? "",
    ]),
  );

  const csv = [...header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trialscreen-${run.trialName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${run.id}.csv"`,
    },
  });
}
