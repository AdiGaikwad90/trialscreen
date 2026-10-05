# TrialScreen — recording guide

Two windows, one cut between them: `deck/index.html` for slides 1–5, the live app for
the demo, back to the deck for slides 7–9. Target length **6 to 7 minutes**.

## Before you hit record

- `npm run dev` in the project root, signed in as `coordinator@trialscreen.demo`
- Have the RENAL-PROTECT criteria on your clipboard (bottom of this file)
- Deck open in a second window, press `F` for fullscreen, `H` to hide the slide chrome
- Browser at 1440×900 or wider so the results table is not cramped
- The deck loads IBM Plex from Google Fonts — **be online**, or the type falls back to
  your system sans

## Deck controls

| Key | Does |
|---|---|
| `→` `space` | Next slide |
| `←` | Previous |
| `R` | **Replay the current slide's animation** — retake a line without reloading |
| `H` | Hide the progress bar and slide counter |
| `F` | Fullscreen |
| `1`–`9` | Jump to a slide |

---

## Talk track

### 1 · Cover — 15s
> This is TrialScreen. It's a working prototype for the part of a clinical trial that
> reliably runs late: finding the patients.

Pause on the title. Let the subtitle land before you move.

### 2 · The bottleneck — 60s
Press `R` as you start talking so the checkmarks and the week counter run under your voice.

> A protocol carries twenty to fifty eligibility criteria. To screen one patient, a
> coordinator opens the chart and checks it against every single one, by hand. Then the
> next patient. Then the next.
>
> That's how a site spends six weeks getting to a cohort. And recruitment is the biggest
> single reason trials miss their timelines — this is the bottleneck, not the science.

*If your team has a verified figure for delay cost, drop it in here. I deliberately left
the slide working without one.*

### 3 · Who it's for — 40s
> Three people have to say yes to a tool like this, and they want different things.
>
> The coordinator runs it every day. The trial lead is paying for the delay and wants to
> know which criterion is costing the most enrolment. And quality and regulatory have to be
> able to reconstruct any decision, months later.
>
> Most AI screening tools are built for the first two. That's why they don't ship.

### 4 · Why AI hasn't fixed it — 45s
> This has been tried. The models are good enough. The problem is what comes out: a verdict
> with nothing behind it.
>
> A regulator can't inspect a probability. An investigator won't enrol a patient on
> reasoning they're not allowed to check — and honestly, they shouldn't. So the tools stay
> in pilot forever.

Let the **NOT ACCEPTED** stamp land before the last line.

### 5 · The wedge — 45s
> So we split the job in three.
>
> AI reads the protocol and turns it into structured rules — and a human approves those
> rules before anyone is screened. Then a deterministic rule engine does the deciding. Pure
> TypeScript, no network, no randomness. Same inputs, same answer, every time. Then AI
> writes the result up in plain language.
>
> The model never decides who is eligible. It translates at the front and at the back.
> Everything in between is arithmetic you can re-derive by hand.

This is the sentence the pitch rests on. Slow down.

### 6 · Handoff → switch to the live app — 3 min

**1. Paste and parse.** Paste the criteria, name it RENAL-PROTECT, press *Read the criteria*.
> Nine criteria, about five seconds.

**2. The checklist.**
> Every rule shows the exact phrase from the protocol it came from. Nothing is paraphrased.

**3. Rule 9 — the one to point at.**
> "Haemoglobin below 10" is an *exclusion*. So the rule the engine runs is haemoglobin
> greater than or equal to 10. It's inverted, correctly. Get that backwards and you exclude
> every healthy patient in the cohort — and that's exactly the bug this cross-check caught
> during the build.

**4. Screen.** Press *Screen 50 patients*.
> A hundred and fourteen milliseconds. That's the whole cohort, every criterion.

**5. The funnel.**
> Nine eligible, twenty-three that need a clinician, eighteen out. And underneath — which
> criterion is actually costing the enrolment. That's the question trial operations asks.

**6. TS-0073.**
> Her HbA1c is in range. But it was drawn 428 days ago and the protocol window is 90. So
> it's flagged, not failed. Missing and stale data raise a question — they never
> disqualify. That distinction is what makes a clinician trust the output.

**7. TS-0104 and a decision.**
> He's on Apixaban. Not Warfarin — Apixaban. Caught because the rule matches on drug
> *class*, not a keyword. Now: I'm the coordinator, cardiology has confirmed the washout,
> so — *Accept for screening*.

Point at the funnel moving 9 → 10.
> That decision is recorded against my name and the time. And notice the evidence below
> didn't change. A human can override the bucket; nobody can rewrite the record.

**8. Export and audit.** Open the CSV header, then sign in as the trial lead and open the
audit log.
> Every run: who, when, which criteria, what came back. That's the conversation with QA.

### 7 · Architecture — 60s
Back to the deck.
> One Cloudflare Worker runs the whole thing — Next.js at the edge, no servers.
>
> Workers AI reads the protocol and writes the notes. D1 stores every run and every
> decision. And inside the Worker, behind that dashed line, is the rule engine: pure
> functions, twenty-nine tests, and the only thing in the system that produces a verdict.
>
> The trust boundary isn't a policy document. It's a module.

### 8 · What it proves — 45s
> A hundred and fourteen milliseconds. Twenty-nine tests. No real patient data anywhere.
>
> But the number I'd point at is this one. Reading every criterion twice caught two real
> defects during the build. An exclusion read backwards, which would have silently excluded
> forty-nine of fifty eligible patients. And a duration requirement quietly dropped.
>
> Both caught because a human was shown the disagreement instead of a confident answer.
> That's the product demonstrating itself.

### 9 · End note — 30s
> What's here is a prototype on synthetic data. Production means real EHR ingestion,
> multi-site, SSO.
>
> But the hard part isn't the plumbing — it's whether a clinician can check the answer.
> That's what this proves.

---

## RENAL-PROTECT criteria (clipboard)

```
Inclusion criteria
1. Age between 45 and 75 years.
2. Documented Type 2 Diabetes Mellitus for at least 5 years.
3. eGFR of at least 30 mL/min/1.73m2.
4. HbA1c between 7.0 and 11.0%.
5. On stable metformin therapy.

Exclusion criteria
6. Pregnancy.
7. Diagnosis of heart failure.
8. Currently taking any anticoagulant.
9. Haemoglobin below 10 g/dL.
```

Expected: 9 rules, no conflicts, **9 eligible · 23 review · 18 not eligible**.

## If the demo misbehaves

- **Parse takes longer than usual** — Workers AI latency varies. Keep talking; the
  checklist arrives. If it falls back to the local parser you get a visible banner, and it
  is worth saying out loud: the tool degrades honestly rather than failing.
- **A criterion shows an amber "read two different ways"** — that is a feature, not a
  glitch. Say so and pick the correct reading on camera. It is a better moment than a clean
  parse.
