"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Decision, Rule } from "@/lib/types";
import { clearDecision, saveDecision } from "@/lib/decisions";
import { parseCriteria } from "@/lib/parse";
import { screen } from "@/lib/score";
import { PATIENTS, AS_OF } from "@/lib/patients";
import { newRunId, saveRun } from "@/lib/runs";
import { requireSession, signIn, signOut } from "@/lib/session";

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return "Enter your email and password.";

  const session = await signIn(email, password);
  if (!session) return "That email and password do not match an account.";
  redirect("/screen");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}

export async function parseAction(criteriaText: string) {
  await requireSession();
  if (!criteriaText.trim()) throw new Error("Paste the eligibility criteria first.");
  return parseCriteria(criteriaText);
}

export async function decideAction(input: {
  runId: string;
  patientId: string;
  decision: Decision | null;
  note?: string;
}): Promise<void> {
  const session = await requireSession();

  if (input.decision === null) {
    await clearDecision(input.runId, input.patientId);
  } else {
    await saveDecision({
      runId: input.runId,
      patientId: input.patientId,
      decision: input.decision,
      note: (input.note ?? "").trim().slice(0, 500),
      decidedByName: session.name,
      decidedByEmail: session.email,
      decidedAt: new Date().toISOString(),
    });
  }

  revalidatePath(`/screen/${input.runId}`);
}

export async function screenAction(input: {
  trialName: string;
  criteriaText: string;
  rules: Rule[];
  parsedBy: "ai" | "local";
}): Promise<never> {
  const session = await requireSession();

  const results = screen(PATIENTS, input.rules, AS_OF);
  const run = await saveRun({
    id: newRunId(),
    trialName: input.trialName,
    criteriaText: input.criteriaText,
    rules: input.rules,
    results,
    parsedBy: input.parsedBy,
    operatorEmail: session.email,
    operatorName: session.name,
    createdAt: new Date().toISOString(),
  });

  redirect(`/screen/${run.id}`);
}
