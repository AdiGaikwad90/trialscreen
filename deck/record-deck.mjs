/**
 * Records the deck as two video segments, held on each slide for exactly as
 * long as SCRIPT.md gives that slide.
 *
 *   node deck/record-deck.mjs
 *
 * Output: deck/out/deck-intro.mp4  (slides 1-6, before the demo)
 *         deck/out/deck-outro.mp4  (slides 7-9, after it)
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const OUT = new URL("out/", import.meta.url).pathname;
const DECK = new URL("index.html?staged=1", import.meta.url).href;
const W = 1600, H = 900;

/**
 * Slide holds, in seconds.
 *
 * If the narration has been rendered (node deck/make-voice.mjs) each slide is
 * held for exactly as long as its line takes to say, so the picture is cut to
 * the voice. Otherwise these fall back to the timings written in SCRIPT.md.
 */
function holds() {
  try {
    const t = JSON.parse(readFileSync(new URL("out/voice/timing.json", import.meta.url), "utf8"));
    const map = (beats) => beats.map((b) => ({ slide: b.slide, hold: b.seconds }));
    console.log("holds: cut to the rendered narration\n");
    // The final slide keeps three seconds of air after the last word.
    const outro = map(t.outro);
    outro[outro.length - 1].hold += 3;
    return { INTRO: map(t.intro), OUTRO: outro };
  } catch {
    console.log("holds: from SCRIPT.md (no narration rendered yet)\n");
    return {
      INTRO: [
        { slide: 1, hold: 12 }, { slide: 2, hold: 50 }, { slide: 3, hold: 33 },
        { slide: 4, hold: 37 }, { slide: 5, hold: 43 }, { slide: 6, hold: 7 },
      ],
      OUTRO: [{ slide: 7, hold: 45 }, { slide: 8, hold: 35 }, { slide: 9, hold: 23 }],
    };
  }
}
const { INTRO, OUTRO } = holds();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function segment(name, beats) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  // Not "load": the Google Fonts stylesheet can hang, and the deck is perfectly
  // usable before it resolves. Give the webfont a moment, then carry on.
  await page.goto(DECK, { waitUntil: "domcontentloaded" });
  await page.evaluate(() =>
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]),
  );
  // Hide the progress bar and slide counter — presenter chrome, not video.
  await page.keyboard.press("h");
  await wait(600);

  for (const { slide, hold } of beats) {
    await page.evaluate((n) => window.deckGo(n), slide);
    const points = await page.evaluate(() => window.deckCount());
    console.log(`  slide ${slide} · ${hold.toFixed(1)}s · ${points} reveals`);

    // Spread the reveals across the slide so each point arrives roughly as the
    // narration reaches it, rather than all inside the first second.
    // The first lands immediately; the rest fill the first three quarters of
    // the hold, leaving the slide whole while the line finishes.
    const span = hold * 1000 * 0.72;
    const gap = points > 1 ? span / (points - 1) : 0;

    await page.evaluate(() => window.deckNext());
    let elapsed = 0;
    for (let n = 1; n < points; n++) {
      await wait(gap);
      elapsed += gap;
      await page.evaluate(() => window.deckNext());
    }
    await wait(Math.max(0, hold * 1000 - elapsed));
  }

  // Ask Playwright for the exact file it wrote rather than scanning for a
  // stray .webm — guessing is how a deck take once ended up as the demo.
  const video = page.video();
  await context.close();
  await browser.close();

  const written = await video?.path();
  if (!written) throw new Error("no video produced for " + name);
  const src = join(OUT, `${name}.webm`);
  renameSync(written, src);

  try {
    execFileSync("ffmpeg", [
      "-y", "-i", src,
      "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      join(OUT, `${name}.mp4`),
    ], { stdio: "ignore" });
    console.log(`  → deck/out/${name}.mp4`);
  } catch {
    console.log(`  → deck/out/${name}.webm (ffmpeg missing)`);
  }
}

mkdirSync(OUT, { recursive: true });
console.log("intro (slides 1-6)");
await segment("deck-intro", INTRO);
console.log("outro (slides 7-9)");
await segment("deck-outro", OUTRO);
console.log("\ndone");
