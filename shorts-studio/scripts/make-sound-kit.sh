#!/usr/bin/env bash
# Synthesizes a small royalty-free sound kit with FFmpeg only (no downloads, no services).
# Everything produced here is generated from math expressions, so you own it outright.
# Usage: scripts/make-sound-kit.sh [output-dir]   (default: assets/sfx and assets/music)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SFX="${1:-$ROOT/assets/sfx}"
MUSIC="$ROOT/assets/music"
mkdir -p "$SFX" "$MUSIC"
ff() { ffmpeg -v error -y "$@"; }
SR=48000

# Whoosh: band-passed noise with a rising/falling envelope (transition swipe), 0.45 s.
ff -f lavfi -i "anoisesrc=d=0.45:c=pink:r=$SR:a=0.9" \
   -af "bandpass=f=1800:width_type=o:w=1.4,volume='sin(PI*t/0.45)^2':eval=frame,afade=t=out:st=0.38:d=0.07" "$SFX/whoosh.wav"

# Pop: short sine blip with fast pitch drop (word/element pop-in), 0.12 s.
ff -f lavfi -i "aevalsrc='0.8*sin(2*PI*(900*t-2400*t*t))*exp(-38*t)':s=$SR:d=0.12" "$SFX/pop.wav"

# Hit: sub boom + click (hook slam / punch word), 0.7 s.
ff -f lavfi -i "aevalsrc='0.9*sin(2*PI*(95*t-60*t*t))*exp(-6*t)+0.35*(random(0)-0.5)*exp(-90*t)':s=$SR:d=0.7" "$SFX/hit.wav"

# Riser: noise + rising tone into a reveal, 1.5 s.
ff -f lavfi -i "aevalsrc='(0.25*sin(2*PI*(200*t+300*t*t))+0.15*(random(0)-0.5))*(t/1.5)^2':s=$SR:d=1.5" \
   -af "afade=t=out:st=1.45:d=0.05" "$SFX/riser.wav"

# Tick: UI tick for list items / counters, 0.05 s.
ff -f lavfi -i "aevalsrc='0.6*sin(2*PI*2400*t)*exp(-120*t)':s=$SR:d=0.05" "$SFX/tick.wav"

# Ding: bright bell for CTA / payoff, 0.9 s.
ff -f lavfi -i "aevalsrc='0.35*(sin(2*PI*1318.5*t)+0.5*sin(2*PI*2637*t)+0.25*sin(2*PI*3955.5*t))*exp(-5*t)':s=$SR:d=0.9" "$SFX/ding.wav"

# Music bed: 120 BPM, 8 bars of 4/4 = 16 s seamless loop. Kick on every beat, offbeat hats,
# minor bass line (A-F-C-G). Pure synthesis, mixed quietly so voice stays on top.
BEAT=0.5
ff -f lavfi -i "aevalsrc='0.9*sin(2*PI*(55*mod(t,$BEAT)-90*mod(t,$BEAT)^2)*1.0)*exp(-18*mod(t,$BEAT))':s=$SR:d=16" \
   -f lavfi -i "anoisesrc=d=16:c=white:r=$SR:a=0.5" \
   -f lavfi -i "aevalsrc='0.32*sin(2*PI*(if(lt(mod(t,8),2),55,if(lt(mod(t,8),4),43.65,if(lt(mod(t,8),6),65.41,49.0))))*t)*(0.6+0.4*exp(-6*mod(t,$BEAT)))':s=$SR:d=16" \
   -filter_complex "[1:a]highpass=f=7000,volume='0.5*exp(-40*mod(t-0.25+10,0.5))':eval=frame[h];[0:a][h][2:a]amix=inputs=3:normalize=0,alimiter=limit=0.8,volume=0.9[m]" \
   -map "[m]" -ac 2 "$MUSIC/loop-120bpm.wav"

# War drone: dark low bed for history/battle Shorts. D2 + A2 sines with slow swell + low rumble, 48 s.
ff -f lavfi -i "aevalsrc='(0.30*sin(2*PI*73.42*t)+0.18*sin(2*PI*110*t)+0.10*sin(2*PI*146.83*t))*(0.75+0.25*sin(2*PI*t/8))':s=24000:d=48" \
   -f lavfi -i "anoisesrc=d=48:c=brown:r=24000:a=0.6" \
   -filter_complex "[1:a]lowpass=f=260,volume=0.7[r];[0:a][r]amix=inputs=2:normalize=0,afade=t=in:d=2,alimiter=limit=0.7[m]" \
   -map "[m]" -ac 1 "$MUSIC/war-drone.wav"

echo "Sound kit written to $SFX and $MUSIC:"
for f in "$SFX"/*.wav "$MUSIC"/*.wav; do
  printf '  %-28s %ss\n' "$(basename "$f")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
done
