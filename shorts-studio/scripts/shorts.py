#!/usr/bin/env python3
"""Zero-cost Shorts workflow for Hypit: your script + your voiceover MP3 -> synced 1080x1920 video.

    python3 scripts/shorts.py new     <production>          # copy the battle-short template
    python3 scripts/shorts.py align   <production>          # local ASR word times -> words.json
    python3 scripts/shorts.py compose <production>          # plan.json + words.json -> authors/main.svml
    hypit build videos/productions/<production>/runs/render.svrun --follow
    python3 scripts/shorts.py finish  <production> <build>  # export + loudness master -> output/final.mp4

A production folder (videos/productions/<name>/) holds:
    script.txt            approved narration (exactly what the voiceover says)
    assets/voiceover.mp3  the user's own recording (any Hypit audio format works)
    plan.json             visual choreography keyed to phrases of the script (see docs/WORKFLOW.md)

Everything runs locally: faster-whisper from Hypit's managed WhisperX environment, Hypit's local
HTML renderer and FFmpeg. No network calls after the one-time model download, no paid services.
"""
from __future__ import annotations

import difflib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent.parent
PRODUCTIONS = STUDIO / "videos" / "productions"
TEMPLATE = STUDIO / "templates" / "battle-short"
WHISPER_PY = Path.home() / ".local/state/hypit/programs/whisperx-whisperx.local-127.0.0.1%3A8765/.venv/bin/python"
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus")

# ---------------------------------------------------------------- numbers -> words (ASR writes digits)
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def spell(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    for size, word in ((10**9, "billion"), (10**6, "million"), (1000, "thousand"), (100, "hundred")):
        if n >= size:
            rest = n % size
            return spell(n // size) + " " + word + ("" if rest == 0 else " " + spell(rest))
    return str(n)


def tokens(text: str) -> list[str]:
    """Normalised comparison tokens: lowercase, digits spelled out, hyphens split, punctuation removed."""
    out: list[str] = []
    for raw in text.split():
        bare = re.sub(r"[^\w'%,.-]", "", raw).strip(".,")
        if re.fullmatch(r"\d[\d,]*", bare):
            raw = spell(int(bare.replace(",", "")))
        for part in re.split(r"[\s-]+", raw.lower()):
            part = re.sub(r"[^a-z0-9']", "", part)
            if part:
                out.append(part)
    return out


# ---------------------------------------------------------------- helpers
def prod_dir(name: str) -> Path:
    path = PRODUCTIONS / name
    if not path.is_dir():
        sys.exit(f"No production folder {path}")
    return path


def voice_file(prod: Path) -> Path:
    for ext in AUDIO_EXT:
        if (prod / "assets" / f"voiceover{ext}").exists():
            return prod / "assets" / f"voiceover{ext}"
    sys.exit(f"Put the voiceover at {prod}/assets/voiceover.mp3 (or .wav/.m4a/...)")


def probe_duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


# ---------------------------------------------------------------- align
ASR_CODE = r'''
import json, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[3], device="cpu", compute_type="int8")
segs, info = m.transcribe(sys.argv[1], language=sys.argv[4], word_timestamps=True, vad_filter=False)
words = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)} for s in segs for w in s.words]
json.dump({"duration": info.duration, "words": words}, open(sys.argv[2], "w"), indent=1)
'''


def cmd_align(name: str, model: str = "small", language: str = "en") -> None:
    prod = prod_dir(name)
    voice = voice_file(prod)
    script_words = (prod / "script.txt").read_text().split()
    if not WHISPER_PY.exists():
        sys.exit("Local faster-whisper missing: run `hypit programs prepare --endpoint whisperx.local` (see docs/SETUP.md).")
    wav = prod / ".work" / "voice16k.wav"
    wav.parent.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(voice), "-ac", "1", "-ar", "16000", str(wav)], check=True)
    code = prod / ".work" / "asr.py"
    code.write_text(ASR_CODE)
    asr_path = prod / "asr-words.json"
    env = {**os.environ, "HF_HUB_OFFLINE": os.environ.get("HF_HUB_OFFLINE", "1")}
    subprocess.run([str(WHISPER_PY), "-I", str(code), str(wav), str(asr_path), model, language], check=True, env=env)
    asr = json.loads(asr_path.read_text())["words"]

    # Expand both sides to comparison tokens, remembering which original word each token came from.
    s_tok, s_owner = [], []
    for i, w in enumerate(script_words):
        for t in tokens(w):
            s_tok.append(t); s_owner.append(i)
    a_tok, a_time = [], []
    for w in asr:
        parts = tokens(w["word"]) or [""]
        span = (w["end"] - w["start"]) / len(parts)
        for k, t in enumerate(parts):
            a_tok.append(t); a_time.append((w["start"] + k * span, w["start"] + (k + 1) * span))
    times: list[tuple[float, float] | None] = [None] * len(s_tok)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=s_tok, b=a_tok, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = a_time[j1 + k]
        elif tag == "replace" and j2 > j1:          # spread the heard span over the written tokens
            t0, t1 = a_time[j1][0], a_time[j2 - 1][1]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (t0 + (t1 - t0) * k / n, t0 + (t1 - t0) * (k + 1) / n)
    # Interpolate anything ASR did not hear, between known neighbours.
    duration = probe_duration(voice)
    known = [i for i, t in enumerate(times) if t]
    if not known:
        sys.exit("ASR produced no usable words; check the audio and language.")
    for i, t in enumerate(times):
        if t:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        a = times[prev][1] if prev is not None else 0.0
        b = times[nxt][0] if nxt is not None else duration
        lo = prev if prev is not None else -1
        hi = nxt if nxt is not None else len(times)
        n = hi - lo - 1
        k = i - lo - 1
        times[i] = (a + (b - a) * k / n, a + (b - a) * (k + 1) / n)
    words = []
    for i, w in enumerate(script_words):
        idx = [k for k, o in enumerate(s_owner) if o == i]
        if idx:
            words.append({"word": w, "start": round(times[idx[0]][0], 3), "end": round(times[idx[-1]][1], 3)})
        else:   # pure punctuation token
            words.append({"word": w, "start": words[-1]["end"] if words else 0.0, "end": words[-1]["end"] if words else 0.0})
    matched = sum(1 for t in known) / max(1, len(s_tok))
    (prod / "words.json").write_text(json.dumps({"voice": voice.name, "duration": duration, "matched": round(matched, 3), "words": words}, indent=1))
    print(f"Aligned {len(words)} script words to {voice.name} ({duration:.2f}s); {matched:.0%} of tokens matched ASR directly.")


# ---------------------------------------------------------------- captions
STOP = set("a an the and or but so of to in on at by for with from as is are was were be been it its he she they them his her their this that then just up out all has have had does do did will would can could".split())
NUMBER_WORDS = set(ONES + TENS[2:] + ["hundred", "thousand", "million", "billion"])


def is_number(word: str) -> bool:
    w = re.sub(r"[^\w-]", "", word).lower()
    return any(ch.isdigit() for ch in w) or (bool(w) and all(part in NUMBER_WORDS for part in w.split("-")))


def caption_chunks(words: list[dict], max_words: int, max_chars: int, overrides: dict[str, str]) -> list[dict]:
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        text = " ".join(x["word"] for x in cur)
        end_sentence = bool(re.search(r"[.!?;:,]$", w["word"]))
        nxt = words[i + 1]["word"] if i + 1 < len(words) else ""
        too_long = len(text + " " + nxt) > max_chars
        keep_number = is_number(w["word"]) and is_number(nxt) and not end_sentence   # never split "eighty-six thousand"
        if not nxt or end_sentence or ((len(cur) >= max_words or too_long) and not keep_number):
            chunks.append(cur); cur = []
    out = []
    for chunk in chunks:
        plain = [re.sub(r"[^\w'%-]", "", w["word"]) for w in chunk]
        key = overrides.get(" ".join(plain).lower())
        if key is None:
            def score(i: int) -> tuple[int, int]:
                w = plain[i]; low = w.lower()
                s = 0
                if is_number(w):
                    s = 5
                elif w[:1].isupper() and (i > 0 or low not in STOP):
                    s = 4
                elif low not in STOP and len(low) >= 4:
                    s = 2 + (len(low) >= 6)
                elif low not in STOP:
                    s = 1
                return (s, i)
            best = max(range(len(plain)), key=score)
            key = plain[best] if score(best)[0] > 0 else ""
        rendered = []
        used = False
        for w in plain:
            if not used and key and w.lower() == key.lower():
                rendered.append(f"*{w}*"); used = True
            else:
                rendered.append(w)
        out.append({"start": chunk[0]["start"], "text": " ".join(rendered)})
    return out


# ---------------------------------------------------------------- compose
def esc(v) -> str:
    return str(v).replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def cmd_compose(name: str) -> None:
    prod = prod_dir(name)
    plan = json.loads((prod / "plan.json").read_text())
    data = json.loads((prod / "words.json").read_text())
    words = data["words"]
    fps = int(plan.get("fps", 60))
    duration = data["duration"]
    end_frame = math.ceil((duration + float(plan.get("hold_end_s", 0.6))) * fps)
    norm = [tokens(w["word"]) for w in words]
    flat, owner = [], []
    for i, t in enumerate(norm):
        for x in t:
            flat.append(x); owner.append(i)

    def at_phrase(phrase: str, occurrence: int = 1) -> float:
        if phrase == "start":
            return 0.0
        if phrase == "end":
            return duration
        target = tokens(phrase)
        seen = 0
        for k in range(len(flat) - len(target) + 1):
            if flat[k:k + len(target)] == target:
                seen += 1
                if seen == occurrence:
                    return words[owner[k]]["start"]
        sys.exit(f'plan.json: phrase "{phrase}" (occurrence {occurrence}) not found in script.txt')

    def frame_of(ev: dict) -> int:
        f = round(at_phrase(ev.get("on", "start"), int(ev.get("occurrence", 1))) * fps) + int(ev.get("offset", 0))
        return max(0, min(end_frame - 1, f))

    instants: list[tuple[str, int]] = []
    children: list[str] = []
    seq = 0

    def instant(frame: int) -> str:
        nonlocal seq
        seq += 1
        iid = f"t{seq:03d}"
        instants.append((iid, frame))
        return iid

    def attrs(d: dict, skip=()) -> str:
        parts = []
        for k, v in d.items():
            if k in skip or v is None:
                continue
            if k in ("points", "path") and isinstance(v, list):
                v = " ".join(f"{p[0]},{p[1]}" for p in v)
            parts.append(f'{k}="{esc(v)}"')
        return " ".join(parts)

    for unit in plan["units"]:
        iid = instant(0)
        children.append(f'    <map:Unit {attrs(unit)} at={{program.{iid}}}/>')
    meta = {"on", "offset", "occurrence", "type", "until", "sfx", "gain"}
    sfx_clips: list[tuple[str, int, str, float]] = []
    for ev in plan["events"]:
        f = frame_of(ev)
        body = {k: v for k, v in ev.items() if k not in meta}
        if "until" in ev:
            body["for"] = max(1, frame_of({"on": ev["until"], "offset": ev.get("until_offset", 0)}) - f)
        body.pop("until_offset", None)
        iid = instant(f)
        children.append(f'    <map:{ev["type"]} {attrs(body)} at={{program.{iid}}}/>')
        if ev.get("sfx"):
            sfx_clips.append((iid, f, ev["sfx"], float(ev.get("gain", 0.5))))
    cap = plan.get("captions", {})
    lead = int(cap.get("lead_frames", 2))
    for c in caption_chunks(words, int(cap.get("max_words", 3)), int(cap.get("max_chars", 17)), {k.lower(): v for k, v in cap.get("keywords", {}).items()}):
        f = max(0, round(c["start"] * fps) - lead)
        iid = instant(f)
        children.append(f'    <map:Caption text="{esc(c["text"])}" at={{program.{iid}}}/>')

    sounds = sorted({s for _, _, s, _ in sfx_clips})
    sfx_len = {s: probe_duration(STUDIO / "assets" / "sfx" / f"{s}.wav") for s in sounds}
    style = plan.get("style", {})
    scene_attrs = {k: v for k, v in {"title": plan.get("title"), "year": plan.get("year"), "cam-x": plan["camera"]["x"],
                   "cam-y": plan["camera"]["y"], "zoom": plan["camera"]["zoom"], "seed": plan.get("seed", 7), **style}.items() if v is not None}
    voice = voice_file(prod)
    bed = plan.get("bed", {"file": "war-drone.wav", "gain": 0.05})
    rel = os.path.relpath(STUDIO / "assets", prod / "authors")
    lines = [
        '<?svml using="@hypit/markup@1"?>',
        "<!-- GENERATED by scripts/shorts.py compose from plan.json + words.json. Edit those, then re-run compose. -->",
        "<svml>",
        '  <import as="time" from="@hypit/timeline-author@1"/>',
        '  <import as="spatial" from="@hypit/spatial@1"/>',
        '  <import as="media" from="@hypit/media@1"/>',
        '  <import as="mediaop" from="@hypit/media-operations@1"/>',
        '  <import as="audio" from="@hypit/audio-track@1"/>',
        '  <import as="fonts" from="@hypit/fontsource@1"/>',
        '  <import as="map" from="@shorts/battle-map@1"/>',
        '  <import as="film" from="@hypit/film@1"/>',
        '  <import as="html" from="@hypit/html-video@1"/>',
        '  <import as="look" source="../recipes/look.svs"/>',
        "",
        f'  <time:Clock id="clock" frame-rate="{fps}"/>',
        f'  <media:Audio id="voice-src" src="../assets/{voice.name}"/>',
        '  <mediaop:Normalize id="voice" source={voice-src} clock={clock} video="none" audio="default" span-authority="audio"/>',
    ]
    if bed:
        lines += [f'  <media:Audio id="bed-src" src="{rel}/music/{bed["file"]}"/>',
                  '  <mediaop:Normalize id="bed" source={bed-src} clock={clock} video="none" audio="default" span-authority="audio"/>']
    for s in sounds:
        lines += [f'  <media:Audio id="sfx-{s}-src" src="{rel}/sfx/{s}.wav"/>',
                  f'  <mediaop:Normalize id="sfx-{s}" source={{sfx-{s}-src}} clock={{clock}} video="none" audio="default" span-authority="audio"/>']
    lines.append(f'  <time:Timeline id="program" clock={{clock}} end="{end_frame}f">')
    lines.append('    <time:Window id="voice-span" from="start" for={voice.extent}/>')
    lines.append(f'    <time:Window id="bed-span" from="start" for="{end_frame}f"/>')
    lines += [f'    <time:Instant id="{iid}" at="{frame}f"/>' for iid, frame in instants]
    lines.append("  </time:Timeline>")
    for k, (iid, frame, s, _) in enumerate(sfx_clips):
        n = max(1, min(math.floor(sfx_len[s] * fps), end_frame - frame))
        lines.append(f'  <time:Window id="w-sfx-{k}" timeline={{program.timeline}} from={{program.{iid}}} for="{n}f"/>')
    lines += [
        '  <spatial:Canvas id="canvas" width="1080" height="1920"/>',
        '  <fonts:Face id="display-face" package="@fontsource/anton" weight="400" style="normal"/>',
        '  <media:FontStack id="display" primary={display-face}/>',
        '  <fonts:Face id="ui-face" package="@fontsource-variable/inter" weight="800" style="normal"/>',
        '  <media:FontStack id="ui" primary={ui-face}/>',
        "",
        f'  <map:Scene id="battle" timeline={{program.timeline}} within={{canvas.bounds}} font={{display}} label-font={{ui}} during={{program.window}} {attrs(scene_attrs)}>',
        *children,
        "  </map:Scene>",
        "",
        '  <audio:Track id="mix" timeline={program.timeline}>',
        f'    <audio:Clip id="voice-clip" source={{voice.media}} during={{program.voice-span}} gain="{plan.get("voice_gain", 1)}"/>',
    ]
    if bed:
        lines.append(f'    <audio:Clip id="bed-clip" source={{bed.media}} during={{program.bed-span}} gain="{bed["gain"]}" fade-in="1s" fade-out="1s"/>')
    for k, (iid, frame, s, gain) in enumerate(sfx_clips):
        lines.append(f'    <audio:Clip id="sfx-clip-{k}" source={{sfx-{s}.media}} during={{w-sfx-{k}}} gain="{gain}"/>')
    lines += [
        "  </audio:Track>",
        "",
        '  <film:Film id="main" canvas={canvas.canvas} timeline={program.timeline} appearance={look.film.main}>',
        "    <film:Track source={battle.visual}/>",
        "    <film:Track source={mix.audio}/>",
        "  </film:Film>",
        '  <html:Video id="final" composition={main.composition} timeline={program.timeline}/>',
        "</svml>",
    ]
    (prod / "authors").mkdir(exist_ok=True)
    (prod / "authors" / "main.svml").write_text("\n".join(lines) + "\n")
    (prod / "recipes").mkdir(exist_ok=True)
    if not (prod / "recipes" / "look.svs").exists():
        (prod / "recipes" / "look.svs").write_text('<?svml using="@hypit/recipe@1"?>\n<sheet version="1">\n  film.main { background: #1b160c; }\n</sheet>\n')
    (prod / "runs").mkdir(exist_ok=True)
    (prod / "runs" / "render.svrun").write_text('<?svml using="@hypit/markup/run@1"?>\n\n<svrun version="1">\n  <author source="../authors/main.svml"/>\n  <target output="final.video"/>\n</svrun>\n')
    print(f"Composed authors/main.svml: {end_frame} frames @ {fps} fps ({end_frame / fps:.2f}s), "
          f"{len(plan['units'])} units, {len(plan['events'])} events, {sum(1 for c in children if 'map:Caption' in c)} captions, {len(sfx_clips)} sfx.")


# ---------------------------------------------------------------- finish
def cmd_finish(name: str, build: str) -> None:
    prod = prod_dir(name)
    out = prod / "output"
    out.mkdir(exist_ok=True)
    raw = out / "render-raw.mp4"
    if raw.exists():
        raw.unlink()
    subprocess.run(["hypit", "get", build, "--output", "final.video", "--to", str(raw)], check=True, cwd=STUDIO)
    # Two-pass EBU R128 loudness to -14 LUFS / -1.5 dBTP (common Shorts target); picture is copied untouched.
    first = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    m = json.loads(first[first.rindex("{"):first.rindex("}") + 1])
    final = out / "final.mp4"
    filt = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
            f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-c:v", "copy", "-af", filt, "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(final)], check=True)
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate:format=duration", "-of", "compact", str(final)],
                          capture_output=True, text=True).stdout
    print(f"Final video: {final}\n{info}Input loudness {m['input_i']} LUFS -> target -14 LUFS")


def cmd_new(name: str) -> None:
    dest = PRODUCTIONS / name
    if dest.exists():
        sys.exit(f"{dest} already exists")
    shutil.copytree(TEMPLATE, dest)
    print(f"Created {dest}. Next: put script.txt and assets/voiceover.mp3 there, edit plan.json, then run align/compose.")


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in {"new", "align", "compose", "finish"}:
        sys.exit(__doc__)
    {"new": lambda: cmd_new(sys.argv[2]), "align": lambda: cmd_align(sys.argv[2]), "compose": lambda: cmd_compose(sys.argv[2]),
     "finish": lambda: cmd_finish(sys.argv[2], sys.argv[3])}[sys.argv[1]]()
