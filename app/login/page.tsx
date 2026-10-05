import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Sign in · TrialScreen",
  description: "Sign in to screen a patient cohort against trial eligibility criteria.",
};

/** A real fragment of the product, so the work is visible before the form is. */
// Lightened verdict tints: the page tokens are tuned for ink on paper and go
// muddy on this dark panel.
const SAMPLE = [
  { glyph: "✓", tone: "#7fc39f", rule: "Age 40–65 years", observed: "52 y", source: "demographics" },
  { glyph: "✓", tone: "#7fc39f", rule: "Type 2 diabetes for ≥ 2 years", observed: "4y 6m", source: "dx 2022-03-10" },
  { glyph: "⚠", tone: "#e3b667", rule: "No anticoagulants", observed: "Warfarin 5mg OD", source: "active medications" },
];

export default async function LoginPage() {
  if (await getSession()) redirect("/screen");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-ink p-12 text-paper lg:flex">
        <span className="inline-flex items-center gap-2.5">
          <Logo className="h-[26px] w-[26px] shrink-0" inverted />
          <span className="text-[15.5px] font-semibold tracking-[-0.02em]">TrialScreen</span>
        </span>

        <div className="max-w-md">
          <h2 className="text-[34px] font-semibold leading-[1.15] tracking-tight">
            Eligibility screening that shows its working.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-paper/65">
            AI reads the protocol. A deterministic rule engine decides. Every verdict
            names the value it used and where that value came from.
          </p>

          <div className="mt-10 rounded-lg border border-paper/15 bg-paper/[0.04] p-5">
            <p className="id text-paper/45">TS-0007 · 11 criteria</p>
            <dl className="mt-4 space-y-3.5">
              {SAMPLE.map((row) => (
                <div key={row.rule} className="flex gap-3">
                  <span aria-hidden style={{ color: row.tone }} className="text-[15px] leading-6">
                    {row.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[14px] leading-6">{row.rule}</dt>
                    <dd className="text-[13px] leading-5 text-paper/50">
                      observed {row.observed} · {row.source}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="text-[13px] text-paper/40">
          Synthetic patient records. No real patient data is used anywhere in this demo.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <LoginForm />
      </section>
    </main>
  );
}
