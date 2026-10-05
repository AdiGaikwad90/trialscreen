/**
 * Records the live-demo section of the pitch video.
 *
 * Drives the real app through the walkthrough and captures it to video, with
 * every pause timed to the matching line in SCRIPT.md — so the take is clean,
 * repeatable, and you only have to read over it.
 *
 *   npm run dev            # in the project root, first
 *   node deck/record-demo.mjs
 *
 * Output: deck/out/demo.webm (and demo.mp4 if ffmpeg is on PATH).
 */
import { chromium } from "playwright";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { CURSOR_SCRIPT } from "./cursor.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("out/", import.meta.url).pathname;
const W = 1600, H = 900;

const CRITERIA = `Inclusion criteria
1. Age between 45 and 75 years.
2. Documented Type 2 Diabetes Mellitus for at least 5 years.
3. eGFR of at least 30 mL/min/1.73m2.
4. HbA1c between 7.0 and 11.0%.
5. On stable metformin therapy.

Exclusion criteria
6. Pregnancy.
7. Diagnosis of heart failure.
8. Currently taking any anticoagulant.
9. Haemoglobin below 10 g/dL.`;

/**
 * Beat lengths in ms, sized so the finished take runs about 2:18 — the length of
 * the demo section in SCRIPT.md. Raise PACE if you speak slowly; the whole
 * recording scales with it.
 */
const PACE = Number(process.env.PACE ?? 2.2);
const B = (ms) => Math.round(ms * PACE);
const BEAT = {
  settle: B(1500),
  read: B(3200),   // a line of narration
  hold: B(4200),   // a line you want to land
  scroll: B(2400),
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Move the mouse before clicking, so the cursor is visible travelling to the
 *  control rather than teleporting — it reads as a person using the app. */
async function glide(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
  await wait(B(320));
}

async function click(page, locator) {
  await glide(page, locator);
  await locator.click();
}

async function main() {
  // Only clear this script's own output. Wiping the whole directory would take
  // the rendered narration and the deck segments with it.
  mkdirSync(OUT, { recursive: true });
  for (const f of ["demo.webm", "demo.mp4"]) rmSync(join(OUT, f), { force: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  // Playwright's screencast does not draw the pointer, so the demo would show
  // things happening with nothing visibly causing them.
  await page.addInitScript(CURSOR_SCRIPT);

  // The dev-server badge sits in the bottom-left corner of every frame.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.addInitScript(() => {
    const hide = () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal,#__next-build-watcher{display:none!important}";
      document.head?.append(s);
    };
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", hide)
      : hide();
  });

  const step = (n, msg) => console.log(`  ${String(n).padStart(2)} · ${msg}`);

  // --- sign in (trimmed out of the final cut, but the app needs a session) ---
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/screen/, { timeout: 30000 });
  await wait(BEAT.settle);

  // --- 1. the protocol -----------------------------------------------------
  step(1, "protocol pasted");
  await page.locator('input[placeholder="ADVANCE-T2D"]').fill("RENAL-PROTECT");
  // Typed rather than filled, so the criteria visibly arrive on camera.
  await page.locator("#criteria").click();
  await page.locator("#criteria").fill(CRITERIA);
  await wait(BEAT.hold);

  // --- 2. parse ------------------------------------------------------------
  step(2, "reading the criteria");
  const readBtn = page.getByRole("button", { name: /Read the criteria/ });
  await click(page, readBtn);
  await page.getByRole("heading", { name: /criteria found/ }).waitFor({ timeout: 120000 });
  await wait(BEAT.settle);

  // --- 3. the checklist, scrolled slowly -----------------------------------
  step(3, "checklist");
  const list = page.locator("ol").first();
  await list.hover();
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 120);
    await wait(B(420));
  }
  await wait(BEAT.read);

  // --- 4 & 5. rule 9, the inverted exclusion -------------------------------
  step(4, "rule 9 — the inverted exclusion");
  const rule9 = page.locator("ol > li").nth(8);
  await rule9.scrollIntoViewIfNeeded();
  await rule9.hover();
  await wait(BEAT.hold + BEAT.hold);

  // --- 6. screen -----------------------------------------------------------
  step(6, "screening the cohort");
  const screenBtn = page.getByRole("button", { name: /Screen 50 patients/ });
  await click(page, screenBtn);
  await page.waitForURL(/\/screen\/run_/, { timeout: 60000 });

  // --- 7 & 8. the funnel ---------------------------------------------------
  step(7, "results");
  await wait(BEAT.hold);
  await page.mouse.wheel(0, 260);
  await wait(BEAT.hold);

  // --- 9 & 10. stale data --------------------------------------------------
  step(9, "TS-0073 — stale lab");
  await page.mouse.wheel(0, 320);
  await wait(B(900));
  const t73 = page.getByRole("button", { name: 'Needs review', exact: false }).first();
  await page.getByRole("button", { name: /^Needs review/ }).last().click();
  await wait(B(1000));
  const row73 = page.locator("tbody tr", { hasText: "TS-0073" }).first();
  if (await row73.count()) {
    await click(page, row73);
    await wait(BEAT.settle);
    const sheet = page.locator('aside[aria-label^="Screening detail"]');
    await sheet.hover();
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 130); await wait(B(430)); }
    await wait(BEAT.hold);
    await page.keyboard.press("Escape");
    await wait(B(700));
  }

  // --- 11 to 15. class matching, then a decision ---------------------------
  step(11, "TS-0104 — class match, then accept");
  const row104 = page.locator("tbody tr", { hasText: "TS-0104" }).first();
  if (await row104.count()) {
    await click(page, row104);
    await wait(BEAT.settle);
    const sheet = page.locator('aside[aria-label^="Screening detail"]');
    await sheet.hover();
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 120); await wait(B(430)); }
    await wait(BEAT.read);

    const accept = page.getByRole("button", { name: /Accept for screening/ });
    await click(page, accept);
    await wait(BEAT.hold);          // the funnel moves 9 -> 10
    await page.keyboard.press("Escape");
    await wait(B(900));
    await page.mouse.wheel(0, -400);
    await wait(BEAT.hold);          // hold on the updated tiles
  }

  // --- 16. the audit trail -------------------------------------------------
  step(16, "audit log");
  // /login redirects an authenticated session straight back, so sign out first.
  await page.goto(`${BASE}/screen`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/, { timeout: 30000 });
  await page.getByRole("button", { name: /Ravi Menon/ }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/screen/, { timeout: 30000 });
  await page.goto(`${BASE}/audit`);
  await wait(BEAT.hold + BEAT.read);

  // Ask Playwright for the exact file it wrote. Scanning the directory for
  // "any .webm" once renamed a deck recording to demo.mp4, which put slides in
  // the middle of the finished video.
  const video = page.video();
  await context.close();
  await browser.close();

  const src = await video?.path();
  if (!src) throw new Error("no video was produced");
  renameSync(src, join(OUT, "demo.webm"));
  console.log(`\n  video: deck/out/demo.webm`);

  try {
    execFileSync("ffmpeg", [
      "-y", "-i", join(OUT, "demo.webm"),
      "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      join(OUT, "demo.mp4"),
    ], { stdio: "ignore" });
    console.log(`  video: deck/out/demo.mp4  (use this one)`);
  } catch {
    console.log("  ffmpeg not available — the .webm is fine, most editors take it.");
  }
}

main().catch((e) => {
  console.error("\nRecording failed:", e.message);
  console.error("Is the app running? `npm run dev` in the project root.");
  process.exit(1);
});
