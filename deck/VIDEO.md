# Making the video

Four commands produce the finished, narrated video.

```bash
npm run dev                   # in the project root, leave it running
node deck/make-voice.mjs      # renders the narration → deck/out/voice/
node deck/record-deck.mjs     # slides, each held for exactly as long as its line
node deck/record-demo.mjs     # drives the live app and records it
./deck/build-video.sh         # → deck/out/trialscreen-pitch.mp4
```

The picture is cut to the voice, not the other way round: `record-deck.mjs` reads the
measured length of each spoken line and holds that slide for precisely that long, and
`build-video.sh` freezes the last frame of any segment whose narration runs slightly
longer. Output is **6:36, 1600×900, H.264/AAC, −14 LUFS**.

## Choosing the voice

The default is the macOS built-in voice, which is clear but audibly synthetic. Two ways to
improve it, in order of effort:

**Download a Premium macOS voice — free, two minutes, a big step up.**
System Settings → Accessibility → Spoken Content → System Voice → Manage Voices. Download
one of the *(Premium)* or *(Enhanced)* English voices — Ava, Zoe, Evan and Serena are the
strongest — then:

```bash
VOICE="Ava (Premium)" RATE=140 node deck/make-voice.mjs
node deck/record-deck.mjs && ./deck/build-video.sh
```

**Use ElevenLabs.** The renderer already speaks to their API; it only needs a key.
See `ELEVENLABS.md` for how to get one — it takes about two minutes and the free tier
covers a full render.

```bash
ELEVENLABS_API_KEY=sk_... node deck/make-voice.mjs
node deck/record-deck.mjs && ./deck/build-video.sh
```

`EL_VOICE_ID` picks the voice (the default is Adam, a level, low read). About 6,000
characters of narration, which is inside the free tier.

**Or narrate it yourself** — play `deck/out/silent-cut.mp4` and read `SCRIPT.md` over it:

```bash
./deck/build-video.sh ~/Desktop/voice.m4a
```

## Pace and clarity

`RATE` is words per minute for the macOS voice. 140 is deliberate and clear; drop to 130 if
it still feels quick. The audio chain is a high-pass at 85 Hz to clear rumble, gentle
compression so quiet phrases stay audible, then normalisation to −14 LUFS — slightly hotter
than the −16 streaming standard, so it plays loud in a meeting room.

## What each piece runs to

| Segment | Length | Script section |
|---|---|---|
| `deck-intro.mp4` | 3:03 | Cover through the demo handoff (slides 1–6) |
| `demo.mp4` | 2:31 | The live app |
| `deck-outro.mp4` | 1:44 | Architecture, evidence, close (slides 7–9) |
| **`silent-cut.mp4`** | **7:17** | Everything |

## Adjusting the pace

The demo recording scales with one number:

```bash
PACE=2.6 node deck/record-demo.mjs   # slower, more room to talk
PACE=1.8 node deck/record-demo.mjs   # tighter
```

Deck timings live in the `INTRO` and `OUTRO` arrays at the top of `record-deck.mjs`, in
seconds per slide. They match the timings in `SCRIPT.md` — change both together.

## Recording your voice

Nothing fancy is needed. QuickTime Player → File → New Audio Recording, or Voice Memos.
Three things matter more than the microphone:

- **A quiet room with soft furnishings.** Room echo is the one thing you cannot fix later.
- **A consistent distance** from the mic — about a hand's width, slightly off to the side
  so plosives don't thump.
- **Leave two seconds of silence** at the start. It gives `loudnorm` a noise floor to read
  and gives you a clean handle for trimming.

Record it in one take against the silent cut. If you fluff a line, pause, and say it again
— it is far easier to cut a retake out of one continuous file than to stitch takes.

## If you would rather present it live

Skip all of this. Open `deck/index.html`, press `F`, and drive it yourself with the
shot list in `RECORDING-GUIDE.md`. The recorded demo exists to make the screen half
repeatable, not to replace you.
