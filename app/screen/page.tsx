import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ProtocolSetup } from "@/components/protocol-setup";
import { requireSession } from "@/lib/session";
import { PATIENTS } from "@/lib/patients";

export const metadata: Metadata = {
  title: "Screen a cohort · TrialScreen",
  description: "Turn eligibility criteria into a checklist and screen a patient cohort against it.",
};

export default async function ScreenPage({ searchParams }: PageProps<"/screen">) {
  const session = await requireSession();
  const { denied } = await searchParams;

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        {denied && (
          <p role="alert" className="mb-6 rounded-md border border-fail/25 bg-fail-wash px-4 py-3 text-[14px] text-fail">
            The audit log is restricted to trial leads. You are signed in as a clinical coordinator.
          </p>
        )}
        <ProtocolSetup cohortSize={PATIENTS.length} />
      </main>
    </>
  );
}
