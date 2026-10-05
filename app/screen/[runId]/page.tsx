import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RunView } from "@/components/run-view";
import { requireSession } from "@/lib/session";
import { getRun } from "@/lib/runs";
import { applyDecisions, listDecisions } from "@/lib/decisions";
import { PATIENTS } from "@/lib/patients";

export const metadata: Metadata = {
  title: "Screening results · TrialScreen",
  description: "Ranked screening results with the evidence behind every verdict.",
};

export default async function RunPage({ params }: PageProps<"/screen/[runId]">) {
  const session = await requireSession();
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();

  // Human decisions move patients between buckets; the stored evidence and
  // scores behind them are never rewritten.
  const decisions = await listDecisions(runId);
  const results = applyDecisions(run.results, decisions);

  // Only what the table and sheet render — the chart itself never leaves the server.
  const patients = PATIENTS.map((p) => ({
    id: p.id,
    age: p.age,
    sex: p.sex,
    lastVisit: p.lastVisit,
  }));

  return (
    <>
      <AppHeader session={session} context={run.trialName} />
      <RunView
        runId={run.id}
        trialName={run.trialName}
        createdAt={run.createdAt}
        rules={run.rules}
        results={results}
        patients={patients}
        decisions={decisions}
        parsedBy={run.parsedBy}
      />
    </>
  );
}
