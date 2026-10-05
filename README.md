# TrialScreen

Screen a patient cohort against clinical trial eligibility criteria, and show the evidence
behind every verdict.

Recruitment is the single largest source of trial delay: coordinators read each chart by
hand against 20–50 criteria, and a cohort takes weeks. AI tools exist, but they return a
verdict without a checkable basis, so investigators and regulators will not act on them.

TrialScreen splits the problem so that neither half has to be taken on trust:

```
eligibility criteria ──▶ [ Workers AI ] ──▶ rules ──▶ coordinator approves the checklist
                                                          │
                50 synthetic patients ──────────────────▶ [ RULE ENGINE — no AI ] ──▶ verdicts
                                                          │
                                              [ Workers AI ] ──▶ screening note
```

**The model translates. The engine decides.** Eligibility is produced by `lib/engine.ts` —
pure TypeScript, no I/O, no randomness, and no ambient clock. Every verdict names the value
it used, where that value came from, and why. The match score is arithmetic printed on the
screen next to the score.

Synthetic patient data throughout. No PHI is used, derived from, or stored anywhere.

A 6-minute narrated walkthrough is in [`demo_video/`](demo_video/), and the deck and video
production pipeline that produced it is in [`deck/`](deck/).

## Run it

```bash
npm install
npm run db:migrate:local   # creates the local D1 database and seeds the two demo accounts
npm run dev                # http://localhost:3000
```

Sign in as either demo persona — password `demo1234` for both:

| Account | Role | Sees |
| --- | --- | --- |
| `coordinator@trialscreen.demo` | Clinical coordinator | Screening and the review queue |
| `lead@trialscreen.demo` | Trial lead | The above, plus the audit log |

Then: **Use the ADVANCE-T2D example → Read the criteria → Screen 50 patients.**

Workers AI runs against Cloudflare even in local dev, so `npx wrangler login` first. Without
it the app still works: criteria fall back to the local parser and the UI says so.

```bash
npm test     # 19 assertions over the rule engine — the file that backs the trust claim
npm run lint
```

## Deploy

```bash
npx wrangler d1 create trialscreen        # paste database_id into wrangler.jsonc
npm run db:migrate                        # apply the schema remotely
npx wrangler secret put SESSION_SECRET     # replace the demo signing key
npm run deploy
```

## How it is built

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 App Router on Cloudflare Workers via `@opennextjs/cloudflare` |
| AI | Workers AI binding, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, JSON-schema mode |
| Database | D1 — demo accounts and the screening-run audit trail |
| Styling | Tailwind v4, design tokens only, IBM Plex Sans/Mono |
| Tests | `node:test` over the rule engine |

### Where the interesting decisions are

`lib/engine.ts` — the deterministic core.

- A **hard** criterion that fails excludes. A **review** criterion that fails only flags,
  because concomitant-medication rules are a clinician's call, not a parser's.
- **Missing data flags, it never fails.** No HbA1c on the chart is an open question, not a
  disqualification.
- **Stale data flags too.** A value inside the range but drawn outside the protocol window
  says so, with the day count.
- **Durations are computed** from the diagnosis date, never stored.
- **Drugs match on class**, so "no anticoagulants" catches Apixaban as well as Warfarin, and
  a discontinued one flags for washout rather than passing silently.

`lib/parse.ts` — **every criterion is read twice**, once by Workers AI and once by the
local parser. Where the two readings imply different cohorts, the checklist row turns amber,
shows both, and makes a human choose. Two invariants are enforced in code rather than asked
of the model, because it got both wrong in testing: inclusion vs exclusion comes from the
protocol's own headings, and a rule derived from an exclusion can never require the patient
to *have* the thing that disqualifies them.

Criteria are parsed **one at a time, in parallel**. One large constrained
decode takes ~33s and fails as a unit; twelve small ones take ~4s and fail independently, so
an unreadable line costs one line. Anything the model cannot map to a structured field comes
back as `unmapped`, switched off, and listed for manual verification — never silently
dropped.

`lib/parse-local.ts` — a bounded keyword parser that takes over whenever Workers AI is
unavailable, with a visible notice. The demo degrades honestly instead of dying.

`lib/score.ts` — `score = round(100 × (passed + 0.5 × flagged) / criteria)`. Deliberately
trivial, so the UI can print the working and a coordinator can re-derive it by hand.

`lib/decisions.ts` — a reviewer's call on a flagged patient moves them between buckets but
never rewrites the evidence: the criterion ledger, the checks and the score are the engine's
record and survive the override. "Need more information" defers rather than deciding.
Decisions are stored in D1 against a name and a timestamp, and appear in the export and the
audit log.

### Not in scope

Real EHR/FHIR ingestion, patient upload, self-service signup, multi-site trials, criterion
weighting. Production next steps, not hackathon scope.

## Licence

MIT — see [LICENSE](LICENSE).

The synthetic cohort in `lib/patients.ts` is generated by `scripts/generate-cohort.mjs`
from a fixed seed. It is not derived from, and does not reconstruct, any real patient
record.
