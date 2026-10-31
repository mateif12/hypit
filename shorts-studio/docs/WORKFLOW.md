# Workflow — script + your MP3 → finished Short (free, local)

The rule of this studio: **no AI voice, no paid APIs.** You record the voiceover yourself (for example
in ElevenLabs under your own account), and everything after that runs locally for no cost.

## 0. New cloud session? Rebuild the tools (≈10 min, one time per container)
```bash
cd shorts-studio && scripts/setup.sh
```

## 1. Reference (optional, once per style)
Put the reference video at `videos/references/<name>/source.mp4`. In this environment YouTube blocks
downloads, so upload the file. Ask Claude to analyse it; the results go to `ANALYSIS.md` and `TIMELINE.md`
in that folder. The War Map style is already analysed and captured in `STYLE_GUIDE.md`.

## 2. Script → approval
Claude writes `script.txt` (see `prompts/script.md`). You approve it before anything else happens.

## 3. Create the production and add your voiceover
```bash
python3 scripts/shorts.py new my-short
```
Then put these in `videos/productions/my-short/`:
- `script.txt`: the approved text, exactly as recorded.
- `assets/voiceover.mp3`: your recording. `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg` and `.opus` also work.

## 4. Word timing (local speech recogniser)
```bash
python3 scripts/shorts.py align my-short
```
This writes `words.json`: every script word with its measured start and end time. It uses your script's
spelling and the audio's timing, and reports how many words matched.

## 5. Choreography: `plan.json`
The template is a complete working example (Cannae). Edit the following:
- `title`, `year` and `camera` (start x/y/zoom).
- `units`: formations present from the first frame:
  - `id`, `side` (red | dark), `x`, `y` (world px; the screen is 1080×1920 at zoom 1)
  - `w`, `d`, `rows`, `cols`, plus optional `curve` and `angle`
- `events`: each event is keyed to a phrase of the script: `"on": "legions slam"`, with optional `offset`
  (frames) and `occurrence`.

| type | key fields |
| --- | --- |
| `Label` | `text`, `unit` (to follow) or `x`/`y`, `tone` red/blue/neutral, `dy`, `until` (phrase) or `for` (frames) |
| `Move` | `unit`, any of `x y w d curve angle rout dead`, or `path` [[x,y],…]; `for`, `ease` |
| `Arrow` | `points` [[x,y],…], `colour` pink/blue/white/yellow, `draw`, `hold`, `retract`, `width` |
| `Flash` | `points`, `size` |
| `Camera` | `x`, `y`, `zoom`, `for` |
| `Shake` | `for`, `amp` |
| `Stat` | `number`, `sub` (end card) |

Any event can add `"sfx": "hit"` (or `whoosh`, `pop`, `riser`, `tick`, `ding`) and `"gain"`.
Captions are generated automatically from the words. `captions.keywords` overrides the yellow word for
a caption.

## 6. Compose → render → master
```bash
python3 scripts/shorts.py compose my-short
hypit plan  videos/productions/my-short/runs/render.svrun
hypit build videos/productions/my-short/runs/render.svrun --follow
python3 scripts/shorts.py finish my-short <build-id>
```
- **compose:** writes `authors/main.svml`, a Hypit source with every event as a Timeline Instant at 60 fps.
- **plan:** must say "local, no Provider charge" for every request.
- **build:** about 5 minutes for 45 s at 60 fps on 4 CPUs.
- **finish:** exports the build and masters loudness, writing `output/final.mp4` (1080×1920, 60 fps, H.264 + AAC 192k).

## 7. Review
Make a frame grid at key words and watch the result:
```bash
hypit media tile videos/productions/my-short/output/final.mp4 --every 1.5 --cell 200 --columns 10 --to /tmp/grid.jpg
```
Fix by editing `plan.json`, then rerun compose, build and finish. Changing the voiceover needs only align + compose,
because every event follows its phrase.

## 8. Git
- `main` stays clean (original Hypit untouched); the studio lives in `shorts-studio/`.
- Suggested branch per video: `video/<name>` from the studio branch. Claude needs your permission to push
  branches other than the session branch.
- Large or third-party media is not committed: reference videos, frame evidence and raw renders are in `.gitignore`.
  Your voiceover and `output/final.mp4` are committed.

## Why not Hypit's semantic WhisperX alignment?
Hypit's preferred path aligns Script words through the `whisperx.local` endpoint. In this cloud
environment, its English alignment model downloads from `download.pytorch.org`, which the network
policy denies. `scripts/shorts.py align` uses the same local recogniser (faster-whisper `small`)
with word timestamps instead, and maps words to Timeline Instants. On a machine where `hypit programs up
--endpoint whisperx.local` succeeds, the production could move to `whisperx:Alignment` + Script Moments.
