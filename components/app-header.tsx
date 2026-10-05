import Link from "next/link";
import { logoutAction } from "@/app/actions";
import type { Session } from "@/lib/session";
import { Wordmark } from "./logo";

export function AppHeader({ session, context }: { session: Session; context?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/screen" className="shrink-0 rounded-md" aria-label="TrialScreen home">
          <Wordmark />
        </Link>
        {context && (
          <>
            <span aria-hidden className="hidden text-rule-strong sm:inline">
              /
            </span>
            <span className="hidden truncate text-[14px] text-ink-muted sm:inline">{context}</span>
          </>
        )}

        <nav className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
          <Link
            href="/screen"
            className="whitespace-nowrap rounded-md px-2 py-1.5 text-[14px] text-ink-muted transition-colors hover:bg-accent-wash hover:text-ink sm:px-3"
          >
            New
            <span className="hidden sm:inline"> screening</span>
          </Link>
          {session.role === "admin" && (
            <Link
              href="/audit"
              className="whitespace-nowrap rounded-md px-2 py-1.5 text-[14px] text-ink-muted transition-colors hover:bg-accent-wash hover:text-ink sm:px-3"
            >
              Audit
              <span className="hidden sm:inline"> log</span>
            </Link>
          )}
          <div className="mx-1 h-5 w-px bg-rule sm:mx-2" />
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[14px] font-medium">{session.name}</p>
            <p className="text-[12px] text-ink-muted">
              {session.role === "admin" ? "Trial lead" : "Clinical coordinator"}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ml-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[14px] text-ink-muted transition-colors hover:bg-accent-wash hover:text-ink sm:ml-2 sm:px-3"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
