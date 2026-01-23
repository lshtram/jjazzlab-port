# Status (2026-01-23)

## Environment
- Node.js 20.20.0 and npm 10.8.2 installed from NodeSource.
- Yarn apt repo disabled at `/etc/apt/sources.list.d/yarn.list.disabled` due to an expired key.
- NodeSource apt repo added (`deb.nodesource.com/node_20.x`).
- Note: `npm install` in `web/app` ran before the Node upgrade; re-run to ensure native deps align with Node 20.

## Repo Changes
- Yamaha CASM parsing now tracked per-style-part (CSEG/Sdec) with CNTT overrides, so each style part uses correct channel maps.
- Added chord symbol tracking in chord timeline and new degree-aware mapping helpers for melody/chord adaptation.
- Updated core render pipeline to pull CASM data per part (no more global CASM assumptions).
- Expanded harmony chord-tone parsing for Yamaha chord types and 9/11/13 extensions.
- Generated additional MIDI fixtures:
  - `web/fixtures/midi/java/acoustic_jazz1_12bar.mid`
  - `web/fixtures/midi/java/jazz_samba_12bar.mid`
  - `web/fixtures/midi/java/rocknroll_12bar.mid`
  - `web/fixtures/midi/ts/acoustic_jazz1_12bar.mid`
  - `web/fixtures/midi/ts/jazz_samba_12bar.mid`
  - `web/fixtures/midi/ts/rocknroll_12bar.mid`
- Built audio renders (untracked) via FluidSynth:
  - `web/tmp/audio/acoustic_jazz1_12bar.wav`
  - `web/tmp/audio/jazzblues_simple_12bar.wav`
  - `web/tmp/audio/jazz_samba_12bar.wav`

## Validation
- `npm run build` in `web/app` passes.
- Java vs TS MIDI parity:
  - `acoustic_jazz1_12bar`: mismatches=0
  - `jazzblues_simple_12bar`: mismatches=0
  - `jazz_samba_12bar`: mismatches=176 (mostly channels 11/13)
  - `rocknroll_12bar`: mismatches=114 (channels 10–13, +1 semitone deltas)
- FluidSynth renders are non-silent:
  - AcousticJazz1: ~22.89s, RMS ~581
  - JazzBluesSimple: ~31.17s, RMS ~1314
  - JazzSamba: ~28.85s, RMS ~792
  - Warning during render: missing instrument on channel 8 (bank=127 prog=32) fallback to bank 0.

## Working Tree Snapshot
- Modified: `web/app/src/core/harmony.ts`
- Modified: `web/app/src/core/render.ts`
- Modified: `web/app/src/core/song.ts`
- Modified: `web/app/src/core/yamaha/buildSong.ts`
- Modified: `web/app/src/core/yamaha/parseCasm.ts`
- Modified: `web/app/src/core/yamaha/parseStyle.ts`
- Modified: `web/fixtures/midi/ts/acoustic_jazz1_12bar.mid`
- Modified: `web/fixtures/midi/ts/jazz_samba_12bar.mid`
- Modified: `web/fixtures/midi/ts/rocknroll_12bar.mid`
- Modified: `JJazzLab/plugins/FluidSynthEmbeddedSynth/pom.xml` (pre-existing unrelated change)
- Untracked: `web/fixtures/styles/`, `web/tmp/`, `web/app/tmp/`, `.m2/`, `.vscode/`

## Notes
- Java export for `JazzGtrTrio184 9K.s460.sty` fails (empty Ending B part). Skipped for now.
- Remaining parity deltas likely tied to chord-degree mapping for ROOT_TRANS+MELODY and CHORD handling.

## Next Steps
- Investigate RocknRoll/JazzSamba mismatches by tracing degree mapping (ROOT_TRANS+MELODY) against Java `fitDegreeAdvanced` behavior.
- Add a small diagnostic harness (or reuse `web/app/tmp/*`) to dump per-note source degree → dest degree mapping for mismatched channels.
- Once parity holds, render additional audio samples (and optionally export short WAVs for review).
