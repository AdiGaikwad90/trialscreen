# Getting an ElevenLabs key

The renderer already speaks to their API. It only needs a key.

## 1. Create the account

Go to **elevenlabs.io** → *Sign up*. Google or email both work. No card is required for the
free tier.

## 2. Copy the API key

Click your avatar, bottom-left → **API Keys** → *Create API Key*. Name it anything, leave
the permissions at their defaults, create it, and copy the value. It starts with `sk_` and
is shown **once** — if you lose it, delete it and make another.

Direct link once you are signed in: **elevenlabs.io/app/settings/api-keys**

## 3. Use it

```bash
export ELEVENLABS_API_KEY=sk_...

node deck/make-voice.mjs        # renders the narration with ElevenLabs
node deck/record-deck.mjs       # re-cuts the slides to the new timings
./deck/build-video.sh           # → deck/out/trialscreen-pitch.mp4
```

The demo segment does not need re-recording — only the narration and the slide holds change.

## Will the free tier cover it?

The script is about **6,000 characters**. The free tier gives 10,000 credits a month and one
character is one credit, so a single full render fits with room to spare. A second full
re-render in the same month would not — if you want to audition several voices, do it on a
sentence first:

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" \
  -d '{"text":"Recruitment is where trials stall.","model_id":"eleven_multilingual_v2"}' \
  --output /tmp/audition.mp3 && afplay /tmp/audition.mp3
```

Swap the id in the URL to try another voice.

## Choosing a voice

The default is **Adam** — low, level, unhurried, which suits a clinical pitch. Others worth
auditioning, all on the free tier:

| Voice | ID | Character |
|---|---|---|
| Adam *(default)* | `pNInz6obpgDQGcFmaJgB` | Deep, measured, neutral American |
| Antoni | `ErXwobaYiN019PkySvjV` | Warmer, slightly brighter |
| Rachel | `21m00Tcm4TlvDq8ikWAM` | Calm, clear, female |
| Bill | `pqHfZKP75CvOlQylNhV4` | Older, authoritative, documentary |

```bash
EL_VOICE_ID=pqHfZKP75CvOlQylNhV4 node deck/make-voice.mjs
```

The settings in `make-voice.mjs` are tuned for steadiness rather than performance —
`stability: 0.55`, `style: 0.15`. Raise `style` if it sounds too flat for you; lower
`stability` if it sounds too uniform.

## A free alternative, if you would rather not sign up

macOS ships neural voices that are a large step up from the default, and they cost nothing:

System Settings → Accessibility → Spoken Content → System Voice → **Manage Voices** →
download an English *(Premium)* voice. Ava, Zoe, Evan and Serena are the strongest.

```bash
VOICE="Ava (Premium)" RATE=140 node deck/make-voice.mjs
node deck/record-deck.mjs && ./deck/build-video.sh
```
