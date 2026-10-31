# Style guide — "War Map" Shorts

This style is derived from the analysed reference (`videos/references/gaugamela-war-in-motion/ANALYSIS.md`).
It is implemented by `packages/battle-map` and driven by each production's `plan.json`. Values marked
*measured* come from pixel sampling of the reference; the rest are this studio's choices.

## Animation style
- One continuous top-down "god's-eye" shot of a living map. Change comes from units moving,
  labels and arrows, never from cuts.
- Units are dense formations of soldier dots with soft offset shadows. Enemy is red, hero is near-black.
- **Moves:** ease-in-out by default; use `ease: in` for charges and `ease: out` for routs. Typical length
  is 40–90 frames at 60 fps.
- **Labels** pop in on the word that names them: scale 0.55→1 with a slight overshoot over 9 frames, then
  fade out over 9 frames. They follow their unit.
- **Arrows** draw head-first along a smoothed path (draw 20–80 f), hold, then retract from the tail.
  Pink means an attack (enemy or collision); pale blue means a manoeuvre.
- **Impacts:** a warm glow flash (24 f) plus a fading dust puff (90 f), optionally with a camera shake (10–16 px).

## Typography
| Element | Font | Size @1080×1920 | Treatment |
| --- | --- | --- | --- |
| Captions | Anton (OFL, via @fontsource/anton) | 112 px | ALL CAPS, white, 0.085 em black stroke, drop shadow |
| Caption keyword | Anton | same | yellow #FAD306 *(measured)*, one per caption |
| Title bar | Anton | 64 px title + 40 px date | white title, date #D0C935 *(measured)*, dark pill rgba(14,12,9,.82) |
| Unit labels | Inter 800 (OFL) | 42 px | white text, dark pill, 3 px border plus a dot in the side colour |
| End card number | Anton | 210 px | white, black stroke |
| End card sub-line | Inter 800 | 46 px | salmon #EB958C *(measured)* |

## Colours
| Role | Value |
| --- | --- |
| Terrain base / patches | #7a6127 / #9a7c33, with vignette to #120d05 (reference measured #715822–#8A6C23) |
| Enemy units / label border | #A8402C / #B94D3D *(label measured)* |
| Hero units / label border | #231d10 / #627CB2 *(label measured)* |
| Neutral label border | #D9CFA8 |
| Attack arrow / manoeuvre arrow | #EFA199 / #B1C4D6 *(measured)* |

## Transitions
- None between shots: the piece is one shot. "Scene changes" are camera moves (70–240 f, ease-in-out).
- Captions swap with a hard cut and a tiny 5-frame settle (scale 1.07→1).

## Editing rhythm
- Captions: 2–3 words, ≤ 20 characters, keeping number phrases together. The reference changes captions
  every ~0.65 s (median).
- A new graphic event (label, arrow, flash or camera move) every 2–5 s, always on the word it illustrates.
- The narration drives everything. Events are keyed to phrases, never to seconds (`plan.json`).
- No intro and no outro. End on the stat card under the final sentence, with a 0.6 s hold.

## Captions
- Position: centre at 64.5% of the height, 5% side margins, inside YouTube's safe area.
- Keyword priority: numbers, then proper nouns, then long content words. Override per caption in `plan.json →
  captions.keywords`.
- Captions show from 2 frames before the first word until the next caption starts.

## Sound design
- The narration is the user's own recording, untouched except for loudness: the whole mix is mastered to −14 LUFS,
  −1.5 dBTP (two-pass `loudnorm`).
- **Bed:** `assets/music/war-drone.wav` (self-synthesised low drone + rumble) at gain 0.05, about 14 dB under the
  voice, matching the reference's quiet continuous bed.
- **Sound effects:** `hit.wav` on impacts (gain 0.3–0.6) and `whoosh.wav` on big manoeuvres. Use them sparingly; the voice
  carries the piece.

## Camera movements
- The base zoom is tight enough that battle lines run off the frame edges (reference look). Default is 1.2–1.3.
- Push in (1.4–1.5) on a character beat ("He is just past thirty").
- Pull out (1.0–1.1) when a manoeuvre needs the whole map (encirclement, flank rides).
- End on a slow push (≈ +0.15 zoom over 4 s) under the stat card.
- Start a pan *before* the action it frames (for example 30 frames after the previous impact), so arrows never leave the frame.
