# Status (2026-01-23)

## Environment
- Node.js 20.20.0 and npm 10.8.2 installed from NodeSource.
- Yarn apt repo disabled at `/etc/apt/sources.list.d/yarn.list.disabled` due to an expired key.
- NodeSource apt repo added (`deb.nodesource.com/node_20.x`).
- Note: `npm install` in `web/app` ran before the Node upgrade; re-run to ensure native deps align with Node 20.

## Repo Changes
- Added a Java CLI to export a Yamaha style + 12-bar blues to MIDI.
- Added a headless flag to skip adapted rhythm generation during CLI export.
- Added Vite + React + TypeScript scaffold at `web/app` with TS harness tools.
- Added MIDI fixtures `web/fixtures/midi/java/jazzblues_simple_12bar.mid` and `web/fixtures/midi/ts/jazzblues_simple_12bar.mid`.
- Updated `web/fixtures/midi/README.md` with offline export steps.
  - TS harness now applies CASM channel mapping, chord-mode/melody-mode fitting, and chord-boundary splits.
  - MIDI note counts, end tick, and note-level pitches now match the Java baseline for the JazzBluesSimple fixture.
- Added environment-agnostic core modules under `web/app/src/core` (MIDI, Yamaha parsing, song parsing, render pipeline).
- Added SoundFont synth playback (`soundfont-player`) plus a minimal React harness to load a style, enter a chord chart, play/stop, and export MIDI.

## Working Tree Snapshot
- Modified: `JJazzLab/core/SongStructure/src/main/java/org/jjazz/songstructure/SongStructureImpl.java`
- Added: `JJazzLab/app/Test/src/main/java/org/jjazz/test/ExportYamahaMidiCli.java`
- Modified: `web/app/src` (core modules, audio synth, App harness, styles)
- Modified: `web/app/tools/yamaha-to-midi.ts`, `web/app/tools/compare-midi.ts`
- Modified: `web/app/package.json`, `web/app/package-lock.json`
- Modified: `web/fixtures/midi/README.md`, `web/fixtures/midi/ts/jazzblues_simple_12bar.mid`
- Untracked: `web/fixtures/styles/`, `web/tmp/`, `.m2/`, `.vscode/`
- Pre-existing unrelated change: `JJazzLab/plugins/FluidSynthEmbeddedSynth/pom.xml`

## Next Steps
- Validate parity against additional Yamaha styles and parts (introductions/endings).
- Decide whether to implement retrigger rule handling (RTR) for long notes across chord changes.
- Capture program changes within parts (if any) so MIDI export mirrors style changes inside a section.
