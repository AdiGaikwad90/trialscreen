#!/usr/bin/env bash
# Assembles the finished pitch video.
#
#   node deck/make-voice.mjs      # narration  → out/voice/
#   node deck/record-deck.mjs     # slides, cut to that narration
#   node deck/record-demo.mjs     # the live app
#   ./deck/build-video.sh         # → out/trialscreen-pitch.mp4
#
# Pass a file to narrate it yourself instead:
#   ./deck/build-video.sh my-voice.m4a
set -euo pipefail
cd "$(dirname "$0")/out"

for f in deck-intro.mp4 demo.mp4 deck-outro.mp4; do
  [ -f "$f" ] || { echo "missing $f — run the record-*.mjs scripts first"; exit 1; }
done

dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

VOICE="${1:-}"

if [ -z "$VOICE" ]; then
  [ -f voice/timing.json ] || { echo "no narration — run: node deck/make-voice.mjs"; exit 1; }

  # Join each segment's beats, and hold the last frame of the matching picture
  # until that segment's narration finishes — so a line never runs on over the
  # wrong slide.
  for seg in intro demo outro; do
    node -e "const t=require('./voice/timing.json'),fs=require('fs');fs.writeFileSync('a-$seg.txt',t['$seg'].map(b=>\"file '\"+b.file+\"'\").join('\n')+'\n')"
    ffmpeg -v error -y -f concat -safe 0 -i "a-$seg.txt" -c pcm_s16le "seg-$seg.wav"
  done

  # Fit each segment's picture to its narration, in both directions. The demo's
  # length is dominated by Workers AI latency, which swings by tens of seconds
  # run to run, so a fixed pace cannot hold it in sync. Padding clones the last
  # frame; trimming only ever removes the static hold at the end of a segment,
  # never content.
  for pair in "intro:deck-intro" "demo:demo" "outro:deck-outro"; do
    seg="${pair%%:*}"; vid="${pair##*:}"
    A=$(dur "seg-$seg.wav"); V=$(dur "$vid.mp4")
    TARGET=$(python3 -c "print(round($A + 0.4, 2))")
    if python3 -c "import sys; sys.exit(0 if $V < $TARGET else 1)"; then
      PAD=$(python3 -c "print(round($TARGET - $V, 2))")
      ffmpeg -v error -y -i "$vid.mp4" -vf "tpad=stop_mode=clone:stop_duration=$PAD" \
        -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "fit-$seg.mp4"
      HOW="padded"
    else
      ffmpeg -v error -y -i "$vid.mp4" -t "$TARGET" \
        -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "fit-$seg.mp4"
      HOW="trimmed"
    fi
    printf "%-6s picture %6.1fs → %6.1fs (%s)   voice %6.1fs\n" \
      "$seg" "$V" "$(dur "fit-$seg.mp4")" "$HOW" "$A"
  done

  printf "file '%s'\n" fit-intro.mp4 fit-demo.mp4 fit-outro.mp4 > v.txt
  printf "file '%s'\n" seg-intro.wav seg-demo.wav seg-outro.wav > a.txt
  ffmpeg -v error -y -f concat -safe 0 -i v.txt -c copy picture.mp4
  ffmpeg -v error -y -f concat -safe 0 -i a.txt -c pcm_s16le voice-track.wav
  VOICE=voice-track.wav
else
  [ -f "$VOICE" ] || { echo "no such audio file: $VOICE"; exit 1; }
  printf "file '%s'\n" deck-intro.mp4 demo.mp4 deck-outro.mp4 > v.txt
  ffmpeg -v error -y -f concat -safe 0 -i v.txt -c copy picture.mp4
fi

echo "picture $(dur picture.mp4 | cut -d. -f1)s · voice $(dur "$VOICE" | cut -d. -f1)s"

# Order matters: shape first, then set the level. Normalising before the
# compressor is what left the last cut at -22 LUFS instead of -14.
ffmpeg -v error -y -i picture.mp4 -i "$VOICE" \
  -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=6[v];
                   [1:a]highpass=f=85,
                        acompressor=threshold=-20dB:ratio=3:attack=10:release=200:makeup=2,
                        loudnorm=I=-14:TP=-1.5:LRA=7[a]" \
  -map "[v]" -map "[a]" -shortest \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -ar 48000 \
  trialscreen-pitch.mp4

rm -f v.txt a.txt a-*.txt fit-*.mp4 picture.mp4
echo "final → deck/out/trialscreen-pitch.mp4  ($(dur trialscreen-pitch.mp4 | cut -d. -f1)s)"

# Publish a new numbered version rather than overwriting what is already there,
# so an earlier cut is never lost to a re-render.
PUB="../../demo_video"
mkdir -p "$PUB"
N=1
while [ -e "$PUB/trialscreen-demo-updated-$N.mp4" ]; do N=$((N + 1)); done
cp trialscreen-pitch.mp4 "$PUB/trialscreen-demo-updated-$N.mp4"
echo "published → demo_video/trialscreen-demo-updated-$N.mp4"
