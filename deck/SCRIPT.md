# TrialScreen — video script

**Target 7:00.** Written at ~150 words per minute, which is a calm presenting pace. Word
counts are per section so you can re-time if you speak faster or slower.

Read the **VOICE** column. The **SCREEN** column is what should be visible while you say it.
Anything in _italics_ is direction, not narration.

---

## 0:00 – 0:12 · Cover (30 words)

| VOICE | SCREEN |
|---|---|
| This is TrialScreen. It's a working prototype for the part of a clinical trial that reliably runs late — finding the patients. | Deck slide 1. Hold still. Let the title sit for a beat before you speak. |

---

## 0:12 – 1:02 · The bottleneck (122 words)

_Press `R` as you begin. The checkmarks tick off and the week counter climbs under your voice._

| VOICE | SCREEN |
|---|---|
| A protocol carries twenty to fifty eligibility criteria. To screen one patient, a coordinator opens the chart and checks it against every single one of them. By hand. | Slide 2. Ticks running down the chart card. |
| Age. Diagnosis. Duration of diagnosis. Lab values, and whether those labs are recent enough to count. Current medications. Then the next patient. Then the next. | Counter climbing 1 → 6 weeks. |
| That is how a site spends six weeks getting to a cohort. And recruitment is the single biggest reason trials miss their timelines. | Hold on "6 weeks". |
| This is the bottleneck. Not the science — the paperwork in front of the science. | — |

---

## 1:02 – 1:35 · Who it's for (81 words)

| VOICE | SCREEN |
|---|---|
| Three different people have to say yes to a tool like this, and they want different things. | Slide 3. |
| The coordinator runs it every day — for them it has to be faster than what they do now. The trial lead is paying for the delay, and wants to know which criterion is costing the most enrolment. | _Optional: gesture at the first two cards._ |
| And quality and regulatory have to be able to reconstruct any single decision, months later. | Third card. |
| Most AI screening tools are built for the first two. That's exactly why they don't ship. | — |

---

## 1:35 – 2:12 · Why AI hasn't fixed it (93 words)

| VOICE | SCREEN |
|---|---|
| Because this has been tried. The models are already good enough. The problem is what comes out the other end — a verdict, with nothing behind it. | Slide 4. Black box visible. |
| A regulator cannot inspect a probability. And an investigator will not enrol a patient based on reasoning they're not allowed to check. Honestly, they shouldn't. | _Stamp lands here._ |
| So these tools stay in pilot. Forever. The technology isn't the blocker — the missing audit trail is. | Hold on the stamp. |

---

## 2:12 – 2:55 · The wedge (108 words)

| VOICE | SCREEN |
|---|---|
| So we split the job into three parts. | Slide 5. |
| AI reads the protocol and turns it into structured rules. A human approves those rules before a single patient is screened. | Left box. |
| Then a deterministic rule engine does the deciding. Pure TypeScript. No network call, no randomness, no model. The same inputs give the same answer, every time. | Centre box — the lavender one. |
| Then AI writes the result up in plain language. | Right box. |
| **The model never decides who is eligible.** It translates English into rules at the front, and results back into English at the end. Everything in between is arithmetic you can re-derive by hand. | Punch line on screen. _Slow down here. This is the sentence the whole pitch rests on._ |

---

## 2:55 – 3:02 · Handoff (17 words)

| VOICE | SCREEN |
|---|---|
| Let me show you what that actually looks like. | Slide 6, then **cut to the app**. |

---

## 3:02 – 5:20 · Live demo (330 words)

_If you use `record-demo.mjs`, this section is already captured and timed — you are reading
over it. The timings below match that recording._

| # | VOICE | SCREEN |
|---|---|---|
| 1 | Here's a real protocol — RENAL-PROTECT. Nine criteria, written for a human to read. | Criteria pasted, cursor near *Read the criteria*. |
| 2 | I press one button, and the AI reads it. | Click *Read the criteria*. **~5s of parsing — keep talking.** |
| 3 | And this is the first thing that matters. Every rule shows the exact phrase from the protocol it came from. Nothing is paraphrased, nothing is summarised. | Checklist appears. Scroll slowly. |
| 4 | Look at criterion nine. "Haemoglobin below ten" is an *exclusion* — it's a reason to reject someone. So the rule the engine actually runs is haemoglobin **greater than or equal to** ten. | Highlight rule 9, `hgb ≥ 10`. |
| 5 | That inversion sounds obvious. It isn't. The model got it backwards during development, and it would have excluded forty-nine of fifty perfectly eligible patients — silently. The system caught it because it reads every criterion twice and compares. | Hold on rule 9. |
| 6 | Now I screen the cohort. | Click *Screen 50 patients*. |
| 7 | A hundred and fourteen milliseconds. Fifty patients, every criterion. That's the part that used to take six weeks. | Results land. Hold on the KPI tiles. |
| 8 | Nine eligible, twenty-three that need a clinician to look, eighteen ruled out. And underneath — *which* criterion is costing the enrolment. That's the question trial operations actually asks. | Funnel, then attrition list. |
| 9 | Let's open one. This patient's HbA1c is in range — but it was drawn four hundred and twenty-eight days ago, and the protocol window is ninety. So it's flagged, not failed. | Open TS-0073, scroll the ledger. |
| 10 | That distinction is everything. Missing or stale data raises a question. It never disqualifies anyone. | Hold on the amber row. |
| 11 | Here's another. He's on Apixaban — not Warfarin, Apixaban. Caught because the rule matches on drug *class*, not a keyword. | Open TS-0104. |
| 12 | And every line shows the value it used and where that value came from. This is the bit a clinician can actually check. | Scroll the ledger. |
| 13 | Now I'm the coordinator. Cardiology has confirmed he can hold the anticoagulant for the washout. So — accept. | Click *Accept for screening*. |
| 14 | The funnel moves. Nine becomes ten. And that decision is recorded against my name and the time it was made. | Funnel updates 9 → 10. |
| 15 | But notice what did *not* change — the evidence underneath is untouched. A human can override the outcome. Nobody can rewrite the record. | Ledger still showing the flag. |
| 16 | And that's the conversation with regulatory. Every run, every decision, who made it and when. | Audit log. |

---

## 5:20 – 6:05 · Architecture (109 words)

| VOICE | SCREEN |
|---|---|
| Quickly, how it's built. | Back to deck, slide 7. |
| The whole thing runs on one Cloudflare Worker. Next.js at the edge — no servers to manage, and nothing in the stack that bills per seat while it sits idle. | Worker box. |
| Workers AI reads the protocol and writes the notes. D1 stores every run and every reviewer decision. | Right-hand services. |
| And inside the Worker, behind that dashed line, is the rule engine. Pure functions. Twenty-nine tests. The only thing in the entire system that is allowed to produce a verdict. | Trust boundary. |
| The trust boundary isn't a policy document you promise to follow. It's a module. | Hold. |

---

## 6:05 – 6:40 · What it proves (91 words)

| VOICE | SCREEN |
|---|---|
| A hundred and fourteen milliseconds. Twenty-nine tests. No real patient data anywhere in the system. | Slide 8, KPI row. |
| But the result I'd actually point at is this one. Reading every criterion twice caught two real defects while we were building it. | Defect list. |
| An exclusion read backwards. And a duration requirement — "for at least five years" — quietly dropped, which would have let in patients the protocol excludes. | — |
| Both caught because a human was shown the disagreement, instead of a confident answer. That's the product demonstrating itself. | Hold. |

---

## 6:40 – 7:00 · Close (56 words)

| VOICE | SCREEN |
|---|---|
| What you've seen is a prototype on synthetic data. Production means real EHR ingestion, multiple sites, single sign-on. | Slide 9. |
| But the plumbing was never the hard part. The hard part is whether a clinician can check the answer — and that's what this proves. | Punch line. |
| Thank you. | Hold on the final slide for three seconds before you stop recording. |

---

**Total ≈ 1,037 words ≈ 6:55 at 150 wpm.**

## Pace notes

- The two places to deliberately slow down: *"The model never decides who is eligible"*
  (2:40) and *"It's a module"* (6:00). Both are the point.
- The parse step takes about five seconds of real time. Lines 2–3 of the demo section are
  written to cover exactly that gap — don't rush them and land in silence.
- If you run long, cut the "Who it's for" section to its first and last line. It's the most
  compressible 30 seconds in the script.
