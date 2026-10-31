#!/usr/bin/env bash
# Rebuilds the free Shorts toolchain in a fresh Claude Code Web container (they are ephemeral).
# Everything installed here is free/open source; no account, key or credit is used.
set -uo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$*"; }
step "Hypit CLI (npm, free)";        command -v hypit >/dev/null || npm install --global @hypit/hypit@0.3.1
step "Project packages";             npm install --no-audit --no-fund >/dev/null && (cd packages/battle-map && npx tsc -p tsconfig.json) && (cd packages/shorts-kinetic && npx tsc -p tsconfig.json)
step "Runtime profile";              hypit runtime use hypit.runtime.json >/dev/null
step "Sound kit (FFmpeg synthesis)"; [ -f assets/music/war-drone.wav ] || scripts/make-sound-kit.sh >/dev/null
step "yt-dlp (optional)";            hypit download prepare >/dev/null 2>&1 || echo "yt-dlp preparation failed (only needed for link downloads)"
step "Local speech recogniser (faster-whisper small, ~0.5 GB + Python env ~5 GB, one time)"
# NLTK refuses proxied fetches unless the operator opts in; HF Xet host is blocked here, so use the classic path.
NLTK_ALLOW_PROXIED_URLOPEN=1 HF_HUB_DISABLE_XET=1 hypit programs prepare --endpoint whisperx.local >/tmp/whisperx-prepare.log 2>&1 \
  || echo "Note: WhisperX alignment model is blocked by this network (download.pytorch.org); scripts/shorts.py align only needs the recogniser."
PY="$HOME/.local/state/hypit/programs/whisperx-whisperx.local-127.0.0.1%3A8765/.venv/bin/python"
if [ -x "$PY" ] && ls "$HOME/.cache/huggingface/hub" 2>/dev/null | grep -q faster-whisper-small; then echo "recogniser ready"; else echo "recogniser NOT ready - see /tmp/whisperx-prepare.log"; fi
step "Check";  node -v; ffmpeg -version | head -1; hypit version | head -1; hypit doctor 2>&1 | tail -4
