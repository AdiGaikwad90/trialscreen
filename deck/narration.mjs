/**
 * The spoken script, split into the beats the video is cut to.
 *
 * Each deck beat drives how long its slide is held, so the picture follows the
 * voice rather than the other way round. Written to be *spoken*: short
 * sentences, numbers spelled the way you would say them.
 */
export const INTRO = [
  { slide: 1, text:
    `This is TrialScreen. It's a working prototype for the part of a clinical trial that reliably runs late. Finding the patients.` },

  { slide: 2, text:
    `A protocol carries twenty to fifty eligibility criteria. To screen one patient, a coordinator opens the chart and checks it against every single one of them, by hand.
     Age. Diagnosis. Duration of that diagnosis. Lab values, and whether those labs are recent enough to count. Current medications.
     Then the next patient. Then the next.
     That is how a site spends six weeks getting to a cohort. And recruitment is the single biggest reason trials miss their timelines.
     This is the bottleneck. Not the science. The paperwork in front of the science.` },

  { slide: 3, text:
    `Three different people have to say yes to a tool like this, and they each want something different.
     The coordinator runs it every day, so for them it has to be faster than what they do now.
     The trial lead is paying for the delay, and wants to know which criterion is costing the most enrolment.
     And quality and regulatory have to be able to reconstruct any single decision, months later.
     Most A.I. screening tools are built for the first two. That is exactly why they never ship.` },

  { slide: 4, text:
    `Because this has been tried. The models are already good enough. The problem is what comes out of the other end. A verdict, with nothing behind it.
     A regulator cannot inspect a probability. And an investigator will not enrol a patient based on reasoning they are not allowed to check. Honestly, they shouldn't.
     So these tools stay in pilot. Forever. The technology was never the blocker. The missing audit trail is.` },

  { slide: 5, text:
    `So we split the job into three parts.
     A.I. reads the protocol and turns it into structured rules. A human approves those rules before a single patient is screened.
     Then a deterministic rule engine does the deciding. Pure TypeScript. No network call. No randomness. No model. The same inputs give the same answer, every time.
     Then A.I. writes the result up in plain language.
     The model never decides who is eligible. It translates English into rules at the front, and results back into English at the end. Everything in between is arithmetic you can re-derive by hand.` },

  { slide: 6, text:
    `Let me show you what that actually looks like.` },
];

/** One continuous read over the recorded app walkthrough. */
export const DEMO = [
  { text: `Here is a real protocol. Nine criteria, written for a human to read.` },
  { text: `I press one button, and the A.I. reads it.` },
  { text: `And this is the first thing that matters. Every rule shows the exact phrase from the protocol it came from. Nothing is paraphrased. Nothing is summarised.` },
  { text: `Look at criterion nine. Haemoglobin below ten is an exclusion. It is a reason to reject someone. So the rule the engine actually runs is haemoglobin greater than or equal to ten.` },
  { text: `That inversion sounds obvious. It is not. The model got it backwards during development, and it would have excluded forty-nine of fifty perfectly eligible patients. Silently. The system caught it, because it reads every criterion twice and compares the two readings.` },
  { text: `Now I screen the cohort.` },
  { text: `A hundred and fourteen milliseconds. Fifty patients, every criterion. That is the part that used to take six weeks.` },
  { text: `Nine eligible. Twenty-three that need a clinician to look. Eighteen ruled out. And underneath, which criterion is costing the enrolment. That is the question trial operations actually asks.` },
  { text: `Let's open one. This patient's H.B.A. one C is in range. But it was drawn four hundred and twenty-eight days ago, and the protocol window is ninety. So it is flagged, not failed.` },
  { text: `That distinction is everything. Missing or stale data raises a question. It never disqualifies anyone.` },
  { text: `Here is another. He is on Apixaban. Not Warfarin. Apixaban. Caught because the rule matches on drug class, not on a keyword.` },
  { text: `And every line shows the value it used, and where that value came from. This is the part a clinician can actually check.` },
  { text: `Now I am the coordinator. Cardiology has confirmed he can hold the anticoagulant for the washout period. So I accept him.` },
  { text: `The funnel moves. Nine becomes ten. And that decision is recorded against my name, and the time it was made.` },
  { text: `But notice what did not change. The evidence underneath is untouched. A human can override the outcome. Nobody can rewrite the record.` },
  { text: `And that is the conversation with regulatory. Every run, every decision, who made it, and when.` },
];

export const OUTRO = [
  { slide: 7, text:
    `Quickly, how it is built.
     The whole thing runs on one Cloudflare Worker. Next.js at the edge. No servers to manage, and nothing in the stack that bills per seat while it sits idle.
     Workers A.I. reads the protocol and writes the notes. D one stores every run, and every reviewer decision.
     And inside the Worker, behind that dashed line, is the rule engine. Pure functions. Twenty-nine tests. The only thing in the entire system that is allowed to produce a verdict.
     The trust boundary is not a policy document you promise to follow. It is a module.` },

  { slide: 8, text:
    `A hundred and fourteen milliseconds. Twenty-nine tests. No real patient data anywhere in the system.
     But the result I would actually point at is this one. Reading every criterion twice caught two real defects while we were building it.
     An exclusion read backwards. And a duration requirement, for at least five years, quietly dropped, which would have let in patients the protocol excludes.
     Both caught because a human was shown the disagreement, instead of a confident answer. That is the product, demonstrating itself.` },

  { slide: 9, text:
    `What you have seen is a prototype, on synthetic data. Production means real E.H.R. ingestion, multiple sites, single sign-on.
     But the plumbing was never the hard part. The hard part is whether a clinician can check the answer. And that is what this proves.
     Thank you.` },
];

/** Collapse the indented template literals into one spoken paragraph. */
export const clean = (t) => t.replace(/\s+/g, " ").trim();
