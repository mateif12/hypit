# Shorts studio (Hypit, zero cost)

A reusable vertical-video workspace built on the Hypit CLI. Original Hypit code is untouched; this folder is
an ordinary Hypit project (`package.json → "hypit": { "project": true }`) with local-only rendering.

| Folder | Contents |
| --- | --- |
| `templates/` | `battle-short/`: plan + script skeleton for new videos |
| `assets/` | Shared music bed and sound effects (self-synthesised), brand/fonts/images slots |
| `prompts/` | Prompts for reference analysis, script writing and choreography |
| `videos/references/` | Analysed references (`ANALYSIS.md`, `TIMELINE.md`, transcript) |
| `videos/productions/` | One folder per Short (`script.txt`, `assets/voiceover.mp3`, `plan.json`, generated Hypit source, `output/final.mp4`) |
| `docs/` | `WORKFLOW.md` (step by step), `FREE-TOOLS.md` (licences, limits) |
| `packages/` | Hypit project components: `battle-map` (War Map style), `shorts-kinetic` (kinetic text) |
| `scripts/` | `setup.sh` (fresh session), `shorts.py` (new/align/compose/finish), `make-sound-kit.sh` |

Start with `docs/WORKFLOW.md`. Visual rules live in `STYLE_GUIDE.md`.
Finished example: `videos/productions/cannae-trap/output/final.mp4`.
