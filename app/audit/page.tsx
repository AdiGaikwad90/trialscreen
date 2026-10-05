import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/session";
import { listRuns } from "@/lib/runs";
import { formatRunTime } from "@/lib/display";

export const metadata: Metadata = {
  title: "Audit log · TrialScreen",
  description: "Every screening run, who ran it, and what it returned.",
};

export default async function AuditPage() {
  const session = await requireRole("admin");
  const runs = await listRuns();

  return (
    <>
      <AppHeader session={session} context="Audit log" />
      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-[28px] font-semibold tracking-tight">Audit log</h1>
        <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-muted">
          Every screening run is recorded with the criteria as they were supplied, the operator who
          ran them, and the counts returned. Open any run to see the exact rules and results it
          produced, along with any decisions a reviewer recorded against it — nothing is
          recomputed.
        </p>

        <div className="mt-8 overflow-x-auto rounded-lg border border-rule bg-surface">
          <table className="w-full min-w-[900px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-rule text-left text-[13px] text-ink-muted">
                <th scope="col" className="px-4 py-2.5 font-medium">Run</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Trial</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Run by</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Criteria read by</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Screened</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Eligible</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Review</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Not eligible</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Decisions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-rule last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/screen/${run.id}`} className="block">
                      <span className="id text-accent underline-offset-4 hover:underline">{run.id}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-muted">
                        {formatRunTime(run.createdAt)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{run.trialName}</td>
                  <td className="px-4 py-3">
                    {run.operatorName}
                    <span className="mt-0.5 block text-[13px] text-ink-muted">{run.operatorEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {run.parsedBy === "ai" ? "Workers AI" : "Local parser"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{run.counts.screened}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-pass">{run.counts.eligible}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-flag">{run.counts.review}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-fail">{run.counts.excluded}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                    {run.decisions || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {runs.length === 0 && (
            <p className="px-4 py-10 text-center text-[14px] text-ink-muted">
              No screening runs yet.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
