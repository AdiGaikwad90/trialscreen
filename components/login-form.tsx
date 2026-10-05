"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions";

const PERSONAS = [
  { email: "coordinator@trialscreen.demo", name: "Dana Okafor", role: "Clinical coordinator", blurb: "Runs screenings and works the review queue." },
  { email: "lead@trialscreen.demo", name: "Ravi Menon", role: "Trial lead", blurb: "Also sees the audit log of every run." },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6Z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24Z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8Z" />
    </svg>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-md bg-accent text-[15px] font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [error, formAction] = useActionState(loginAction, null);
  const [email, setEmail] = useState("coordinator@trialscreen.demo");
  const [password, setPassword] = useState("demo1234");
  const [ssoNote, setSsoNote] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-[15px] text-ink-muted">
        Screening runs are recorded against your name.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-ink-muted">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border border-rule bg-surface px-3 text-[15px] outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-[13px] font-medium text-ink-muted">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-md border border-rule bg-surface px-3 text-[15px] outline-none focus:border-accent"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-fail-wash px-3 py-2 text-[14px] text-fail">
            {error}
          </p>
        )}

        <SubmitButton />
      </form>

      <div className="mt-5 flex items-center gap-3 text-[13px] text-ink-faint">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>

      <button
        type="button"
        onClick={() => setSsoNote(true)}
        className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-rule bg-surface text-[15px] font-medium transition-colors hover:border-rule-strong"
      >
        <GoogleMark />
        Continue with Google
      </button>
      {ssoNote && (
        <p className="mt-2 text-[13px] text-ink-muted">
          Single sign-on is configured per site during onboarding. Use a demo account below.
        </p>
      )}

      <div className="mt-8 rounded-lg border border-rule bg-surface p-4">
        <p className="text-[13px] font-medium text-ink-muted">Demo accounts</p>
        <div className="mt-3 space-y-2">
          {PERSONAS.map((p) => (
            <button
              key={p.email}
              type="button"
              onClick={() => {
                setEmail(p.email);
                setPassword("demo1234");
              }}
              className={`block w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                email === p.email ? "border-accent bg-accent-wash" : "border-rule hover:border-rule-strong"
              }`}
            >
              <span className="text-[14px] font-medium">{p.name}</span>
              <span className="ml-2 text-[13px] text-ink-muted">{p.role}</span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">{p.blurb}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-faint">
          Password for both accounts is <span className="id">demo1234</span>.
        </p>
      </div>
    </div>
  );
}
