# Free tools ledger (verified 2026-10-31)

Every tool below is free to use. None needs an account, key or credits. "Network" lists what is
downloaded once; nothing runs on a paid service.

| Tool | Licence / cost | Used for | Network (one time) |
| --- | --- | --- | --- |
| Hypit CLI 0.3.1 (`@hypit/hypit`, npm) | Modified Apache-2.0; free for own use incl. commercial work; you own the output | Authoring, rendering, media tools | npm registry |
| Hypit local endpoints `media.local`, `html.local` | same | FFmpeg media ops, HTML→video rendering | none |
| Chromium (pre-installed Playwright build) | BSD | Render browser (`chromePath` in profile) | none |
| FFmpeg 6.1 / FFprobe | LGPL/GPL | Encode, mix, loudness master, sound kit synthesis | none |
| faster-whisper `small` (Systran, MIT) in Hypit's managed WhisperX env | MIT / BSD | Local word timestamps for the voiceover | PyPI (~5 GB env), Hugging Face (~0.5 GB model) |
| Fonts: Anton, Inter, Montserrat (Fontsource) | SIL OFL | Captions, labels, titles | npm registry |
| Sound kit (`scripts/make-sound-kit.sh`) | Self-generated: you own it | Bed, hits, whoosh | none |
| yt-dlp (Hypit-pinned) | Unlicense | Link downloads (YouTube blocked in this environment) | PyPI |
| Piper TTS + voice `en_US-joe` (CC0) | GPL-3.0 tool | **Not used** in this workflow (you supply your own voice) | — |

## Not available here, with free alternatives
| Need | Status | Free alternative |
| --- | --- | --- |
| Downloading YouTube references | Blocked (network policy denies www.google.com; YouTube bot check) | Upload the video file |
| WhisperX English alignment model | Blocked (download.pytorch.org denied) | faster-whisper word timestamps (`shorts.py align`) |
| Photoreal 3D battle footage | Would need paid video models or a game engine + GPU | Code-drawn top-down battle map (`packages/battle-map`) |
| AI image generation | Paid via HypiHub/BYOK; local SD impractical on 4 CPUs without a GPU | Code-drawn visuals, your own or public-domain images |

The paid Hypit providers (HypiHub, Seedance, GPT Image, ElevenLabs etc.) are installed with the CLI but
**not configured**. `hypit.runtime.json` has no credential stores, so they cannot be called.
