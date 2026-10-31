# Reference analysis — "Battle of Gaugamela: Alexander's Wedge" (War In Motion)

## Source and provenance

| Item | Value |
| --- | --- |
| File | `source.mp4` (user upload, 2026-10-31) |
| Probe | 53.85 s, 540×1004, 60 fps, with audio |
| Capture | Phone screen recording of the YouTube Shorts player. The like/comment/share column, comment preview, channel row, Subscribe button and description strip are **player UI, not part of the video's design**. |
| Channel | @war-in-motion |
| Title shown in player | "Battle of Gaugamela: Alexander's Wedge" (series link below: "Battle of Thermopylae: The Traitor's Path") |
| Requested link | `youtube.com/shorts/1nMFmTkSD8Q`. Public oEmbed title: "The Fake Retreat That Conquered England", same channel. **The uploaded file is a different video from the same channel and series.** This analysis describes the uploaded file. |
| Transcript | `transcript.json`: local faster-whisper `small`, CPU, word timestamps. ASR dropped some words (0–2 s, 24–28 s). The burned-in captions supply them; see TIMELINE.md. |
| Evidence | `evidence/overview-2s.jpg`, `labels-3-9s.jpg`, `chariots-25-31s.jpg`, `cavalry-34-40s.jpg`, `ending-42-54s.jpg`, `pair.png` (full-resolution frames at 5.6 s and 53.3 s) |

## The whole piece in one sentence

A single top-down "god's-eye" camera watches an ancient battle play out like a live tactical
replay. A fast, flat-toned narrator explains each move in present tense. Every key noun (army
size, commander, weapon, the gap) is pinned onto the map as a label the moment it is spoken.
The video ends on a death-toll number card.

## 1. Visual style and aesthetic

- **Material:** a realistic 3D battle simulation (game-engine look) seen from high above, near
  top-down with slight perspective. Hundreds of tiny individual soldiers in block formations cast
  long shadows. The terrain is a dusty plain with a fortified camp visible at the top-left.
- **Grade:** warm, desaturated ochre/khaki over the whole frame, with a dark vignette at the
  corners. It reads like an old map come alive.
- **Faction colour coding:** Persians = **red** units, Macedonians = **near-black** units.
  The labels add a second code: red border/dot for Persia, blue border/dot for Macedon.
- **Information hierarchy:** (1) the caption in the centre band, (2) moving formations,
  (3) small pinned labels, (4) a persistent top title bar.

## 2. Storytelling structure and pacing (observed)

| Time | Beat | Function |
| --- | --- | --- |
| 0–7 s | Odds: 47,000 vs "far more" + 200 scythed chariots | Hook through stakes. The hero is outnumbered and the enemy has a terror weapon. |
| 8–13 s | "He is just 25… already beaten the King of Persia once" | Character beat: youth plus a prior win against the same enemy. |
| 13–25 s | Marches right; Persians slide to follow; line stretches | Setup: the clever manoeuvre, which the viewer can see happening. |
| 24–32 s | Chariots charge; lanes open; chariots cut down | The enemy's weapon fails (first payoff). |
| 32–35 s | "Then a gap opens in the Persian line" | Turn: the opening the setup created. |
| 35–42 s | Wedge of Companion cavalry drives through at Darius | Climax: the decisive strike, drawn as a path. |
| 42–51 s | The king flees "for the second time"; the army falls apart | Collapse, with a callback to the 8–13 s beat ("already beaten… once"). |
| 51–54 s | "Ancient writers count at least forty thousand" + **40,000+** card | Kicker: hard number, sourced ("by ancient accounts"), then the video simply ends. |

- No intro, no greeting, no call to action. It starts mid-sentence on the hook and stops on the number.
- Reconstructed narration is about 132 words in 53.8 s, which is **about 2.45 words/s**. Short
  declarative present-tense sentences, many starting with "The…", "Then…", "And…".
- Only one pause is longer than 1 s (around 45.4–46.4 s, before "With their king gone"). It works as
  a breath before the collapse.

## 3. Scene composition and duration

- **One continuous shot. No hard cuts were detected.** `hypit media boundaries` at 30 samples/s
  found a single weak candidate (45.13 s, score 0.118). The frames show a camera reframing there,
  not an edit.
- Composition is a vertical stack: title bar (top ~6%), battlefield action (upper ~55%), caption
  band (around 62–68% height), lower area left for the platform UI.
- Formations are long horizontal bands. Persians sit mostly in the upper half, Macedonians in the
  lower half, so the conflict reads top vs bottom.
- "Scenes" are **states of the same map**, changed by camera position and unit movement rather than by cuts.

## 4. Camera movement and zoom

- A slow, continuous drift/pan follows whichever formation the narration is about. The fortified
  camp slides across the top-left between frames.
- There is a quicker reframing move around 45 s as the Persian line collapses.
- Scale stays roughly constant; there are no punchy zoom-ins on words. *Interpretation:* motion
  comes from the units and graphics, not from camera tricks, which keeps the "watching a replay" feel.

## 5. Animations and transitions

- **Pinned unit labels** (`MACEDON ~47,000`, `PERSIA ~50,000 TO 120,000`, `200 SCYTHED CHARIOTS`,
  `ALEXANDER`, `DARIUS`, `Persian cavalry`, `THE GAP`, `Companion cavalry`):
  - Each appears on the word that names it. `MACEDON` is on screen at about 2 s, during "forty-seven
    thousand"; `PERSIA` at about 3.5 s ("The Persians have"); `200 SCYTHED CHARIOTS` at about 5.5 s
    ("two hundred"); `ALEXANDER` at about 8 s ("He is just").
  - Each label follows its unit as the camera moves, persists while relevant, then disappears.
- **Self-drawing arrows:**
  - Three straight pink/salmon arrows from the chariots down into the Macedonian line (25–29 s).
    They retract as the chariots pass through.
  - One long, curved, pale blue-white arrow traces the cavalry path through "THE GAP" towards
    Darius (35–42 s). It grows along the path, then shortens behind the moving wedge.
- **Impact flashes:** small bright glow bursts with dust where units collide (about 30 s at the
  chariot line, about 51 s as the line breaks).
- **Transitions:** none in the editing sense (single shot). Change comes from labels popping in and
  out, arrows drawing and the camera drifting.
- **End card (about 53 s):** a huge white "40,000+" with a black outline at the top of the frame,
  over a salmon-red sub-line "Persian dead, by ancient accounts".

## 6. Typography and captions

- **Captions:**
  - Heavy condensed all-caps sans in the Anton/Bebas family (exact font not identifiable from pixels).
  - White fill, thick black outline and soft drop shadow, centred, at about 62–68% of frame height.
  - **2–3 words per caption**, swapping in a hard cut. Measured median interval between caption
    changes is **0.65 s** (80 changes in 53.8 s, from pixel differences in the caption band).
  - **One keyword per caption is yellow** (measured #FAD306): numbers, names and key verbs ("GREAT",
    "THOUSAND", "PERSIANS", "CHARGE", "LANES", "WEDGE", "APART", "FORTY").
  - A caption wraps to two lines only when needed ("ANCIENT WRITERS / COUNT").
- **Title bar:** dark translucent rounded rectangle at the top; white condensed caps "BATTLE OF
  GAUGAMELA" plus a smaller yellow "331 BC".
- **Unit labels:** small pills with a dark fill and thin coloured border (red/blue/neutral), a
  coloured dot, and white bold caps (sentence case for minor units such as "Persian cavalry").
- **End card:** very large bold white numerals with an outline; the sub-line is in a regular-weight
  sans in salmon red.

## 7. Colours, effects and visual elements

Median pixel colours sampled from frames at 5.6 s, 26 s, 37.5 s and 53.3 s (540×1004 source;
compression and shadows shift these slightly):

| Role | Measured |
| --- | --- |
| Terrain mid / brighter centre | #715822 / #8A6C23 (ochre-olive) |
| Corner vignette | #261E11 |
| Persian units (red, mixed with shadow) | #93472B |
| Macedonian units | #292415 (near-black, not blue) |
| Label border, Persia / Macedon | #B94D3D / #627CB2 |
| Caption fill / keyword | #FEFCFD / #FAD306 (outline black) |
| Title-bar date "331 BC" | #D0C935 |
| Chariot-attack arrows | #EFA199 (salmon pink) |
| Cavalry manoeuvre arrow | #B1C4D6 (pale steel blue) |
| End-card sub-line | #EB958C (salmon) |

Effects: long soft shadows, dust puffs, glow flashes on impact, vignette.

## 8. Editing techniques and retention patterns

1. **Cold open on stakes:** numbers in the first sentence, no preamble.
2. **Words drive graphics:** every named thing appears on the map as it is said, so the eye always
   has a fresh target. Labels change about every 2–5 s and captions about every 0.65 s.
3. **Visible cause and effect:** the narration says "the line starts to stretch" while the viewer
   watches it stretch. Explanation and evidence share the frame.
4. **Micro-payoffs before the big one:** the chariots fail at about 30 s, the gap opens at about
   33 s, the wedge strikes at about 38 s, the king flees at about 44 s.
5. **Callback:** "already beaten the King of Persia once" (0:10) pays off with "for the second time"
   (0:42).
6. **Hard-number ending with source attribution**, then an abrupt end with no outro. *Interpretation:*
   this encourages loops and comments.
7. **Series framing:** the title bar plus a consistent look makes each video an episode (the
   Thermopylae link in the description supports this).

## 9. Audio (measured, not listened to)

- Single narrator, male (judged from the transcript context and caption voice; not verified by ear).
- Integrated mean is about −17.2 dB with peaks at 0.0 dBFS. The noise floor is about −35.6 dB,
  meaning there is a **continuous low-level bed under the voice**. I cannot determine from these
  measurements alone whether it is music, battle ambience or both, so this is left unknown.

## Implications for an original, free recreation (proposal; not yet built)

- The realistic 3D battle simulation cannot be reproduced free of charge in this environment
  (no GPU, no game engine, paid video models are excluded).
- The proposed equivalent is a **project-authored top-down battle-map component**: procedural
  ochre terrain with vignette, unit blocks drawn as dense soldier dots in faction colours, animated
  movement, pinned label pills, self-drawing arrows, impact glows and dust, slow camera drift,
  a title bar and a stat end card. Captions are 2–3 words with a yellow keyword, timed to the
  user's ElevenLabs MP3.
- Everything renders locally with Hypit (HTML renderer + FFmpeg) at 1080×1920 for no cost.
- Word timing for the MP3 needs speech alignment. The local recognizer works. The English
  WhisperX alignment model is blocked by this environment's network policy
  (`download.pytorch.org`), so a free alignment route will be settled before production.
