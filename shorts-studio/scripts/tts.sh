#!/usr/bin/env bash
# Free, fully local text-to-speech with Piper (https://github.com/OHF-Voice/piper1-gpl).
# Voices are downloaded once from Hugging Face (rhasspy/piper-voices, free) into ~/.cache/piper-voices.
#
# Usage:
#   scripts/tts.sh <text-file|-> <output.wav> [voice] [length-scale]
#     voice         default en_US-joe-medium (dataset CC0, safe for commercial use)
#     length-scale  <1 = faster speech. Shorts pace: 0.85-0.95 (default 0.9)
#
# Voice licences differ per dataset. Check docs/FREE-TOOLS.md before choosing another voice.
# Recommended permissive voices: en_US-joe-medium (CC0), en_US-libritts_r-medium (CC BY 4.0, credit the dataset).
set -euo pipefail
[ $# -ge 2 ] || { sed -n 2,12p "$0"; exit 2; }
TEXT="$1"; OUT="$2"; VOICE="${3:-en_US-joe-medium}"; SCALE="${4:-0.9}"
command -v piper >/dev/null || { echo "piper missing: run scripts/setup.sh" >&2; exit 1; }
CACHE="${PIPER_VOICES:-$HOME/.cache/piper-voices}"; mkdir -p "$CACHE"
MODEL="$CACHE/$VOICE.onnx"
if [ ! -s "$MODEL" ]; then
  # en_US-joe-medium -> en/en_US/joe/medium/en_US-joe-medium.onnx
  IFS=- read -r LOCALE NAME QUALITY <<<"$VOICE"
  BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/${LOCALE%%_*}/$LOCALE/$NAME/$QUALITY/$VOICE"
  echo "Downloading free voice $VOICE (one time) ..." >&2
  curl -fsSL "$BASE.onnx" -o "$MODEL.part" && mv "$MODEL.part" "$MODEL"
  curl -fsSL "$BASE.onnx.json" -o "$MODEL.json"
fi
mkdir -p "$(dirname "$OUT")"
if [ "$TEXT" = "-" ]; then INPUT=$(cat); else INPUT=$(cat "$TEXT"); fi
printf '%s\n' "$INPUT" | piper -m "$MODEL" -c "$MODEL.json" -f "$OUT.raw.wav" \
  --length-scale "$SCALE" --sentence-silence 0.15 >/dev/null 2>&1
# Trim edge silence, gentle loudness normalization for Shorts (-16 LUFS), 48 kHz mono.
ffmpeg -v error -y -i "$OUT.raw.wav" \
  -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -ar 48000 -ac 1 "$OUT"
rm -f "$OUT.raw.wav"
printf 'Voice-over: %s (%.2fs, voice %s)\n' "$OUT" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")" "$VOICE"
