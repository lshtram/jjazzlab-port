# Status (2026-01-23)

## Environment
- Node.js 20.20.0 and npm 10.8.2 installed from NodeSource.
- Yarn apt repo disabled at `/etc/apt/sources.list.d/yarn.list.disabled` due to an expired key.
- NodeSource apt repo added (`deb.nodesource.com/node_20.x`).
- Note: `npm install` in `web/app` ran before the Node upgrade; re-run to ensure native deps align with Node 20.

## Repo Changes
- Added MegaVoice filtering based on SInt bank MSB=8 parsing to match Java (skip pitches >= 84 for flagged channels).
- Extended parsed style metadata with `megaVoiceChannels` and wired it through rendering/mapping.
- Added Yamaha muted chord/note parsing and filtering to match Java channel eligibility.
- Added a curated Yamaha style set under `web/fixtures/styles/curated` (replaced JazzWaltzFast with SynthPop).
- Added Java/TS MIDI fixtures for 10 curated styles.
- Added `scripts/fetch-yamaha-styles.sh` to download larger style packs on demand.
- Added `scripts/render-midi.sh` helper to render MIDI to WAV via Fluidsynth.

## Validation
- `npm -C web/app run -s build` passes.
- Java vs TS MIDI parity (via `tools:compare-mapping`):
  - `AcousticJazz1.S563.sty`: mismatch groups = 0
  - `CoolPop.sty`: mismatch groups = 0
  - `DiscoPhilly.sty`: mismatch groups = 0
  - `JazzBluesSimple.S740.sty`: mismatch groups = 0
  - `JazzSamba.S346.sty`: mismatch groups = 0
  - `PopR&B.sty`: mismatch groups = 0
  - `RocknRoll.sty`: mismatch groups = 0
  - `SambaCity213.s460.sty`: mismatch groups = 0
  - `SynthPop.sty`: mismatch groups = 0
  - `Zouk.sty`: mismatch groups = 0

## Working Tree Snapshot
- Modified: `web/app/src/core/render.ts`
- Modified: `web/app/src/core/yamaha/buildSong.ts`
- Modified: `web/app/src/core/yamaha/parseCasm.ts`
- Modified: `web/app/src/core/yamaha/parseStyle.ts`
- Deleted: `web/fixtures/styles/curated/JazzWaltzFast.S499.sty`
- Added: `web/fixtures/styles/curated/SynthPop.sty`
- Added: `web/fixtures/midi/java/*_12bar.mid` (new 6 styles)
- Added: `web/fixtures/midi/ts/*_12bar.mid` (10 styles regenerated)
- Added: `scripts/fetch-yamaha-styles.sh`
- Untracked: `web/fixtures/styles/yamaha/`, `web/tmp/`, `web/app/tmp/`, `.m2/`, `.vscode/`

## Notes
- Curated styles are tracked under `web/fixtures/styles/curated`.
- SInt parsing is only used to detect MegaVoice channels (bank MSB 8).

## Next Steps
- Run `scripts/fetch-yamaha-styles.sh --all` if you want the full style library locally (kept out of git).
- Continue core porting work (song parsing, style selection, and synth integration).
