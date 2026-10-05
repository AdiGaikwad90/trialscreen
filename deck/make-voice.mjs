/**
 * Renders the narration to audio, one file per beat, and writes the measured
 * durations to out/voice/timing.json so the picture can be cut to the voice.
 *
 *   node deck/make-voice.mjs                    # macOS built-in voice
 *   ELEVENLABS_API_KEY=... node deck/make-voice.mjs   # ElevenLabs, if you have a key
 *
 * Tuning:
 *   VOICE=Samantha   macOS voice name (say -v '?' lists them)
 *   RATE=140         words per minute — lower is slower and clearer
 *   EL_VOICE_ID=...  ElevenLabs voice id
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INTRO, DEMO, OUTRO, clean } from "./narration.mjs";

const OUT = new URL("out/voice/", import.meta.url).pathname;
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.VOICE ?? "Daniel";
const RATE = process.env.RATE ?? "140";
// Adam — a deep, level read that suits a clinical pitch. Override with EL_VOICE_ID.
const EL_VOICE_ID = process.env.EL_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB";

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
const duration = (f) =>
  Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

async function renderElevenLabs(text, wav) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        // Steady and deliberate rather than performative — this is a product
        // walkthrough, not an advert.
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const mp3 = wav.replace(/\.wav$/, ".mp3");
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  sh("ffmpeg", ["-v", "error", "-y", "-i", mp3, "-ar", "48000", "-ac", "1", wav]);
  rmSync(mp3, { force: true });
}

function renderSay(text, wav) {
  const aiff = wav.replace(/\.wav$/, ".aiff");
  sh("say", ["-v", VOICE, "-r", RATE, "-o", aiff, text]);
  sh("ffmpeg", ["-v", "error", "-y", "-i", aiff, "-ar", "48000", "-ac", "1", wav]);
  rmSync(aiff, { force: true });
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  console.log(KEY ? `ElevenLabs · voice ${EL_VOICE_ID}` : `macOS say · ${VOICE} at ${RATE} wpm`);
  if (!KEY) console.log("(set ELEVENLABS_API_KEY to use a commercial voice instead)\n");

  const timing = { intro: [], demo: [], outro: [] };

  for (const [key, beats] of [["intro", INTRO], ["demo", DEMO], ["outro", OUTRO]]) {
    for (const [i, beat] of beats.entries()) {
      const id = `${key}-${String(i + 1).padStart(2, "0")}`;
      const wav = join(OUT, `${id}.wav`);
      const text = clean(beat.text);
      KEY ? await renderElevenLabs(text, wav) : renderSay(text, wav);

      // A beat of air after each line, so the next one does not tread on it.
      const padded = join(OUT, `${id}-p.wav`);
      sh("ffmpeg", ["-v", "error", "-y", "-i", wav, "-af", "apad=pad_dur=0.7", padded]);
      rmSync(wav, { force: true });

      const secs = duration(padded);
      timing[key].push({ id, file: padded, slide: beat.slide ?? null, seconds: secs });
      console.log(`  ${id}  ${secs.toFixed(1)}s`);
    }
  }

  const total = Object.values(timing).flat().reduce((n, b) => n + b.seconds, 0);
  writeFileSync(join(OUT, "timing.json"), JSON.stringify(timing, null, 2));
  console.log(`\n  total narration: ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}`);
  console.log("  timings → deck/out/voice/timing.json");
}

main().catch((e) => { console.error("\nFailed:", e.message); process.exit(1); });
